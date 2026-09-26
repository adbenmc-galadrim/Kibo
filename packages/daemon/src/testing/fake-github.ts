import { type Failure, route } from "./fake-github-rest";

export type FakeIssue = {
  number: number;
  nodeId: string;
  title: string;
  body: string | null;
  state: "open" | "closed";
  labels: string[];
  createdAt: string;
  updatedAt: string;
  creator: string;
  pullRequest: boolean;
  gone: 404 | 410 | null;
};
export type FakeJob = {
  id: number;
  name: string;
  status: string;
  conclusion: string | null;
  startedAt: string | null;
  completedAt: string | null;
  log: string;
};
export type FakeRun = {
  id: number;
  headSha: string;
  headBranch: string;
  name: string;
  status: string;
  conclusion: string | null;
  createdAt: string;
  updatedAt: string;
  jobs: FakeJob[];
};
export type FakeRepo = {
  issues: Map<number, FakeIssue>;
  pulls: Map<number, { headSha: string; headRef: string }>;
  runs: FakeRun[];
  private: boolean;
  description: string | null;
};
export type FakeProjectItem = {
  itemId: string;
  issueNumber: number;
  optionId: string | null;
  updatedAt: string;
};
export type FakeProject = {
  nodeId: string;
  owner: string;
  number: number;
  title: string;
  repo: string;
  fieldId: string;
  options: { id: string; name: string }[];
  items: Map<string, FakeProjectItem>;
};
export type FakeRequest = { method: string; path: string; auth: string | null; body: string };

export type FakeGithub = {
  url: string;
  login: string;
  token: string;
  repos: Map<string, FakeRepo>;
  project: FakeProject | null;
  rate: { remaining: number; reset: number };
  requests: FakeRequest[];
  now(): string;
  tick(seconds?: number): string;
  addRepo(slug: string): FakeRepo;
  addIssue(slug: string, patch?: Partial<FakeIssue>): FakeIssue;
  editIssue(slug: string, n: number, patch: Partial<FakeIssue>): FakeIssue;
  setProject(p: Omit<FakeProject, "items">): FakeProject;
  addProjectItem(issueNumber: number, optionId: string | null): FakeProjectItem;
  addRun(slug: string, run: Omit<FakeRun, "createdAt" | "updatedAt">): FakeRun;
  failNext(
    method: string,
    path: RegExp,
    status: number,
    body?: string,
    headers?: Record<string, string>,
  ): void;
  stop(): void;
};

export { ECHO_AUTH, LOGS_HOST, restIssue } from "./fake-github-rest";

export function startFakeGithub(opts: { login?: string; token?: string } = {}): FakeGithub {
  let clock = Date.parse("2026-09-26T10:00:00Z");
  const failures: Failure[] = [];
  const iso = () => new Date(clock).toISOString().replace(/\.\d{3}Z$/, "Z");
  const repo = (slug: string): FakeRepo => {
    const r = gh.repos.get(slug);
    if (!r) throw new Error(`fake repo ${slug} missing`);
    return r;
  };
  const gh: FakeGithub = {
    url: "",
    login: opts.login ?? "adam",
    token: opts.token ?? "ghp_TESTSECRET0123456789abcdefghijklmn",
    repos: new Map(),
    project: null,
    rate: { remaining: 5000, reset: Math.floor(clock / 1000) + 3600 },
    requests: [],
    now: iso,
    tick(seconds = 1) {
      clock += seconds * 1000;
      return iso();
    },
    addRepo(slug) {
      const r: FakeRepo = {
        issues: new Map(),
        pulls: new Map(),
        runs: [],
        private: false,
        description: null,
      };
      gh.repos.set(slug, r);
      return r;
    },
    addIssue(slug, patch = {}) {
      const r = repo(slug);
      const number = Math.max(0, ...r.issues.keys()) + 1;
      const at = gh.tick();
      const issue: FakeIssue = {
        number,
        nodeId: `I_${slug.replace("/", "_")}_${number}`,
        title: `Issue ${number}`,
        body: null,
        state: "open",
        labels: [],
        createdAt: at,
        updatedAt: at,
        creator: gh.login,
        pullRequest: false,
        gone: null,
        ...patch,
      };
      r.issues.set(number, issue);
      return issue;
    },
    editIssue(slug, n, patch) {
      const issue = repo(slug).issues.get(n);
      if (!issue) throw new Error(`fake issue ${n} missing`);
      Object.assign(issue, patch, { updatedAt: patch.updatedAt ?? gh.tick() });
      return issue;
    },
    setProject(p) {
      gh.project = { ...p, items: new Map() };
      return gh.project;
    },
    addProjectItem(issueNumber, optionId) {
      if (!gh.project) throw new Error("fake project missing");
      const item = { itemId: `PVTI_${issueNumber}`, issueNumber, optionId, updatedAt: gh.tick() };
      gh.project.items.set(item.itemId, item);
      return item;
    },
    addRun(slug, run) {
      const at = gh.tick();
      const full = { ...run, createdAt: at, updatedAt: at };
      repo(slug).runs.push(full);
      return full;
    },
    failNext(method, path, status, body = '{"message":"injected"}', headers = {}) {
      failures.push({ method, path, status, body, headers });
    },
    stop: () => server.stop(true),
  };
  const server = Bun.serve({ hostname: "127.0.0.1", port: 0, fetch: (req) => route(gh, failures, req) });
  gh.url = `http://127.0.0.1:${server.port}`;
  return gh;
}
