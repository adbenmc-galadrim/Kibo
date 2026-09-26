import { beforeEach, expect, mock, test } from "bun:test";
import { type IntegrationEvent, KiboError, type RpcRequest } from "@kibo/schema";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const calls: RpcRequest[] = [];
let listener: ((e: IntegrationEvent) => void) | null = null;
let connected = true;
let lastError: { code: string; message: string } | null = null;
let syncStateFails = false;
let running = false;
let createFails: KiboError | null = null;
const binding = {
  id: "b1",
  adapter: "github-issues",
  config: { repo: "adam/kibo", project: null, importClosed: false, labels: ["bug"] },
  createdBy: "adam",
  runner: "adam",
};
const replies: Record<string, () => unknown> = {
  getGithubConnectOptions: () => ({ ghAvailable: true, ghLogin: "adam", mode: connected ? "gh" : null }),
  listGithubRepos: () => [
    { fullName: "adam/kibo", private: false, description: null },
    { fullName: "adam/site", private: true, description: null },
  ],
  listGithubProjects: () => [],
  createBinding: () => {
    if (createFails) throw createFails;
    return binding;
  },
  command: () => ({ id: "i1" }),
  listComponents: () => [],
  listDrafts: () => [],
  getSyncState: () => {
    if (syncStateFails) throw new Error("daemon unreachable");
    return syncState();
  },
};

const syncState = () => ({
  connected: true,
  bindings: [
    {
      bindingId: "b1",
      repo: "adam/kibo",
      runner: "adam",
      running,
      lastPullAt: 1,
      lastError,
      imported: 12,
      resumeAt: null,
    },
  ],
  pending: [],
  errors: [],
});

mock.module("../../api", () => ({
  client: {
    rpc: async (req: RpcRequest) => {
      calls.push(req);
      return replies[req.method]?.() ?? null;
    },
    subscribe: () => () => undefined,
    subscribeIntegrations: (l: (e: IntegrationEvent) => void) => {
      listener = l;
      return () => {
        listener = null;
      };
    },
  },
}));

const { AddComponentDialog } = await import("../AddComponentDialog");
const page = { id: "pg1", title: "Vue", kind: "view", parentId: null } as const;

beforeEach(() => {
  calls.length = 0;
  listener = null;
  connected = true;
  lastError = null;
  syncStateFails = false;
  running = false;
  createFails = null;
});

async function addSyncedKanban(onOpenChange: (o: boolean) => void, linked = new Map<string, string>()) {
  render(
    <AddComponentDialog
      projectId="p1"
      page={page}
      taken={[]}
      open
      onOpenChange={onOpenChange}
      linked={linked}
    />,
  );
  const user = userEvent.setup();
  await user.click(screen.getByRole("radio", { name: "Kanban" }));
  await user.click(await screen.findByRole("radio", { name: "Synchronisée · GitHub Issues" }));
  await user.click(await screen.findByRole("radio", { name: "adam/kibo" }));
  await user.click(screen.getByRole("button", { name: "Ajouter et synchroniser" }));
  await act(async () =>
    listener?.({ type: "sync", projectId: "p1", bindingId: "b1", imported: 0, running: false }),
  );
  return user;
}

test("a synced Kanban creates the binding, the instance, then shows progress", async () => {
  const onOpenChange = mock((_: boolean) => {});
  render(<AddComponentDialog projectId="p1" page={page} taken={[]} open onOpenChange={onOpenChange} />);
  const user = userEvent.setup();
  await user.click(screen.getByRole("radio", { name: "Kanban" }));
  await user.click(await screen.findByRole("radio", { name: "Synchronisée · GitHub Issues" }));
  await user.type(await screen.findByPlaceholderText("Filtrer les dépôts…"), "kibo");
  await user.click(await screen.findByRole("radio", { name: "adam/kibo" }));
  expect(screen.queryByRole("radio", { name: "adam/site" })).toBeNull();
  await user.type(screen.getByLabelText("Filtrer par libellés"), "bug");
  await user.click(screen.getByRole("button", { name: "Ajouter et synchroniser" }));
  expect(calls.filter((c) => c.method === "createBinding" || c.method === "command")).toEqual([
    {
      method: "createBinding",
      projectId: "p1",
      config: { repo: "adam/kibo", project: null, importClosed: false, labels: ["bug"] },
    },
    {
      method: "command",
      projectId: "p1",
      command: {
        method: "addInstance",
        pageId: "pg1",
        component: "kanban@1.0.0",
        config: { source: { bindingId: "b1" } },
      },
    },
  ]);
  act(() => listener?.({ type: "sync", projectId: "p1", bindingId: "b1", imported: 12, running: true }));
  expect(await screen.findByText("Synchronisation… 12 issues importées")).toBeDefined();
  act(() => listener?.({ type: "sync", projectId: "p1", bindingId: "b1", imported: 12, running: false }));
  await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
});

test("without a GitHub account the synced source explains how to connect", async () => {
  connected = false;
  render(<AddComponentDialog projectId="p1" page={page} taken={[]} open onOpenChange={() => {}} />);
  const user = userEvent.setup();
  await user.click(screen.getByRole("radio", { name: "Kanban" }));
  expect(
    await screen.findByText("Connecte GitHub dans Paramètres › Intégrations pour synchroniser."),
  ).toBeDefined();
  expect(screen.getByRole("button", { name: "Ouvrir les intégrations" })).toBeDefined();
  expect(screen.getByRole("radio", { name: "Synchronisée · GitHub Issues" }).hasAttribute("disabled")).toBe(
    true,
  );
});

test("components that do not show tickets have no source choice", async () => {
  render(<AddComponentDialog projectId="p1" page={page} taken={[]} open onOpenChange={() => {}} />);
  const user = userEvent.setup();
  await user.click(screen.getByRole("radio", { name: "Graphe de dépendances" }));
  expect(screen.queryByText("Source")).toBeNull();
  expect(calls.some((c) => c.method === "getGithubConnectOptions")).toBe(false);
});

test("a failed first sync is explained in French and can be retried", async () => {
  lastError = { code: "REMOTE_NOT_FOUND", message: "github 404: Not Found" };
  const onOpenChange = mock((_: boolean) => {});
  const user = await addSyncedKanban(onOpenChange);
  expect((await screen.findByRole("alert")).textContent).toBe(
    "La première synchronisation a échoué : GitHub a répondu 404, dépôt adam/kibo introuvable pour ce compte.",
  );
  expect(onOpenChange).not.toHaveBeenCalled();
  lastError = null;
  await user.click(screen.getByRole("button", { name: "Réessayer" }));
  expect(calls).toContainEqual({ method: "syncBinding", projectId: "p1", bindingId: "b1" });
  await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
  expect(calls.filter((c) => c.method === "createBinding")).toHaveLength(1);
});

test("a first sync that ended before the dialog listened still closes it", async () => {
  const onOpenChange = mock((_: boolean) => {});
  render(<AddComponentDialog projectId="p1" page={page} taken={[]} open onOpenChange={onOpenChange} />);
  const user = userEvent.setup();
  await user.click(screen.getByRole("radio", { name: "Kanban" }));
  await user.click(await screen.findByRole("radio", { name: "Synchronisée · GitHub Issues" }));
  await user.click(await screen.findByRole("radio", { name: "adam/kibo" }));
  await user.click(screen.getByRole("button", { name: "Ajouter et synchroniser" }));
  await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
});

test("a running first sync shows a spinner until its end is heard", async () => {
  running = true;
  const onOpenChange = mock((_: boolean) => {});
  const { rerender } = render(
    <AddComponentDialog projectId="p1" page={page} taken={[]} open onOpenChange={onOpenChange} />,
  );
  const user = userEvent.setup();
  await user.click(screen.getByRole("radio", { name: "Kanban" }));
  await user.click(await screen.findByRole("radio", { name: "Synchronisée · GitHub Issues" }));
  await user.click(await screen.findByRole("radio", { name: "adam/kibo" }));
  await user.click(screen.getByRole("button", { name: "Ajouter et synchroniser" }));
  const status = await screen.findByRole("status");
  expect(status.textContent).toBe("Synchronisation… 12 issues importées");
  expect(status.querySelector(".animate-spin")).not.toBeNull();
  expect(onOpenChange).not.toHaveBeenCalled();
  rerender(
    <AddComponentDialog
      projectId="p1"
      page={page}
      taken={[]}
      open
      onOpenChange={onOpenChange}
      linked={new Map([["adam/kibo", "Vue"]])}
    />,
  );
  expect(screen.queryByText("déjà synchronisé")).toBeNull();
  expect(screen.queryByText("Ce dépôt est déjà synchronisé dans ce projet par Vue.")).toBeNull();
  running = false;
  act(() => listener?.({ type: "sync", projectId: "p1", bindingId: "b1", imported: 12, running: false }));
  await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
});

test("a repo already synced in the project is flagged and cannot be bound twice", async () => {
  render(
    <AddComponentDialog
      projectId="p1"
      page={page}
      taken={[]}
      open
      onOpenChange={() => {}}
      linked={new Map([["adam/kibo", "Kanban GitHub"]])}
    />,
  );
  const user = userEvent.setup();
  await user.click(screen.getByRole("radio", { name: "Kanban" }));
  await user.click(await screen.findByRole("radio", { name: "Synchronisée · GitHub Issues" }));
  expect(await screen.findByText("déjà synchronisé")).toBeDefined();
  await user.click(await screen.findByRole("radio", { name: "adam/kibo" }));
  expect(screen.getByText("Ce dépôt est déjà synchronisé dans ce projet par Kanban GitHub.")).toBeDefined();
  expect(screen.getByRole("button", { name: "Ajouter et synchroniser" }).hasAttribute("disabled")).toBe(true);
});

test("a binding refused as a duplicate by the daemon is explained", async () => {
  createFails = new KiboError("CONFLICT", "adam/kibo is already bound in this project");
  const onOpenChange = mock((_: boolean) => {});
  await addSyncedKanban(onOpenChange);
  expect((await screen.findByRole("alert")).textContent).toBe(
    "Ce dépôt est déjà synchronisé dans ce projet par GitHub Issues & Projects.",
  );
  expect(calls.some((c) => c.method === "command")).toBe(false);
  expect(onOpenChange).not.toHaveBeenCalled();
});

test("an unreadable sync state is shown, never swallowed", async () => {
  syncStateFails = true;
  const onOpenChange = mock((_: boolean) => {});
  await addSyncedKanban(onOpenChange);
  expect((await screen.findByRole("alert")).textContent).toBe("Une erreur est survenue.");
  expect(onOpenChange).not.toHaveBeenCalled();
});
