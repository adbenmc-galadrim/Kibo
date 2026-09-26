import { githubError, KiboError } from "@kibo/schema";
import { type ZodType, type ZodTypeDef, z } from "zod";
import { GITHUB_API, GITHUB_RULES } from "../integrations/net";
import type { RateLimitGate } from "../integrations/rate-limit";
import type { IntegrationFetch, IntegrationResponse, InternalRule } from "../integrations/types";

type Schema<T> = ZodType<T, ZodTypeDef, unknown>;
type Method = "GET" | "POST" | "PATCH";
export type GithubApi = {
  rest<T>(method: Method, path: string, schema: Schema<T>, body?: unknown): Promise<T>;
  raw(path: string, rules: InternalRule[], maxBytes: number): Promise<IntegrationResponse>;
  graphql<T>(query: string, variables: Record<string, unknown>, schema: Schema<T>): Promise<T>;
  paginate<T>(path: string, schema: Schema<T>, maxPages: number): Promise<T[]>;
};

const decoder = new TextDecoder();
const GraphqlEnvelope = z.object({
  data: z.unknown().optional(),
  errors: z.array(z.object({ message: z.string() })).optional(),
});

function jsonOf(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    throw new KiboError("REMOTE_REJECTED", "github response is not json");
  }
}

export function parseGithub<T>(res: IntegrationResponse, schema: Schema<T>): T {
  const text = decoder.decode(res.body);
  if (res.status < 200 || res.status >= 300) {
    throw githubError(res.status, (n) => res.headers.get(n), text);
  }
  const parsed = schema.safeParse(jsonOf(text));
  if (!parsed.success) {
    const issue = parsed.error.issues[0]?.message ?? "";
    throw new KiboError("REMOTE_REJECTED", `unexpected github response: ${issue}`);
  }
  return parsed.data;
}

function nextLink(headers: Headers): string | null {
  const m = /<([^>]+)>;\s*rel="next"/.exec(headers.get("link") ?? "");
  return m?.[1] ?? null;
}

function onGithub(link: string): string {
  if (!URL.canParse(link)) throw new KiboError("REMOTE_REJECTED", "invalid github pagination link");
  const u = new URL(link);
  return `https://${GITHUB_API}${u.pathname}${u.search}`;
}

export function createGithubApi(deps: {
  fetch: IntegrationFetch;
  token(): Promise<string | null>;
  gate: RateLimitGate;
}): GithubApi {
  const send = async (
    url: string,
    method: Method,
    body: unknown,
    rules: InternalRule[],
    maxBytes?: number,
  ): Promise<IntegrationResponse> => {
    const until = deps.gate.blockedUntil();
    if (until !== null) {
      throw new KiboError("RATE_LIMITED", `github paused until ${new Date(until).toISOString()}`);
    }
    const token = await deps.token();
    if (!token) throw new KiboError("NOT_CONNECTED", "github account not connected");
    return deps.fetch(
      url,
      {
        method,
        bearer: token,
        headers: {
          accept: "application/vnd.github+json",
          "x-github-api-version": "2022-11-28",
          "content-type": "application/json",
        },
        body: body === undefined ? undefined : JSON.stringify(body),
        maxBytes,
      },
      rules,
    );
  };
  const get = (url: string) => send(url, "GET", undefined, GITHUB_RULES);
  return {
    async rest(method, path, schema, body) {
      return parseGithub(await send(`https://${GITHUB_API}${path}`, method, body, GITHUB_RULES), schema);
    },
    raw: (path, rules, maxBytes) => send(`https://${GITHUB_API}${path}`, "GET", undefined, rules, maxBytes),
    async graphql(query, variables, schema) {
      const res = await send(`https://${GITHUB_API}/graphql`, "POST", { query, variables }, GITHUB_RULES);
      const env = parseGithub(res, GraphqlEnvelope);
      const first = env.errors?.[0];
      if (first) throw new KiboError("REMOTE_REJECTED", `github graphql: ${first.message}`);
      const parsed = schema.safeParse(env.data);
      if (!parsed.success) throw new KiboError("REMOTE_REJECTED", "unexpected github graphql response");
      return parsed.data;
    },
    paginate: (path, schema, maxPages) => paginateWith(get, path, schema, maxPages),
  };
}

async function paginateWith<T>(
  get: (url: string) => Promise<IntegrationResponse>,
  path: string,
  schema: Schema<T>,
  maxPages: number,
): Promise<T[]> {
  const out: T[] = [];
  let url: string | null = `https://${GITHUB_API}${path}`;
  for (let page = 0; url !== null && page < maxPages; page++) {
    const res = await get(url);
    out.push(...parseGithub(res, z.array(schema)));
    const next = nextLink(res.headers);
    url = next === null ? null : onGithub(next);
  }
  return out;
}
