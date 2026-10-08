import { beforeEach, expect, mock, test } from "bun:test";
import {
  DEFAULT_WORKFLOW,
  KiboError,
  type ProjectSnapshot,
  type ProjectSummary,
  type RpcRequest,
} from "@kibo/schema";
import { act, render } from "@testing-library/react";

const snapshotOf = (id: string): ProjectSnapshot => ({
  meta: { id, name: id, key: "KIB", folder: null, color: "#14B8A6", worktree: null },
  workflow: DEFAULT_WORKFLOW,
  pages: [],
  tickets: [],
  links: [],
  questions: [],
  instances: [],
  rules: [],
  bindings: [],
  nextTicketKey: "KIB-1",
  sync: { shared: false, keyAllocator: "local", role: null, access: "write", members: [] },
});

const pending = new Map<string, (s: ProjectSnapshot) => void>();
let listProjects: () => Promise<ProjectSummary[]> = () => Promise.resolve([]);
let listCalls = 0;

mock.module("../api", () => ({
  client: {
    rpc: (req: RpcRequest) => {
      if (req.method === "getProject") return new Promise((resolve) => pending.set(req.projectId, resolve));
      if (req.method !== "listProjects") return Promise.resolve(null);
      listCalls += 1;
      return listProjects();
    },
    subscribe: () => () => {},
  },
}));

const unmockedModule = "./use-projects?unmocked";
const { useProject, useProjects }: typeof import("./use-projects") = await import(unmockedModule);

const seen: Array<[string | null, string | null]> = [];
function Probe({ projectId }: { projectId: string | null }) {
  const snapshot = useProject(projectId);
  seen.push([projectId, snapshot?.meta.id ?? null]);
  return null;
}

const resolve = (id: string) =>
  act(async () => {
    pending.get(id)?.(snapshotOf(id));
    await new Promise((r) => setTimeout(r, 0));
  });

beforeEach(() => {
  seen.length = 0;
  pending.clear();
  listProjects = () => Promise.resolve([]);
  listCalls = 0;
});

test("useProject never exposes the snapshot of another project", async () => {
  const { rerender } = render(<Probe projectId="a" />);
  await resolve("a");
  expect(seen.at(-1)).toEqual(["a", "a"]);
  rerender(<Probe projectId="b" />);
  rerender(<Probe projectId={null} />);
  expect(seen.filter(([id, got]) => got !== null && got !== id)).toEqual([]);
});

test("useProject ignores a load that lands after leaving the project", async () => {
  const { rerender } = render(<Probe projectId="a" />);
  rerender(<Probe projectId="b" />);
  await resolve("b");
  await resolve("a");
  expect(seen.at(-1)).toEqual(["b", "b"]);
});

const summary: ProjectSummary = {
  ...snapshotOf("a").meta,
  counts: { backlog: 0, todo: 0, in_progress: 0, in_review: 0, blocked: 0, done: 0 },
};
let latest: ReturnType<typeof useProjects> | null = null;
function ListProbe() {
  latest = useProjects();
  return null;
}
const settle = () => act(() => new Promise((r) => setTimeout(r, 0)));

test("useProjects exposes a network failure instead of rejecting, and retry reloads", async () => {
  const failure = new TypeError("Failed to fetch");
  listProjects = () => Promise.reject(failure);
  render(<ListProbe />);
  await settle();
  expect(latest?.projects).toBeNull();
  expect(latest?.error).toBe(failure);
  listProjects = () => Promise.resolve([summary]);
  await act(async () => latest?.retry());
  await settle();
  expect(listCalls).toBe(2);
  expect(latest?.projects).toEqual([summary]);
  expect(latest?.error).toBeNull();
});

test("useProjects leaves UNAUTHORIZED to the global pairing handler", async () => {
  listProjects = () => Promise.reject(new KiboError("UNAUTHORIZED", "no cookie"));
  render(<ListProbe />);
  await settle();
  expect(latest?.projects).toBeNull();
  expect(latest?.error).toBeNull();
});
