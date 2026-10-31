import { beforeEach, expect, mock, test } from "bun:test";
import { DEFAULT_WORKFLOW, type ProjectSnapshot, type RpcRequest } from "@kibo/schema";
import { act, render, waitFor } from "@testing-library/react";
import { apiMock } from "../api-mock";

const snapshotOf = (id: string, name: string): ProjectSnapshot => ({
  meta: {
    id,
    name,
    key: "SILO",
    folder: null,
    color: "#14B8A6",
    worktree: null,
    storybook: null,
    delivery: null,
    tracking: null,
    description: null,
    client: null,
  },
  workflow: DEFAULT_WORKFLOW,
  pages: [],
  tickets: [],
  links: [],
  questions: [],
  questionRecipients: [],
  instances: [],
  rules: [],
  bindings: [],
  nextTicketKey: "SILO-1",
  sprints: [],
});

let getProjectCalls = 0;
let currentName = "before";
const projectListeners = new Set<(id: string | null) => void>();

mock.module("../api", () =>
  apiMock({
    client: {
      rpc: (req: RpcRequest) => {
        if (req.method !== "getProject") return Promise.resolve(null);
        getProjectCalls += 1;
        return Promise.resolve(snapshotOf(req.projectId, currentName));
      },
      subscribe: (listener: (id: string | null) => void) => {
        projectListeners.add(listener);
        return () => projectListeners.delete(listener);
      },
    },
  }),
);

const useProjectsModule = "./use-projects?counted";
const useSnapshotsModule = "./use-snapshots?counted";
const { useProject }: typeof import("./use-projects") = await import(useProjectsModule);
const { useSnapshots }: typeof import("./use-snapshots") = await import(useSnapshotsModule);
const { projectStore } = await import("./project-store");

const seen = { project: "", snapshots: "" };
const SILO = ["silo"];

function Consumers({ projectId }: { projectId: string | null }) {
  seen.project = useProject(projectId)?.meta.name ?? "";
  seen.snapshots = useSnapshots(SILO).get("silo")?.meta.name ?? "";
  return null;
}

const settle = () => act(() => new Promise<void>((r) => setTimeout(r, 0)));
const pastGroupingWindow = () => act(() => new Promise<void>((r) => setTimeout(r, 130)));

beforeEach(() => {
  projectStore.reset();
  getProjectCalls = 0;
  currentName = "before";
});

test("useProject and useSnapshots share one getProject until an event", async () => {
  const first = render(<Consumers projectId="silo" />);
  await waitFor(() => expect(seen.project).toBe("before"));
  await waitFor(() => expect(seen.snapshots).toBe("before"));
  expect(getProjectCalls).toBe(1);

  first.unmount();
  const second = render(<Consumers projectId="silo" />);
  second.rerender(<Consumers projectId={null} />);
  second.rerender(<Consumers projectId="silo" />);
  await settle();
  expect(getProjectCalls).toBe(1);
  expect(seen.project).toBe("before");

  currentName = "after";
  expect(projectListeners.size).toBeGreaterThan(0);
  for (const listener of [...projectListeners]) listener("silo");
  await pastGroupingWindow();
  expect(getProjectCalls).toBe(2);
  expect(seen.project).toBe("after");
  expect(seen.snapshots).toBe("after");
  second.unmount();
});
