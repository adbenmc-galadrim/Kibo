import { describe, expect, test } from "bun:test";
import { type BindingConfig, BUILTIN_IDS, GITHUB_GRAPHQL, isBuiltinId } from "@kibo/schema";
import { adapterActions } from "@kibo/sdk/adapter";
import { z } from "zod";
import { githubIssuesAdapter } from "./adapter";
import { manifest } from "./index";

type Reply = { status: number; body: unknown; headers?: Record<string, string> };
type Handler = (url: URL, body: unknown) => Reply;
type Call = { method: string; path: string; body: unknown; headers: Record<string, string> };

function fakeFetch(routes: Record<string, Handler>) {
  const calls: Call[] = [];
  const fetch = async (
    url: string,
    init?: { method?: string; headers?: Record<string, string>; body?: string },
  ) => {
    const u = new URL(url);
    const method = init?.method ?? "GET";
    const body: unknown = init?.body ? JSON.parse(init.body) : undefined;
    calls.push({ method, path: u.pathname + u.search, body, headers: init?.headers ?? {} });
    const gql =
      u.pathname === "/graphql" && typeof body === "object" && body !== null && "query" in body
        ? body.query
        : null;
    const op = gql ? Object.entries(GITHUB_GRAPHQL).find(([, q]) => q === gql)?.[0] : undefined;
    const key = op ? `GQL ${op}` : `${method} ${u.pathname}`;
    const h = routes[key];
    if (!h) return { status: 404, headers: {}, body: '{"message":"Not Found"}' };
    const r = h(u, body);
    return { status: r.status, headers: r.headers ?? {}, body: JSON.stringify(r.body) };
  };
  return { fetch, calls };
}

const restIssue = (n: number, patch: Record<string, unknown> = {}) => ({
  node_id: `I_${n}`,
  number: n,
  title: `Issue ${n}`,
  body: null,
  state: "open",
  updated_at: "2026-09-26T10:00:00Z",
  html_url: `https://github.com/adam/kibo/issues/${n}`,
  labels: [],
  user: { login: "adam" },
  ...patch,
});
const plain: BindingConfig = { repo: "adam/kibo", project: null, importClosed: false, labels: ["kibo"] };
const withProject: BindingConfig = {
  ...plain,
  project: {
    owner: "adam",
    number: 1,
    nodeId: "PVT",
    statusFieldId: "F",
    statusMap: { todo: "O1", in_progress: "O2", done: "O3" },
  },
};
const actions = adapterActions(githubIssuesAdapter);
const GqlVariables = z.object({ variables: z.object({ after: z.string().nullable() }) });
const ctx = (config: BindingConfig, fetch: ReturnType<typeof fakeFetch>["fetch"]) => ({
  instanceId: "binding:b1",
  config,
  fetch,
});

test("the manifest is a builtin adapter, absent from the UI built-ins", () => {
  expect(manifest.kind).toBe("adapter");
  expect(isBuiltinId(manifest.id)).toBe(true);
  expect(BUILTIN_IDS).not.toContain(manifest.id);
});

describe("pull (rest)", () => {
  test("skips pull requests and walks same-second pages without losing issues", async () => {
    const all = Array.from({ length: 150 }, (_, i) => restIssue(i + 1));
    const f = fakeFetch({
      "GET /repos/adam/kibo/issues": (u) => {
        const page = Number(u.searchParams.get("page"));
        const slice = all.slice((page - 1) * 100, page * 100);
        return { status: 200, body: page === 1 ? [...slice, restIssue(999, { pull_request: {} })] : slice };
      },
    });
    const seen = new Set<string>();
    let cursor: string | null = null;
    for (let i = 0; i < 10; i++) {
      const page = await actions["adapter.pull"](ctx(plain, f.fetch), { cursor });
      for (const item of page.items) seen.add(item.remoteId);
      cursor = page.cursor;
      if (!page.more) break;
    }
    expect(seen.size).toBe(150);
    expect(seen.has("999")).toBe(false);
    expect(f.calls[0]?.path).toContain("state=all");
    expect(f.calls[0]?.path).toContain("direction=asc");
  });
});

describe("rest calls", () => {
  test("a 304 reuses the body cached with its etag", async () => {
    const replies: Reply[] = [
      { status: 200, body: [restIssue(5)], headers: { etag: '"e1"' } },
      { status: 304, body: null },
    ];
    const f = fakeFetch({
      "GET /repos/adam/etag/issues": () => replies.shift() ?? { status: 500, body: null },
    });
    const config: BindingConfig = { ...plain, repo: "adam/etag" };
    await actions["adapter.pull"](ctx(config, f.fetch), { cursor: null });
    const again = await actions["adapter.pull"](ctx(config, f.fetch), { cursor: null });
    expect(again.items.map((i) => i.remoteId)).toEqual(["5"]);
  });

  test("the etag cache keeps at most 100 entries", async () => {
    const repos = Array.from({ length: 101 }, (_, i) => `adam/cap-${i}`);
    const f = fakeFetch(
      Object.fromEntries(
        repos.map((repo): [string, Handler] => [
          `GET /repos/${repo}/issues`,
          () => ({ status: 200, body: [], headers: { etag: `"${repo}"` } }),
        ]),
      ),
    );
    const pull = (repo: string) =>
      actions["adapter.pull"](ctx({ ...plain, repo }, f.fetch), { cursor: null });
    for (const repo of repos) await pull(repo);
    await pull("adam/cap-100");
    await pull("adam/cap-0");
    const conditional = f.calls.slice(-2).map((c) => c.headers["if-none-match"] ?? null);
    expect(conditional).toEqual(['"adam/cap-100"', null]);
  });

  test("a response that is not json is rejected with a stable code", async () => {
    const f = fakeFetch({ "PATCH /repos/adam/kibo/issues/4": () => ({ status: 200, body: undefined }) });
    await expect(
      actions["adapter.push"](ctx(plain, f.fetch), { kind: "update", remoteId: "4", patch: { title: "X" } }),
    ).rejects.toThrow("REMOTE_REJECTED");
  });
});

describe("pull (project)", () => {
  test("keeps items of the repo updated since the cursor, with their status", async () => {
    const item = (n: number, repo: string, at: string, option: string | null) => ({
      id: `PVTI_${n}`,
      updatedAt: at,
      fieldValues: { nodes: option ? [{ optionId: option, field: { id: "F" } }] : [] },
      content: {
        id: `I_${n}`,
        number: n,
        title: `T${n}`,
        body: "",
        state: "OPEN",
        updatedAt: "2026-09-26T09:00:00Z",
        url: `https://github.com/${repo}/issues/${n}`,
        repository: { nameWithOwner: repo },
        labels: { nodes: [] },
      },
    });
    const f = fakeFetch({
      "GQL projectItems": (_u, body) => {
        const after = GqlVariables.parse(body).variables.after;
        const nodes =
          after === null
            ? [
                item(1, "adam/kibo", "2026-09-26T10:00:00Z", "O2"),
                item(2, "adam/other", "2026-09-26T10:00:00Z", null),
              ]
            : [item(3, "adam/kibo", "2026-09-26T08:00:00Z", null)];
        return {
          status: 200,
          body: {
            data: { node: { items: { pageInfo: { hasNextPage: after === null, endCursor: "c1" }, nodes } } },
          },
        };
      },
    });
    const first = await actions["adapter.pull"](ctx(withProject, f.fetch), {
      cursor: JSON.stringify({ mode: "project", since: "2026-09-26T09:30:00Z", after: null, max: null }),
    });
    expect(first.items.map((i) => [i.remoteId, i.fields.statusId])).toEqual([["1", "in_progress"]]);
    expect(first.more).toBe(true);
    const second = await actions["adapter.pull"](ctx(withProject, f.fetch), { cursor: first.cursor });
    expect(second.items).toEqual([]);
    expect(second.more).toBe(false);
    expect(JSON.parse(second.cursor ?? "{}")).toEqual({
      mode: "project",
      since: "2026-09-26T10:00:00Z",
      after: null,
      max: null,
    });
  });
});

describe("push", () => {
  test("create carries the filter labels, closes and sets the project status", async () => {
    const created = restIssue(7, { title: "Nouveau" });
    const f = fakeFetch({
      "POST /repos/adam/kibo/issues": () => ({ status: 201, body: created }),
      "PATCH /repos/adam/kibo/issues/7": () => ({ status: 200, body: { ...created, state: "closed" } }),
      "GQL addItem": () => ({
        status: 200,
        body: { data: { addProjectV2ItemById: { item: { id: "PVTI_7" } } } },
      }),
      "GQL setStatus": () => ({
        status: 200,
        body: { data: { updateProjectV2ItemFieldValue: { projectV2Item: { id: "PVTI_7" } } } },
      }),
    });
    const out = await actions["adapter.push"](ctx(withProject, f.fetch), {
      kind: "create",
      ticketId: "1@1",
      fields: { title: "Nouveau", description: "", statusId: "done", closed: true },
      since: null,
    });
    expect(f.calls[0]).toMatchObject({
      method: "POST",
      body: { title: "Nouveau", body: "", labels: ["kibo"] },
    });
    expect(f.calls.map((c) => c.method)).toEqual(["POST", "PATCH", "POST", "POST"]);
    expect(out.fields).toMatchObject({ statusId: "done", closed: true });
    expect(out.ref.number).toBe(7);
  });

  test("a retried create adopts the issue created by a previous attempt", async () => {
    const f = fakeFetch({
      "GET /user": () => ({ status: 200, body: { login: "adam" } }),
      "GET /repos/adam/kibo/issues": (u) => {
        expect(u.searchParams.get("creator")).toBe("adam");
        expect(u.searchParams.get("since")).toBe("2026-09-26T10:00:00Z");
        return { status: 200, body: [restIssue(8, { title: "Déjà là", body: "x" })] };
      },
    });
    const out = await actions["adapter.push"](ctx(plain, f.fetch), {
      kind: "create",
      ticketId: "1@1",
      fields: { title: "Déjà là", description: "x", statusId: "todo", closed: false },
      since: "2026-09-26T10:00:00Z",
    });
    expect(out.remoteId).toBe("8");
    expect(f.calls.some((c) => c.method === "POST")).toBe(false);
  });

  test("update patches only the pushed fields and keeps the current project status", async () => {
    const f = fakeFetch({
      "PATCH /repos/adam/kibo/issues/4": () => ({ status: 200, body: restIssue(4, { title: "Renommé" }) }),
      "GQL issueItems": () => ({
        status: 200,
        body: {
          data: {
            repository: {
              issue: {
                id: "I_4",
                projectItems: {
                  nodes: [
                    {
                      id: "PVTI_4",
                      project: { id: "PVT" },
                      fieldValues: { nodes: [{ optionId: "O2", field: { id: "F" } }] },
                    },
                  ],
                },
              },
            },
          },
        },
      }),
    });
    const out = await actions["adapter.push"](ctx(withProject, f.fetch), {
      kind: "update",
      remoteId: "4",
      patch: { title: "Renommé" },
    });
    expect(f.calls[0]).toMatchObject({ method: "PATCH", body: { title: "Renommé" } });
    expect(out.fields).toMatchObject({ title: "Renommé", statusId: "in_progress" });
  });

  test("github errors keep their stable codes", async () => {
    const gone = fakeFetch({
      "PATCH /repos/adam/kibo/issues/4": () => ({ status: 410, body: { message: "Gone" } }),
    });
    await expect(
      actions["adapter.push"](ctx(plain, gone.fetch), {
        kind: "update",
        remoteId: "4",
        patch: { title: "X" },
      }),
    ).rejects.toThrow("REMOTE_NOT_FOUND");
    const limited = fakeFetch({
      "GET /repos/adam/kibo/issues": () => ({
        status: 403,
        body: { message: "API rate limit exceeded" },
        headers: { "x-ratelimit-remaining": "0" },
      }),
    });
    await expect(actions["adapter.pull"](ctx(plain, limited.fetch), { cursor: null })).rejects.toThrow(
      "RATE_LIMITED",
    );
  });
});
