import { beforeEach, expect, mock, test } from "bun:test";
import type { AiEvent, RpcRequest, RunState } from "@kibo/schema";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const calls: RpcRequest[] = [];
type RunChangedEvent = { type: "run.changed"; runId: string; state: RunState };
const aiListeners = new Set<(e: AiEvent) => void>();
const runListeners = new Set<(e: RunChangedEvent) => void>();
const connectionListeners = new Set<() => void>();
let online = true;
let answer: (req: RpcRequest) => unknown = () => null;
const ok = {
  available: true,
  reason: null,
  version: "2.1.283",
  loggedIn: true,
  profiles: { assistant: true, generateur: true },
};
mock.module("../api", () => ({
  client: {
    rpc: async (req: RpcRequest) => {
      calls.push(req);
      if (req.method === "getAiStatus") return ok;
      return answer(req);
    },
    subscribeAi: (l: (e: AiEvent) => void) => {
      aiListeners.add(l);
      return () => aiListeners.delete(l);
    },
    onRunChanged: (l: (e: RunChangedEvent) => void) => {
      runListeners.add(l);
      return () => runListeners.delete(l);
    },
    onConnection: (l: () => void) => {
      connectionListeners.add(l);
      return () => connectionListeners.delete(l);
    },
    online: () => online,
  },
}));
mock.module("../state/use-components", () => ({
  useComponents: () => ({ components: [], drafts: [], error: false, reload: () => {} }),
}));
const emit = (e: AiEvent | RunChangedEvent) => {
  if (e.type === "run.changed") for (const l of runListeners) l(e);
  else for (const l of aiListeners) l(e);
};

const { RoleStep } = await import("./RoleStep");
const { StarterDialog } = await import("./StarterDialog");
const { starterRefs } = await import("./catalog-refs");
const { NewProjectDialog } = await import("../dialogs/NewProjectDialog");
const { presetFor, toSelection } = await import("./presets");
const { BUILTIN_COMPONENTS } = await import("../registry");
const { useState } = await import("react");

const available = new Set(["kanban", "tickets", "graph", "notes"]);
const titles = new Map([
  ["kanban", "Kanban"],
  ["tickets", "Tickets"],
  ["graph", "Graphe"],
  ["notes", "Notes"],
]);

function Harness() {
  const [selection, setSelection] = useState(toSelection(presetFor("dev", available)));
  return <RoleStep available={available} titles={titles} selection={selection} onSelection={setSelection} />;
}

const askClaude = async (text: string) => {
  answer = (req) => (req.method === "suggestStarter" ? { runId: "run-9" } : null);
  render(<Harness />);
  const user = userEvent.setup();
  await user.click(screen.getByRole("radio", { name: "Autre" }));
  await user.type(screen.getByLabelText("Décris ton usage en une phrase"), text);
  await user.click(screen.getByRole("button", { name: "Proposer avec Claude" }));
  return user;
};

const addedPages = () =>
  calls.flatMap((c) => (c.method === "command" && c.command.method === "addPage" ? [c.command.title] : []));
const addedInstances = () =>
  calls.flatMap((c) =>
    c.method === "command" && c.command.method === "addInstance" ? [c.command.component] : [],
  );

const creating = (req: RpcRequest) => {
  if (req.method === "createProject")
    return { id: "p9", name: req.name, key: req.key, folder: null, color: req.color };
  if (req.method === "command" && req.command.method === "addPage") {
    if (req.command.title === "Tickets") throw new Error("boom");
    return {
      id: `pg-${req.command.title}`,
      title: req.command.title,
      kind: req.command.kind,
      parentId: null,
    };
  }
  return { id: "i1" };
};

beforeEach(() => {
  calls.length = 0;
  aiListeners.clear();
  runListeners.clear();
  connectionListeners.clear();
  online = true;
  answer = () => null;
  Object.defineProperty(navigator, "onLine", { configurable: true, value: true });
});

test("starterRefs keeps builtins, drops mcp-source and inactive versions, picks the highest", () => {
  const refs = starterRefs(
    BUILTIN_COMPONENTS.map((c) => c.manifest).filter((m) => m.id === "kanban" || m.id === "mcp-source"),
    [
      { id: "burndown", version: "1.2.0", active: true },
      { id: "burndown", version: "1.10.0", active: true },
      { id: "burndown", version: "2.0.0", active: false },
      { id: "sleepy", version: "1.0.0", active: false },
      { id: "mcp-source", version: "2.0.0", active: true },
    ],
  );
  expect([...refs]).toEqual([
    ["kanban", "kanban@1.0.0"],
    ["burndown", "burndown@1.10.0"],
  ]);
});

test("the developer preset is shown at once, without AI", async () => {
  render(<Harness />);
  expect(await screen.findByLabelText("Inclure Tableau de bord")).toBeTruthy();
  expect(screen.getByText("Kanban · Mes tickets · Graphe")).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Proposer avec Claude" })).toBeNull();
  expect(calls.filter((c) => c.method === "suggestStarter")).toEqual([]);
});

test("choosing Designer swaps the preset", async () => {
  render(<Harness />);
  const user = userEvent.setup();
  await user.click(screen.getByRole("radio", { name: "Designer" }));
  expect(screen.getByText("Mes tickets · Notes")).toBeTruthy();
  expect(screen.queryByLabelText("Inclure Graphe")).toBeNull();
});

test("Autre + text asks Claude, shows the queue, then the suggestion", async () => {
  await askClaude("Je suis freelance");
  expect(calls.find((c) => c.method === "suggestStarter")).toEqual({
    method: "suggestStarter",
    role: "other",
    text: "Je suis freelance",
  });
  await screen.findByRole("button", { name: "Annuler" });
  emit({ type: "run.changed", runId: "run-9", state: "queued" });
  expect(await screen.findByText("En file d'attente")).toBeTruthy();
  emit({
    type: "starter.ready",
    runId: "run-9",
    plan: {
      pages: [{ title: "Suivi clients", kind: "dashboard", components: [{ id: "kanban", config: {} }] }],
    },
  });
  expect(await screen.findByText("Proposition de Claude")).toBeTruthy();
  expect((screen.getByLabelText("Nom de la page 1") as HTMLInputElement).value).toBe("Suivi clients");
});

test("the suggestion can be renamed once shown", async () => {
  const user = await askClaude("x");
  await screen.findByRole("button", { name: "Annuler" });
  emit({
    type: "starter.ready",
    runId: "run-9",
    plan: { pages: [{ title: "Suivi", kind: "view", components: [{ id: "kanban", config: {} }] }] },
  });
  await screen.findByText("Proposition de Claude");
  await user.type(screen.getByLabelText("Nom de la page 1"), " clients");
  expect((screen.getByLabelText("Nom de la page 1") as HTMLInputElement).value).toBe("Suivi clients");
});

test("a result emitted before the RPC answers is not lost", async () => {
  answer = (req) => {
    if (req.method !== "suggestStarter") return null;
    emit({
      type: "starter.ready",
      runId: "run-9",
      plan: { pages: [{ title: "Tôt", kind: "view", components: [{ id: "notes", config: {} }] }] },
    });
    return { runId: "run-9" };
  };
  render(<Harness />);
  const user = userEvent.setup();
  await user.click(screen.getByRole("radio", { name: "Autre" }));
  await user.type(screen.getByLabelText("Décris ton usage en une phrase"), "x");
  await user.click(screen.getByRole("button", { name: "Proposer avec Claude" }));
  expect(await screen.findByText("Proposition de Claude")).toBeTruthy();
  expect((screen.getByLabelText("Nom de la page 1") as HTMLInputElement).value).toBe("Tôt");
});

test("a null plan keeps the preset with the unavailable message", async () => {
  await askClaude("x");
  await screen.findByRole("button", { name: "Annuler" });
  emit({ type: "starter.ready", runId: "run-9", plan: null });
  expect(await screen.findByText("Suggestion indisponible, voici le point de départ standard")).toBeTruthy();
  expect(screen.getByLabelText("Inclure Tableau de bord")).toBeTruthy();
});

test("a lost connection while waiting means unavailable", async () => {
  await askClaude("x");
  await screen.findByRole("button", { name: "Annuler" });
  online = false;
  for (const l of connectionListeners) l();
  expect(await screen.findByText("Suggestion indisponible, voici le point de départ standard")).toBeTruthy();
});

test("cancelling while waiting cancels the run", async () => {
  const user = await askClaude("x");
  await user.click(await screen.findByRole("button", { name: "Annuler" }));
  expect(calls.find((c) => c.method === "cancelRun")).toEqual({ method: "cancelRun", runId: "run-9" });
});

test("a refused suggestion means unavailable", async () => {
  answer = (req) => {
    if (req.method === "suggestStarter") throw new Error("AI_UNAVAILABLE");
    return null;
  };
  render(<Harness />);
  const user = userEvent.setup();
  await user.click(screen.getByRole("radio", { name: "Autre" }));
  await user.type(screen.getByLabelText("Décris ton usage en une phrase"), "x");
  await user.click(screen.getByRole("button", { name: "Proposer avec Claude" }));
  expect(await screen.findByText("Suggestion indisponible, voici le point de départ standard")).toBeTruthy();
});

test("offline: the Claude button is disabled with the reason", async () => {
  Object.defineProperty(navigator, "onLine", { configurable: true, value: false });
  render(<Harness />);
  const user = userEvent.setup();
  await user.click(screen.getByRole("radio", { name: "Autre" }));
  await user.type(screen.getByLabelText("Décris ton usage en une phrase"), "x");
  expect(screen.getByRole("button", { name: "Proposer avec Claude" }).hasAttribute("disabled")).toBe(true);
  expect(screen.getByText("Hors ligne")).toBeTruthy();
  expect(screen.queryByText("Via ton abonnement · passe par la file d'attente")).toBeNull();
});

test("the Claude button says it runs on the subscription, through the queue", async () => {
  answer = (req) => (req.method === "suggestStarter" ? { runId: "run-9" } : null);
  render(<Harness />);
  const user = userEvent.setup();
  await user.click(screen.getByRole("radio", { name: "Autre" }));
  await user.type(screen.getByLabelText("Décris ton usage en une phrase"), "x");
  expect(await screen.findByText("Via ton abonnement · passe par la file d'attente")).toBeTruthy();
  await user.click(screen.getByRole("button", { name: "Proposer avec Claude" }));
  await screen.findByRole("button", { name: "Annuler" });
  expect(screen.queryByText("Via ton abonnement · passe par la file d'attente")).toBeNull();
});

test("NewProjectDialog creates the project then the checked pages", async () => {
  answer = (req) => {
    if (req.method === "createProject")
      return { id: "p9", name: req.name, key: req.key, folder: null, color: req.color };
    if (req.method === "command" && req.command.method === "addPage")
      return {
        id: `pg-${req.command.title}`,
        title: req.command.title,
        kind: req.command.kind,
        parentId: null,
      };
    return { id: "i1" };
  };
  const onOpenChange = mock((_: boolean) => {});
  render(<NewProjectDialog open onOpenChange={onOpenChange} count={0} />);
  const user = userEvent.setup();
  await user.click(await screen.findByRole("radio", { name: "Chef·fe de projet" }));
  await user.click(screen.getByLabelText("Inclure Graphe"));
  await user.click(screen.getByRole("button", { name: "Continuer" }));
  expect(screen.getByRole("radio", { name: "Pages conseillées" }).getAttribute("data-state")).toBe("checked");
  await user.type(screen.getByLabelText("Nom"), "Facturation");
  await user.click(screen.getByRole("button", { name: "Créer le projet" }));
  expect(addedPages()).toEqual(["Tableau de bord", "Tickets"]);
  expect(addedInstances()).toEqual(["kanban@1.0.0", "graph@1.0.0", "tickets@1.0.0"]);
  expect(onOpenChange).toHaveBeenCalledWith(false);
});

test("NewProjectDialog Passer creates an empty project", async () => {
  answer = creating;
  render(<NewProjectDialog open onOpenChange={() => {}} count={0} />);
  const user = userEvent.setup();
  await user.click(await screen.findByRole("button", { name: "Passer" }));
  expect(screen.getByRole("radio", { name: "Projet vide" }).getAttribute("data-state")).toBe("checked");
  expect(screen.getByRole("radio", { name: "Pages conseillées" }).hasAttribute("disabled")).toBe(true);
  await user.type(screen.getByLabelText("Nom"), "Vide");
  await user.click(screen.getByRole("button", { name: "Créer le projet" }));
  expect(calls.some((c) => c.method === "createProject")).toBe(true);
  expect(addedPages()).toEqual([]);
});

test("NewProjectDialog Retour goes back to the role step with its choice", async () => {
  render(<NewProjectDialog open onOpenChange={() => {}} count={0} />);
  const user = userEvent.setup();
  await user.click(await screen.findByRole("radio", { name: "Designer" }));
  await user.click(screen.getByRole("button", { name: "Continuer" }));
  await user.click(screen.getByRole("button", { name: "Retour" }));
  expect(screen.getByRole("radio", { name: "Designer" }).getAttribute("data-state")).toBe("checked");
  expect(screen.getByText("Mes tickets · Notes")).toBeTruthy();
});

test("NewProjectDialog keeps the dialog open on a partial creation", async () => {
  answer = creating;
  const onOpenChange = mock((_: boolean) => {});
  render(<NewProjectDialog open onOpenChange={onOpenChange} count={0} />);
  const user = userEvent.setup();
  await user.click(await screen.findByRole("button", { name: "Continuer" }));
  await user.type(screen.getByLabelText("Nom"), "Kibo");
  await user.click(screen.getByRole("button", { name: "Créer le projet" }));
  expect(
    await screen.findByText("Projet créé, mais certaines pages n'ont pas pu être ajoutées."),
  ).toBeTruthy();
  expect(onOpenChange).not.toHaveBeenCalled();
  expect(addedPages()).toEqual(["Tableau de bord", "Kanban", "Tickets", "Graphe", "Notes"]);
  await user.click(screen.getByRole("button", { name: "Ouvrir le projet" }));
  expect(onOpenChange).toHaveBeenCalledWith(false);
  expect(calls.filter((c) => c.method === "createProject")).toHaveLength(1);
});

test("StarterDialog adds the checked pages to the project", async () => {
  answer = creating;
  const onOpenChange = mock((_: boolean) => {});
  render(<StarterDialog projectId="p1" open onOpenChange={onOpenChange} />);
  const user = userEvent.setup();
  await user.click(await screen.findByRole("radio", { name: "Designer" }));
  await user.click(screen.getByRole("button", { name: "Ajouter 3 pages" }));
  expect(addedPages()).toEqual(["Tableau de bord", "Kanban", "Notes"]);
  expect(onOpenChange).toHaveBeenCalledWith(false);
});

test("StarterDialog reports a partial addition in the dialog", async () => {
  answer = creating;
  const onOpenChange = mock((_: boolean) => {});
  render(<StarterDialog projectId="p1" open onOpenChange={onOpenChange} />);
  const user = userEvent.setup();
  await user.click(await screen.findByRole("button", { name: "Ajouter 5 pages" }));
  expect(
    await screen.findByText("Projet créé, mais certaines pages n'ont pas pu être ajoutées."),
  ).toBeTruthy();
  expect(onOpenChange).not.toHaveBeenCalled();
});

test("NewProjectDialog starts over at the role step when reopened", async () => {
  const view = render(<NewProjectDialog open onOpenChange={() => {}} count={0} />);
  const user = userEvent.setup();
  await user.click(await screen.findByRole("button", { name: "Continuer" }));
  view.rerender(<NewProjectDialog open={false} onOpenChange={() => {}} count={0} />);
  view.rerender(<NewProjectDialog open onOpenChange={() => {}} count={0} />);
  expect(await screen.findByRole("button", { name: "Continuer" })).toBeTruthy();
});
