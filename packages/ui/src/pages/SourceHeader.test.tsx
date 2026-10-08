import { beforeEach, expect, mock, test } from "bun:test";
import {
  type Instance,
  KiboError,
  type ProjectSnapshot,
  type RpcRequest,
  type SyncState,
} from "@kibo/schema";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { apiMock } from "../api-mock";

const calls: RpcRequest[] = [];
let syncState: SyncState = { connected: true, bindings: [], pending: [], errors: [] };
let syncFailure: Error | null = null;
mock.module("../api", () =>
  apiMock({
    client: {
      rpc: async (req: RpcRequest) => {
        calls.push(req);
        if (req.method === "getSyncState") return syncState;
        if (req.method === "getSyncStatus")
          return { state: "online", user: { id: "u-adam", name: "Adam" }, projects: [] };
        if (syncFailure) throw syncFailure;
        return { pulled: 0, created: 0, updated: 0, pushed: 0, conflicts: 0 };
      },
      subscribeIntegrations: () => () => undefined,
      subscribeEvents: () => () => undefined,
    },
  }),
);
const { SourceHeader } = await import("./SourceHeader");

const binding = {
  id: "b1",
  adapter: "github-issues" as const,
  config: { repo: "adam/kibo", project: null, importClosed: false, labels: [] },
  createdBy: "adam",
  runner: "adam",
};
const project = {
  meta: { id: "p1" },
  bindings: [binding],
  sync: { shared: false, keyAllocator: "local", role: null, access: "write", members: [] },
} as unknown as ProjectSnapshot;
const instance = { id: "i1", config: { source: { bindingId: "b1" } } } as unknown as Instance;

beforeEach(() => {
  calls.length = 0;
  syncState = { connected: true, bindings: [], pending: [], errors: [] };
  syncFailure = null;
  location.hash = "";
});

const bindingState = (patch: Partial<SyncState["bindings"][number]>): SyncState["bindings"][number] => ({
  bindingId: "b1",
  repo: "adam/kibo",
  runner: "adam",
  running: false,
  lastPullAt: new Date(2026, 8, 26, 10, 3).getTime(),
  lastError: null,
  imported: 3,
  resumeAt: null,
  ...patch,
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
  syncFailure = new KiboError("REMOTE_UNAVAILABLE", "github 502");
  render(<SourceHeader project={project} instance={instance} />);
  expect(await screen.findByText("Synchronisé à 10:03")).toBeDefined();
  await userEvent.setup().click(screen.getByRole("button", { name: "Synchroniser" }));
  expect((await screen.findByRole("alert")).textContent).toBe(
    "GitHub est injoignable pour le moment, nouvel essai automatique.",
  );
});

test("a rate limit shows the local resume time, never the raw error", async () => {
  const resumeAt = new Date(2026, 8, 26, 16, 8).getTime();
  const lastError = { code: "RATE_LIMITED" as const, message: "github paused until 2026-09-26T14:08:50Z" };
  syncState = { connected: true, bindings: [bindingState({ lastError, resumeAt })], pending: [], errors: [] };
  render(<SourceHeader project={project} instance={instance} />);
  expect((await screen.findByRole("alert")).textContent).toBe("Limite GitHub atteinte, reprise à 16:08");
});

test("a disconnected GitHub disables the sync and points to the integrations", async () => {
  syncState = { connected: false, bindings: [bindingState({})], pending: [], errors: [] };
  render(<SourceHeader project={project} instance={instance} />);
  expect(await screen.findByText("GitHub déconnecté")).toBeDefined();
  expect(screen.queryByText("Synchronisé à 10:03")).toBeNull();
  expect(screen.getByRole("button", { name: "Synchroniser" }).hasAttribute("disabled")).toBe(true);
  await userEvent.setup().click(screen.getByRole("button", { name: "Ouvrir les intégrations" }));
  expect(location.hash).toBe("#/settings/integrations");
});

test("a removed binding is stated plainly", () => {
  render(<SourceHeader project={{ ...project, bindings: [] }} instance={instance} />);
  expect(screen.getByText("Liaison supprimée")).toBeDefined();
});

test("a local instance has no header", () => {
  const { container } = render(<SourceHeader project={project} instance={{ ...instance, config: {} }} />);
  expect(container.textContent).toBe("");
});

test("a shared binding run by someone else can be taken over", async () => {
  const shared = {
    ...project,
    sync: { shared: true, keyAllocator: "server", role: "owner", access: "write", members: [] },
    bindings: [{ ...binding, runner: "u-lea" }],
  } as unknown as ProjectSnapshot;
  render(<SourceHeader project={shared} instance={instance} />);
  await userEvent.click(await screen.findByRole("button", { name: "Exécuter la sync sur cette machine" }));
  expect(calls).toContainEqual({ method: "setBindingRunner", projectId: "p1", bindingId: "b1" });
});

test("a read-only project can neither sync nor take over the binding", async () => {
  const readOnly = {
    ...project,
    sync: { shared: true, keyAllocator: "server", role: "viewer", access: "read-only", members: [] },
    bindings: [{ ...binding, runner: "u-lea" }],
  } as unknown as ProjectSnapshot;
  render(<SourceHeader project={readOnly} instance={instance} />);
  await waitFor(() => expect(calls.some((c) => c.method === "getSyncState")).toBe(true));
  expect(screen.getByRole("button", { name: "Synchroniser" }).hasAttribute("disabled")).toBe(true);
  expect(screen.queryByRole("button", { name: "Exécuter la sync sur cette machine" })).toBeNull();
});
