import { beforeEach, expect, mock, test } from "bun:test";
import type { Instance, ProjectSnapshot, RpcRequest, SyncState } from "@kibo/schema";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const calls: RpcRequest[] = [];
let syncState: SyncState = { connected: true, bindings: [], pending: [], errors: [] };
let syncFailure: Error | null = null;
mock.module("../api", () => ({
  client: {
    rpc: async (req: RpcRequest) => {
      calls.push(req);
      if (req.method === "getSyncState") return syncState;
      if (syncFailure) throw syncFailure;
      return { pulled: 0, created: 0, updated: 0, pushed: 0, conflicts: 0 };
    },
    subscribeIntegrations: () => () => undefined,
  },
}));
const { SourceHeader } = await import("./SourceHeader");

const binding = {
  id: "b1",
  adapter: "github-issues" as const,
  config: { repo: "adam/kibo", project: null, importClosed: false, labels: [] },
  createdBy: "adam",
  runner: "adam",
};
const project = { meta: { id: "p1" }, bindings: [binding] } as unknown as ProjectSnapshot;
const instance = { id: "i1", config: { source: { bindingId: "b1" } } } as unknown as Instance;

beforeEach(() => {
  calls.length = 0;
  syncState = { connected: true, bindings: [], pending: [], errors: [] };
  syncFailure = null;
});

test("a synced instance shows its repo and syncs on demand", async () => {
  render(<SourceHeader project={project} instance={instance} />);
  expect(screen.getByText("GitHub · adam/kibo")).toBeDefined();
  expect(screen.getByText("Jamais synchronisé")).toBeDefined();
  await userEvent.setup().click(screen.getByRole("button", { name: "Synchroniser" }));
  expect(calls).toContainEqual({ method: "syncBinding", projectId: "p1", bindingId: "b1" });
});

test("the last sync time and a failed sync are shown", async () => {
  syncState = {
    connected: true,
    bindings: [
      {
        bindingId: "b1",
        repo: "adam/kibo",
        runner: "adam",
        running: false,
        lastPullAt: new Date(2026, 8, 26, 10, 3).getTime(),
        lastError: null,
        imported: 3,
        resumeAt: null,
      },
    ],
    pending: [],
    errors: [],
  };
  syncFailure = new Error("GitHub injoignable");
  render(<SourceHeader project={project} instance={instance} />);
  expect(await screen.findByText("Synchronisé à 10:03")).toBeDefined();
  await userEvent.setup().click(screen.getByRole("button", { name: "Synchroniser" }));
  expect((await screen.findByRole("alert")).textContent).toBe("GitHub injoignable");
});

test("a removed binding is stated plainly", () => {
  render(<SourceHeader project={{ ...project, bindings: [] }} instance={instance} />);
  expect(screen.getByText("Liaison supprimée")).toBeDefined();
});

test("a local instance has no header", () => {
  const { container } = render(<SourceHeader project={project} instance={{ ...instance, config: {} }} />);
  expect(container.textContent).toBe("");
});
