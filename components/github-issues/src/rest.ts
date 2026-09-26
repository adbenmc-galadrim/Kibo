import { type BindingConfig, githubError, KiboError } from "@kibo/schema";
import type { AdapterContext } from "@kibo/sdk/adapter";
import { type ZodType, type ZodTypeDef, z } from "zod";

export type Ctx = AdapterContext<BindingConfig>;
type Method = "GET" | "POST" | "PATCH";
const API = "https://api.github.com";
const HEADERS = { accept: "application/vnd.github+json", "x-github-api-version": "2022-11-28" };
const etags = new Map<string, { etag: string; body: string }>();

function parseJson(text: string, path: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    throw new KiboError("REMOTE_REJECTED", `github response for ${path} is not json`);
  }
}

export async function call<T>(
  ctx: Ctx,
  method: Method,
  path: string,
  schema: ZodType<T, ZodTypeDef, unknown>,
  body?: unknown,
): Promise<T> {
  const cached = method === "GET" ? etags.get(path) : undefined;
  const res = await ctx.fetch(`${API}${path}`, {
    method,
    headers: {
      ...HEADERS,
      ...(body !== undefined && { "content-type": "application/json" }),
      ...(cached && { "if-none-match": cached.etag }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const header = (name: string) => res.headers[name] ?? null;
  const text = res.status === 304 && cached ? cached.body : res.body;
  if (res.status !== 304 && (res.status < 200 || res.status >= 300))
    throw githubError(res.status, header, res.body);
  const etag = header("etag");
  if (method === "GET" && etag && res.status !== 304) etags.set(path, { etag, body: res.body });
  const parsed = schema.safeParse(parseJson(text, path));
  if (!parsed.success) throw new KiboError("REMOTE_REJECTED", `unexpected github response for ${path}`);
  return parsed.data;
}

const Envelope = z.object({
  data: z.unknown().optional(),
  errors: z.array(z.object({ message: z.string() })).optional(),
});

export async function graphql<T>(
  ctx: Ctx,
  query: string,
  variables: Record<string, unknown>,
  schema: ZodType<T, ZodTypeDef, unknown>,
): Promise<T> {
  const env = await call(ctx, "POST", "/graphql", Envelope, { query, variables });
  if (env.errors?.length)
    throw new KiboError("REMOTE_REJECTED", `github graphql: ${env.errors[0]?.message ?? ""}`);
  const parsed = schema.safeParse(env.data);
  if (!parsed.success) throw new KiboError("REMOTE_REJECTED", "unexpected github graphql response");
  return parsed.data;
}
