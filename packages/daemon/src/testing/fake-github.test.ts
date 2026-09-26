import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { GITHUB_GRAPHQL } from "@kibo/schema";
import { ECHO_AUTH, type FakeGithub, startFakeGithub } from "./fake-github";

let gh: FakeGithub;
beforeEach(() => {
  gh = startFakeGithub();
  gh.addRepo("adam/kibo");
});
afterEach(() => gh.stop());

const call = (path: string, init: RequestInit = {}) =>
  fetch(`${gh.url}${path}`, { ...init, headers: { authorization: `Bearer ${gh.token}`, ...init.headers } });

describe("fake github rest", () => {
  test("authentication is required", async () => {
    expect((await fetch(`${gh.url}/user`)).status).toBe(401);
    expect(await (await call("/user")).json()).toEqual({ login: "adam" });
  });

  test("issues are listed by update date, since is inclusive, pages and etags work", async () => {
    const a = gh.addIssue("adam/kibo", { title: "A" });
    gh.addIssue("adam/kibo", { title: "B" });
    gh.addIssue("adam/kibo", { title: "PR", pullRequest: true });
    const first = await call(
      `/repos/adam/kibo/issues?state=all&since=${a.updatedAt}&per_page=2&sort=updated&direction=asc`,
    );
    const page = (await first.json()) as { title: string; pull_request?: unknown }[];
    expect(page.map((i) => i.title)).toEqual(["A", "B"]);
    expect(first.headers.get("link")).toContain('rel="next"');
    const etag = first.headers.get("etag") ?? "";
    const again = await call(
      `/repos/adam/kibo/issues?state=all&since=${a.updatedAt}&per_page=2&sort=updated&direction=asc`,
      {
        headers: { "if-none-match": etag },
      },
    );
    expect(again.status).toBe(304);
  });

  test("create, edit, gone and validation", async () => {
    const created = await call("/repos/adam/kibo/issues", {
      method: "POST",
      body: JSON.stringify({ title: "New", body: "x" }),
    });
    expect(created.status).toBe(201);
    const issue = (await created.json()) as { number: number; html_url: string; user: { login: string } };
    expect(issue.user.login).toBe("adam");
    expect(issue.html_url).toBe(`https://github.com/adam/kibo/issues/${issue.number}`);
    const bad = await call(`/repos/adam/kibo/issues/${issue.number}`, {
      method: "PATCH",
      body: JSON.stringify({ title: "" }),
    });
    expect(bad.status).toBe(422);
    gh.editIssue("adam/kibo", issue.number, { gone: 410 });
    expect((await call(`/repos/adam/kibo/issues/${issue.number}`)).status).toBe(410);
  });

  test("rate limit and injected failures", async () => {
    gh.rate.remaining = 1;
    expect((await call("/user")).headers.get("x-ratelimit-remaining")).toBe("0");
    expect((await call("/user")).status).toBe(403);
    gh.rate.remaining = 50;
    gh.failNext("GET", /^\/user$/, 500, ECHO_AUTH);
    const echoed = await call("/user");
    expect(echoed.status).toBe(500);
    expect(await echoed.text()).toContain(gh.token);
  });

  test("job logs redirect to the logs host, which refuses credentials", async () => {
    gh.addRun("adam/kibo", {
      id: 7,
      headSha: "abc",
      headBranch: "kib-12",
      name: "ci",
      status: "completed",
      conclusion: "failure",
      jobs: [
        {
          id: 70,
          name: "build",
          status: "completed",
          conclusion: "failure",
          startedAt: null,
          completedAt: null,
          log: "##[error]boom",
        },
      ],
    });
    const redirect = await call("/repos/adam/kibo/actions/jobs/70/logs", { redirect: "manual" });
    expect(redirect.status).toBe(302);
    expect(redirect.headers.get("location")).toBe("https://pipelines.actions.githubusercontent.com/logs/70");
    expect((await call("/logs/70")).status).toBe(400);
    expect(await (await fetch(`${gh.url}/logs/70`)).text()).toBe("##[error]boom");
  });
});

describe("fake github graphql", () => {
  test("only the shared queries are understood", async () => {
    gh.setProject({
      nodeId: "PVT_1",
      owner: "adam",
      number: 1,
      title: "Roadmap",
      repo: "adam/kibo",
      fieldId: "F1",
      options: [{ id: "O1", name: "Todo" }],
    });
    const issue = gh.addIssue("adam/kibo", { title: "A" });
    gh.addProjectItem(issue.number, "O1");
    const res = await call("/graphql", {
      method: "POST",
      body: JSON.stringify({
        query: GITHUB_GRAPHQL.projectItems,
        variables: { projectId: "PVT_1", after: null },
      }),
    });
    const body = (await res.json()) as {
      data: { node: { items: { nodes: { content: { title: string } }[] } } };
    };
    expect(body.data.node.items.nodes[0]?.content.title).toBe("A");
    const unknown = await call("/graphql", {
      method: "POST",
      body: JSON.stringify({ query: "{ viewer { login } }", variables: {} }),
    });
    expect(unknown.status).toBe(400);
  });
});

test("the fake github listens on the requested port", async () => {
  const probe = startFakeGithub();
  const port = Number(new URL(probe.url).port);
  probe.stop();
  const fixed = startFakeGithub({ port });
  expect(fixed.url).toBe(`http://127.0.0.1:${port}`);
  expect((await fetch(`${fixed.url}/user`)).status).toBe(401);
  fixed.stop();
});
