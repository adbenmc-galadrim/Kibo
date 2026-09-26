import { createHash } from "node:crypto";
import { z } from "zod";
import type { FakeGithub, FakeIssue, FakeRepo, FakeRun } from "./fake-github";
import { handleGraphql } from "./fake-github-graphql";

export type Failure = {
  method: string;
  path: RegExp;
  status: number;
  body: string;
  headers: Record<string, string>;
};

export const ECHO_AUTH = "echo-auth";
export const LOGS_HOST = "pipelines.actions.githubusercontent.com";

const issueCreateBody = z.object({
  title: z.string().optional(),
  body: z.string().nullable().optional(),
  labels: z.array(z.string()).optional(),
});
const issuePatchBody = z.object({
  title: z.string().optional(),
  body: z.string().nullable().optional(),
  state: z.enum(["open", "closed"]).optional(),
});
const graphqlBody = z.object({ query: z.string().optional(), variables: z.record(z.unknown()).optional() });

const rateHeaders = (gh: FakeGithub): Record<string, string> => ({
  "x-ratelimit-remaining": String(gh.rate.remaining),
  "x-ratelimit-reset": String(gh.rate.reset),
});
const json = (gh: FakeGithub, status: number, body: unknown, headers: Record<string, string> = {}) =>
  Response.json(body, { status, headers: { ...rateHeaders(gh), ...headers } });
const notFound = (gh: FakeGithub) => json(gh, 404, { message: "Not Found" });
const invalid = (gh: FakeGithub) => json(gh, 422, { message: "Validation Failed" });

const parseJson = (text: string): unknown => {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
};

export const restIssue = (slug: string, i: FakeIssue) => ({
  id: i.number * 1000,
  node_id: i.nodeId,
  number: i.number,
  title: i.title,
  body: i.body,
  state: i.state,
  labels: i.labels.map((name) => ({ name })),
  created_at: i.createdAt,
  updated_at: i.updatedAt,
  html_url: `https://github.com/${slug}/issues/${i.number}`,
  user: { login: i.creator },
  ...(i.pullRequest
    ? { pull_request: { url: `https://api.github.com/repos/${slug}/pulls/${i.number}` } }
    : {}),
});

function injectedFailure(
  gh: FakeGithub,
  failures: Failure[],
  method: string,
  path: string,
  auth: string | null,
) {
  const index = failures.findIndex((f) => f.method === method && f.path.test(path));
  const [failure] = index === -1 ? [] : failures.splice(index, 1);
  if (!failure) return null;
  const text =
    failure.body === ECHO_AUTH ? JSON.stringify({ message: `Bad credentials: ${auth}` }) : failure.body;
  return new Response(text, { status: failure.status, headers: { ...rateHeaders(gh), ...failure.headers } });
}

function jobLog(gh: FakeGithub, id: number, auth: string | null): Response {
  if (auth !== null) return new Response("credentials leaked to the logs host", { status: 400 });
  const job = [...gh.repos.values()]
    .flatMap((r) => r.runs.flatMap((run) => run.jobs))
    .find((j) => j.id === id);
  return job ? new Response(job.log) : new Response("not found", { status: 404 });
}

export async function route(gh: FakeGithub, failures: Failure[], req: Request): Promise<Response> {
  const url = new URL(req.url);
  const auth = req.headers.get("authorization");
  const body = req.method === "GET" ? "" : await req.text();
  gh.requests.push({ method: req.method, path: url.pathname + url.search, auth, body });
  const failure = injectedFailure(gh, failures, req.method, url.pathname, auth);
  if (failure) return failure;
  const logs = /^\/logs\/(\d+)$/.exec(url.pathname);
  if (logs) return jobLog(gh, Number(logs[1]), auth);
  if (auth !== `Bearer ${gh.token}`) return json(gh, 401, { message: "Bad credentials" });
  if (gh.rate.remaining <= 0) return json(gh, 403, { message: "API rate limit exceeded" });
  gh.rate.remaining -= 1;
  if (url.pathname === "/user") return json(gh, 200, { login: gh.login });
  if (url.pathname === "/user/repos") return listRepos(gh, url);
  if (url.pathname === "/graphql" && req.method === "POST") {
    const parsed = graphqlBody.safeParse(parseJson(body));
    if (!parsed.success) return json(gh, 400, { message: "Problems parsing JSON" });
    const out = handleGraphql(gh, parsed.data);
    return json(gh, out.status, out.body);
  }
  const m = /^\/repos\/([^/]+)\/([^/]+)(\/.*)$/.exec(url.pathname);
  const slug = m ? `${m[1]}/${m[2]}` : "";
  const r = gh.repos.get(slug);
  if (!m || !r) return notFound(gh);
  return repoRoute(gh, slug, r, req, url, m[3] ?? "", body);
}

function pageParams(url: URL) {
  return {
    perPage: Number(url.searchParams.get("per_page") ?? "30"),
    page: Number(url.searchParams.get("page") ?? "1"),
  };
}

function nextLink(gh: FakeGithub, url: URL, page: number, hasNext: boolean): Record<string, string> {
  if (!hasNext) return {};
  const next = new URL(url);
  next.searchParams.set("page", String(page + 1));
  return { link: `<${gh.url}${next.pathname}${next.search}>; rel="next"` };
}

function listRepos(gh: FakeGithub, url: URL): Response {
  const { perPage, page } = pageParams(url);
  const all = [...gh.repos.entries()].map(([slug, r]) => ({
    full_name: slug,
    private: r.private,
    description: r.description,
  }));
  const slice = all.slice((page - 1) * perPage, page * perPage);
  return json(gh, 200, slice, nextLink(gh, url, page, page * perPage < all.length));
}

function listIssues(gh: FakeGithub, slug: string, r: FakeRepo, req: Request, url: URL): Response {
  const since = url.searchParams.get("since");
  const creator = url.searchParams.get("creator");
  const state = url.searchParams.get("state") ?? "open";
  const { perPage, page } = pageParams(url);
  const all = [...r.issues.values()]
    .filter((i) => i.gone === null)
    .filter((i) => since === null || i.updatedAt >= since)
    .filter((i) => creator === null || i.creator === creator)
    .filter((i) => state === "all" || i.state === state)
    .sort((a, b) => a.updatedAt.localeCompare(b.updatedAt) || a.number - b.number);
  const slice = all.slice((page - 1) * perPage, page * perPage).map((i) => restIssue(slug, i));
  const etag = `"${createHash("sha1").update(JSON.stringify(slice)).digest("hex")}"`;
  if (req.headers.get("if-none-match") === etag)
    return new Response(null, { status: 304, headers: { etag, ...rateHeaders(gh) } });
  return json(gh, 200, slice, { etag, ...nextLink(gh, url, page, page * perPage < all.length) });
}

function createIssue(gh: FakeGithub, slug: string, body: string): Response {
  const input = issueCreateBody.safeParse(parseJson(body));
  if (!input.success || !input.data.title?.trim()) return invalid(gh);
  const { title, body: text, labels } = input.data;
  const issue = gh.addIssue(slug, { title, body: text ?? null, labels: labels ?? [] });
  return json(gh, 201, restIssue(slug, issue));
}

function issueRoute(
  gh: FakeGithub,
  slug: string,
  issue: FakeIssue | undefined,
  method: string,
  body: string,
): Response {
  if (!issue) return notFound(gh);
  if (issue.gone !== null)
    return json(gh, issue.gone, { message: issue.gone === 410 ? "Gone" : "Not Found" });
  if (method === "GET") return json(gh, 200, restIssue(slug, issue));
  if (method !== "PATCH") return notFound(gh);
  const input = issuePatchBody.safeParse(parseJson(body));
  if (!input.success) return invalid(gh);
  const patch = input.data;
  if (patch.title !== undefined && !patch.title.trim()) return invalid(gh);
  gh.editIssue(slug, issue.number, {
    ...(patch.title !== undefined && { title: patch.title }),
    ...(patch.body !== undefined && { body: patch.body }),
    ...(patch.state !== undefined && { state: patch.state }),
  });
  return json(gh, 200, restIssue(slug, issue));
}

function workflowRuns(gh: FakeGithub, slug: string, r: FakeRepo, url: URL): Response {
  const sha = url.searchParams.get("head_sha");
  const runs = r.runs.filter((run) => sha === null || run.headSha === sha);
  return json(gh, 200, {
    total_count: runs.length,
    workflow_runs: runs.map((run) => ({
      id: run.id,
      name: run.name,
      head_sha: run.headSha,
      head_branch: run.headBranch,
      status: run.status,
      conclusion: run.conclusion,
      html_url: `https://github.com/${slug}/actions/runs/${run.id}`,
      run_started_at: run.createdAt,
      created_at: run.createdAt,
      updated_at: run.updatedAt,
    })),
  });
}

function runJobs(gh: FakeGithub, run: FakeRun | undefined): Response {
  if (!run) return notFound(gh);
  return json(gh, 200, {
    total_count: run.jobs.length,
    jobs: run.jobs.map((j) => ({
      id: j.id,
      run_id: run.id,
      name: j.name,
      status: j.status,
      conclusion: j.conclusion,
      started_at: j.startedAt,
      completed_at: j.completedAt,
      steps: [],
    })),
  });
}

function repoRoute(
  gh: FakeGithub,
  slug: string,
  r: FakeRepo,
  req: Request,
  url: URL,
  rest: string,
  body: string,
): Response {
  if (rest === "/issues" && req.method === "GET") return listIssues(gh, slug, r, req, url);
  if (rest === "/issues" && req.method === "POST") return createIssue(gh, slug, body);
  const one = /^\/issues\/(\d+)$/.exec(rest);
  if (one) return issueRoute(gh, slug, r.issues.get(Number(one[1])), req.method, body);
  const pull = /^\/pulls\/(\d+)$/.exec(rest);
  if (pull) {
    const p = r.pulls.get(Number(pull[1]));
    return p
      ? json(gh, 200, { number: Number(pull[1]), head: { sha: p.headSha, ref: p.headRef } })
      : notFound(gh);
  }
  if (rest === "/actions/runs") return workflowRuns(gh, slug, r, url);
  const jobs = /^\/actions\/runs\/(\d+)\/jobs$/.exec(rest);
  if (jobs)
    return runJobs(
      gh,
      r.runs.find((x) => x.id === Number(jobs[1])),
    );
  const logs = /^\/actions\/jobs\/(\d+)\/logs$/.exec(rest);
  if (logs) {
    return new Response(null, {
      status: 302,
      headers: { location: `https://${LOGS_HOST}/logs/${logs[1]}`, ...rateHeaders(gh) },
    });
  }
  return notFound(gh);
}
