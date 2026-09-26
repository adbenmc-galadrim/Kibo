import { beforeEach, expect, mock, test } from "bun:test";
import { DEFAULT_WORKFLOW, type ProjectSnapshot, type RpcRequest } from "@kibo/schema";
import { act, render } from "@testing-library/react";

const snapshotOf = (id: string): ProjectSnapshot => ({
  meta: { id, name: id, key: "KIB", folder: null, color: "#14B8A6" },
  workflow: DEFAULT_WORKFLOW,
  pages: [],
  tickets: [],
  links: [],
  instances: [],
  rules: [],
  bindings: [],
  nextTicketKey: "KIB-1",
});

const pending = new Map<string, (s: ProjectSnapshot) => void>();

mock.module("../api", () => ({
  client: {
    rpc: (req: RpcRequest) =>
      req.method === "getProject"
        ? new Promise((resolve) => pending.set(req.projectId, resolve))
        : Promise.resolve(null),
    subscribe: () => () => {},
  },
}));

const unmockedModule = "./use-projects?unmocked";
const { useProject }: typeof import("./use-projects") = await import(unmockedModule);

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
