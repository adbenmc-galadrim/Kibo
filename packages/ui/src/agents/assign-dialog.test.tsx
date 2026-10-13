import { beforeEach, expect, mock, test } from "bun:test";
import {
  type AgentSummary,
  type AssignPreview,
  EMPTY_PROGRESS,
  INBOX_ID,
  KiboError,
  type RpcRequest,
  type TicketView,
} from "@kibo/schema";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { apiMock } from "../api-mock";
import { catalogFixture } from "./catalog/fixtures";
import {
  agentsSummaryFixture as AGENTS,
  agentSummaryFixture,
  configFixture,
  kiboProject,
  projectsFixture,
} from "./fixtures";

const calls: RpcRequest[] = [];
const QUEUED: AssignPreview = {
  position: 4,
  reason: { kind: "agent", agentName: "opus-dev", used: 2, total: 2 },
  guidelines: 6,
  session: null,
};
const kiboAgent = (id: "demo" | "generateur"): AgentSummary => ({
  ...agentSummaryFixture(`kibo-${id}`, null, { workspace: "isolated" }),
  ref: `system:${id}`,
  scope: "system",
});
const KIBO_AGENTS = [kiboAgent("demo"), kiboAgent("generateur")];
let preview: () => Promise<unknown> = () => Promise.resolve(QUEUED);
let assign: () => Promise<unknown> = () => Promise.resolve(null);

mock.module("../api", () =>
  apiMock({
    client: {
      rpc: (req: RpcRequest) => {
        calls.push(req);
        if (req.method === "agents.list")
          return Promise.resolve({ agents: catalogFixture(), notices: [], partialWatch: false });
        return req.method === "previewAssign" ? preview() : assign();
      },
      subscribeTopic: () => () => {},
    },
  }),
);

const { AssignDialog, AssignDialogView } = await import("./AssignDialog");

beforeEach(() => {
  calls.length = 0;
  preview = () => Promise.resolve(QUEUED);
  assign = () => Promise.resolve(null);
});

test("assigning a waiting ticket warns, previews the queue and enqueues the run", async () => {
  const onClose = mock(() => {});
  render(
    <AssignDialogView
      project={kiboProject()}
      ticketId="t15"
      config={configFixture()}
      agents={AGENTS}
      onClose={onClose}
    />,
  );
  expect(screen.getByText("Assigner KIB-15 à un agent")).toBeTruthy();
  expect(screen.getByText("Kanban : drag & drop entre colonnes · domaine UI")).toBeTruthy();
  expect(screen.getByRole("status").textContent).toBe(
    "KIB-15 attend KIB-12 (en cours). L'agent peut démarrer, mais son résultat dépendra de « Schéma Loro des tickets (LoroTree) ».",
  );
  expect(screen.queryByRole("alert")).toBeNull();
  expect(screen.getByRole("combobox", { name: "Agent" }).textContent).toBe("opus-dev · Globalopus-dev");
  expect(
    await screen.findByText("attend une place de l'agent opus-dev (2/2) · entrera en file en position #4"),
  ).toBeTruthy();
  expect(screen.getByText("nouveau worktree kib-15 (depuis main)")).toBeTruthy();
  expect(screen.getByText("/Users/adam/goinfre/Kibo/.kibo/worktrees/kib-15")).toBeTruthy();
  expect(screen.getByLabelText("Brief (optionnel)").tagName).toBe("INPUT");
  expect(screen.getByText("acceptEdits")).toBeTruthy();
  expect(screen.getByText("workspace · projet Kibo · domaine UI (6 fichiers .md)")).toBeTruthy();
  const user = userEvent.setup();
  await user.type(screen.getByLabelText("Brief (optionnel)"), "  Garder l'ordre dans le LoroTree. ");
  await user.click(screen.getByRole("button", { name: "Mettre en file" }));
  await waitFor(() => expect(onClose).toHaveBeenCalled());
  expect(calls).toEqual([
    { method: "previewAssign", projectId: "kibo", ticketId: "t15", profileId: "global:opus-dev" },
    { method: "skills.suggest", agentRef: "global:opus-dev", projectId: "kibo" },
    {
      method: "assignAgent",
      projectId: "kibo",
      ticketId: "t15",
      profileId: "global:opus-dev",
      brief: "Garder l'ordre dans le LoroTree.",
      fresh: false,
    },
  ]);
});

test("a dependency still waiting for its key is shown by its label alone", () => {
  const project = kiboProject();
  const pending: TicketView = {
    id: "p1",
    key: null,
    pendingSeq: 1,
    keyLabel: "KIB-…",
    title: "Nouveau récepteur",
    description: "",
    statusId: "blocked",
    blockedReason: "Attente",
    domainId: null,
    assignee: null,
    parentId: null,
    labels: [],
    externalRefs: [],
    progress: { done: 0, total: 0 },
    waitingOn: [],
    openQuestions: 0,
    startable: false,
    agentProgress: EMPTY_PROGRESS,
  };
  const tickets = project.tickets.map((t) => (t.id === "t15" ? { ...t, waitingOn: ["KIB-12", "KIB-…"] } : t));
  render(
    <AssignDialogView
      project={{ ...project, tickets: [...tickets, pending] }}
      ticketId="t15"
      config={configFixture()}
      agents={AGENTS}
      onClose={() => {}}
    />,
  );
  const status = screen.getByRole("status").textContent;
  expect(status).toBe(
    "KIB-15 attend KIB-12 (en cours), KIB-…. L'agent peut démarrer, mais son résultat dépendra de « Schéma Loro des tickets (LoroTree) », KIB-….",
  );
  expect(status).not.toContain("Nouveau récepteur");
  expect(status).not.toContain("bloqué");
});

test("a free slot means the run starts at once", async () => {
  preview = () => Promise.resolve({ position: null, reason: null, guidelines: 2 });
  render(
    <AssignDialogView
      project={kiboProject()}
      ticketId="t14"
      config={configFixture()}
      agents={AGENTS}
      onClose={() => {}}
    />,
  );
  expect(await screen.findByText("place libre · démarre tout de suite")).toBeTruthy();
  expect(screen.queryByText(/attend KIB/)).toBeNull();
});

test("a ticket that already has a run cannot be sent again, and the dialog says why", async () => {
  preview = () => Promise.resolve({ position: null, reason: { kind: "ticket_busy" }, guidelines: 2 });
  render(
    <AssignDialogView
      project={kiboProject()}
      ticketId="t14"
      config={configFixture()}
      agents={AGENTS}
      onClose={() => {}}
    />,
  );
  expect(await screen.findByText("Un run de ce ticket est déjà en cours ou en file.")).toBeTruthy();
  expect(screen.queryByText("place libre · démarre tout de suite")).toBeNull();
  expect(screen.getByRole("button", { name: "Mettre en file" }).hasAttribute("disabled")).toBe(true);
});

test("a run queued meanwhile turns the refusal into the busy message", async () => {
  preview = () => Promise.resolve({ position: null, reason: null, guidelines: 2 });
  assign = () => Promise.reject(new KiboError("CONFLICT", "ticket KIB-14 already has an active run"));
  render(
    <AssignDialogView
      project={kiboProject()}
      ticketId="t14"
      config={configFixture()}
      agents={AGENTS}
      onClose={() => {}}
    />,
  );
  await userEvent.setup().click(screen.getByRole("button", { name: "Mettre en file" }));
  expect((await screen.findByRole("alert")).textContent).toBe(
    "Un run de ce ticket est déjà en cours ou en file.",
  );
});

test("a refused assignment is shown and the dialog stays open", async () => {
  assign = () => Promise.reject(new KiboError("NOT_FOUND", "profile opus not found"));
  const onClose = mock(() => {});
  render(
    <AssignDialogView
      project={kiboProject()}
      ticketId="t14"
      config={configFixture()}
      agents={AGENTS}
      onClose={onClose}
    />,
  );
  await userEvent.setup().click(screen.getByRole("button", { name: "Mettre en file" }));
  expect((await screen.findByRole("alert")).textContent).toBe("Impossible de mettre le run en file.");
  expect(onClose).not.toHaveBeenCalled();
});

test("a failed preview is said, and assignment stays possible", async () => {
  preview = () => Promise.reject(new KiboError("INTERNAL", "boom"));
  render(
    <AssignDialogView
      project={kiboProject()}
      ticketId="t14"
      config={configFixture()}
      agents={AGENTS}
      onClose={() => {}}
    />,
  );
  expect((await screen.findByRole("alert")).textContent).toBe("Impossible d'estimer la file d'attente.");
  expect(screen.getByRole("button", { name: "Mettre en file" }).hasAttribute("disabled")).toBe(false);
});

test("launching from the drawer picks the first open ticket", async () => {
  render(
    <AssignDialogView
      project={kiboProject()}
      ticketId={null}
      config={configFixture()}
      agents={AGENTS}
      onClose={() => {}}
    />,
  );
  expect(screen.getByText("Lancer un agent")).toBeTruthy();
  expect(screen.getByLabelText("Ticket")).toBeTruthy();
  await waitFor(() =>
    expect(calls).toEqual([
      { method: "previewAssign", projectId: "kibo", ticketId: "t12", profileId: "global:opus-dev" },
    ]),
  );
});

test("without an agent or a project the dialog explains what to do", () => {
  const view = render(
    <AssignDialogView
      project={kiboProject()}
      ticketId="t14"
      config={configFixture()}
      agents={[]}
      onClose={() => {}}
    />,
  );
  expect(screen.getByText("Crée d'abord un agent dans la page Agents.")).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Mettre en file" })).toBeNull();
  view.unmount();
  render(
    <AssignDialogView
      project={null}
      ticketId={null}
      config={configFixture()}
      agents={AGENTS}
      onClose={() => {}}
    />,
  );
  expect(screen.getByText("Ouvre un projet pour lancer un agent.")).toBeTruthy();
  expect(calls).toEqual([]);
});

test("the worktree line recalls the project base and the computed path of the ticket branch", async () => {
  const project = kiboProject();
  const worktree = { baseRef: "origin/dev", pathTemplate: "../kibo-{slug}", setup: "pnpm worktree {branch}" };
  const branch = { kind: "git_branch" as const, branch: "feat/drag", base: null };
  const tickets = project.tickets.map((t) => (t.id === "t14" ? { ...t, externalRefs: [branch] } : t));
  render(
    <AssignDialogView
      project={{ ...project, meta: { ...project.meta, worktree }, tickets }}
      ticketId="t14"
      config={configFixture()}
      agents={AGENTS}
      onClose={() => {}}
    />,
  );
  expect(screen.getByText("nouveau worktree feat/drag (depuis origin/dev)")).toBeTruthy();
  expect(screen.getByText("/Users/adam/goinfre/kibo-feat-drag")).toBeTruthy();
  await waitFor(() => expect(calls.length).toBe(1));
});

test("an invalid path template is pointed to the project settings", async () => {
  const project = kiboProject();
  const worktree = { baseRef: "main", pathTemplate: "/tmp/{slug}", setup: null };
  render(
    <AssignDialogView
      project={{ ...project, meta: { ...project.meta, worktree } }}
      ticketId="t14"
      config={configFixture()}
      agents={AGENTS}
      onClose={() => {}}
    />,
  );
  expect(screen.getByText("chemin invalide, voir Modifier le projet")).toBeTruthy();
  await waitFor(() => expect(calls.length).toBe(1));
});

test("without an open ticket the drawer launch explains what to do", () => {
  const project = kiboProject();
  const closed = { ...project, tickets: project.tickets.map((t) => ({ ...t, statusId: "done" as const })) };
  render(
    <AssignDialogView
      project={closed}
      ticketId={null}
      config={configFixture()}
      agents={AGENTS}
      onClose={() => {}}
    />,
  );
  expect(screen.getByText("Aucun ticket ouvert : crée d'abord un ticket à confier à un agent.")).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Mettre en file" })).toBeNull();
  expect(calls).toEqual([]);
});

test("agents of Kibo are never offered for a ticket", () => {
  const config = configFixture();
  const view = render(
    <AssignDialogView
      project={kiboProject()}
      ticketId="t14"
      config={config}
      agents={[...KIBO_AGENTS, ...AGENTS]}
      onClose={() => {}}
    />,
  );
  expect(screen.getByRole("combobox", { name: "Agent" }).textContent).toBe("opus-dev · Globalopus-dev");
  view.unmount();
  render(
    <AssignDialogView
      project={kiboProject()}
      ticketId="t14"
      config={config}
      agents={KIBO_AGENTS}
      onClose={() => {}}
    />,
  );
  expect(screen.getByText("Crée d'abord un agent dans la page Agents.")).toBeTruthy();
});

test("in the demo project the demo agent is offered first and preselected, with its honesty line", async () => {
  render(
    <AssignDialogView
      project={kiboProject()}
      demo
      ticketId="t14"
      config={configFixture()}
      agents={[...KIBO_AGENTS, ...AGENTS]}
      onClose={() => {}}
    />,
  );
  expect(screen.getByRole("combobox", { name: "Agent" }).textContent).toBe(
    "Agent de démonstration · aucun token consommé",
  );
  await userEvent.setup().click(screen.getByRole("button", { name: "Mettre en file" }));
  await waitFor(() =>
    expect(calls.at(-1)).toMatchObject({ method: "assignAgent", ticketId: "t14", profileId: "system:demo" }),
  );
});

test("the demo agent alone is enough in the demo project, and never shows elsewhere", () => {
  const view = render(
    <AssignDialogView
      project={kiboProject()}
      demo
      ticketId="t14"
      config={configFixture()}
      agents={KIBO_AGENTS}
      onClose={() => {}}
    />,
  );
  expect(screen.getByRole("combobox", { name: "Agent" }).textContent).toContain("Agent de démonstration");
  view.unmount();
  render(
    <AssignDialogView
      project={kiboProject()}
      ticketId="t14"
      config={configFixture()}
      agents={KIBO_AGENTS}
      onClose={() => {}}
    />,
  );
  expect(screen.queryByText(/Agent de démonstration/)).toBeNull();
});

const provisional = (): TicketView => ({
  id: "p9",
  key: null,
  pendingSeq: 1,
  keyLabel: "KIB-…",
  title: "Clé en attente",
  description: "",
  statusId: "todo",
  blockedReason: null,
  domainId: null,
  assignee: null,
  parentId: null,
  labels: [],
  externalRefs: [],
  progress: { done: 0, total: 0 },
  waitingOn: [],
  openQuestions: 0,
  startable: false,
  agentProgress: EMPTY_PROGRESS,
});

test("a ticket without its key cannot be sent to an agent", async () => {
  const project = kiboProject();
  render(
    <AssignDialogView
      project={{ ...project, tickets: [...project.tickets, provisional()] }}
      ticketId="p9"
      config={configFixture()}
      agents={AGENTS}
      onClose={() => {}}
    />,
  );
  const submit = screen.getByRole("button", { name: "Mettre en file" }) as HTMLButtonElement;
  expect(submit.disabled).toBe(true);
  expect(submit.closest("[data-key-required]")?.getAttribute("title")).toBe(
    "Clé attribuée à la prochaine synchronisation",
  );
  await Bun.sleep(10);
  expect(calls.filter((c) => c.method === "previewAssign")).toEqual([]);
  expect(screen.queryByRole("alert")).toBeNull();
});

test("the launcher does not offer tickets waiting for their key", async () => {
  const project = kiboProject();
  render(
    <AssignDialogView
      project={{ ...project, tickets: [provisional(), ...project.tickets] }}
      ticketId={null}
      config={configFixture()}
      agents={AGENTS}
      onClose={() => {}}
    />,
  );
  expect(screen.getByRole("combobox", { name: "Ticket" }).textContent).not.toContain("Clé en attente");
  await waitFor(() => expect(calls.some((c) => c.method === "previewAssign")).toBe(true));
  expect(calls.some((c) => c.method === "previewAssign" && c.ticketId === "p9")).toBe(false);
});

test("an inbox ticket cannot go to an agent: the dialog says to file it first", () => {
  const inbox = { ...kiboProject(), meta: { ...kiboProject().meta, id: INBOX_ID, key: "INB", folder: null } };
  render(
    <AssignDialogView
      project={inbox}
      ticketId="t15"
      config={configFixture()}
      agents={AGENTS}
      onClose={() => {}}
    />,
  );
  expect(
    screen.getByText(
      "Rattache d'abord ce ticket à un projet : un agent travaille dans le dossier d'un projet.",
    ),
  ).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Mettre en file" })).toBeNull();
  expect(calls).toEqual([]);
});

const withoutFolder = () => {
  const project = kiboProject();
  return { ...project, meta: { ...project.meta, folder: null } };
};
const NO_FOLDER =
  "Ce projet n'a pas de dossier local : cet agent travaille dans le dépôt du projet. Renseigne le champ Dossier (menu du projet, Modifier…) ou choisis un agent en dossier isolé.";

test("without a local folder a worktree agent is not launchable and the dialog says why", async () => {
  const onEditProject = mock((_projectId: string) => {});
  const onClose = mock(() => {});
  render(
    <AssignDialogView
      project={withoutFolder()}
      ticketId="t14"
      config={configFixture()}
      agents={AGENTS}
      onClose={onClose}
      onEditProject={onEditProject}
    />,
  );
  expect(within(screen.getByRole("status")).getByText(NO_FOLDER)).toBeTruthy();
  expect(screen.queryByText(/nouveau worktree/)).toBeNull();
  expect(screen.getByText("indisponible : projet sans dossier local")).toBeTruthy();
  expect(screen.getByText("File d'attente").nextElementSibling?.textContent).toBe("-");
  const submit = screen.getByRole("button", { name: "Mettre en file" }) as HTMLButtonElement;
  expect(submit.disabled).toBe(true);
  const user = userEvent.setup();
  await user.click(submit);
  await user.click(screen.getByRole("button", { name: "Modifier le projet" }));
  expect(onEditProject).toHaveBeenCalledWith("kibo");
  expect(calls).toEqual([]);
});

test("without a local folder a repo agent is refused too, and the edit button needs a handler", async () => {
  const repo = AGENTS.map((a) => ({ ...a, settings: { ...a.settings, workspace: "repo" as const } }));
  render(
    <AssignDialogView
      project={withoutFolder()}
      ticketId="t14"
      config={configFixture()}
      agents={repo}
      onClose={() => {}}
    />,
  );
  expect(screen.getByRole("status").textContent).toBe(NO_FOLDER);
  expect(screen.queryByText("dossier du projet")).toBeNull();
  expect(screen.queryByRole("button", { name: "Modifier le projet" })).toBeNull();
  expect((screen.getByRole("button", { name: "Mettre en file" }) as HTMLButtonElement).disabled).toBe(true);
  await Bun.sleep(10);
  expect(calls).toEqual([]);
});

test("an empty folder counts as no folder", async () => {
  const project = kiboProject();
  render(
    <AssignDialogView
      project={{ ...project, meta: { ...project.meta, folder: "" } }}
      ticketId="t14"
      config={configFixture()}
      agents={AGENTS}
      onClose={() => {}}
    />,
  );
  expect(within(screen.getByRole("status")).getByText(NO_FOLDER)).toBeTruthy();
  expect((screen.getByRole("button", { name: "Mettre en file" }) as HTMLButtonElement).disabled).toBe(true);
  await Bun.sleep(10);
  expect(calls).toEqual([]);
});

test("switching to an isolated agent lifts the folder warning", async () => {
  const onClose = mock(() => {});
  render(
    <AssignDialogView
      project={withoutFolder()}
      ticketId="t14"
      config={configFixture()}
      agents={AGENTS}
      onClose={onClose}
    />,
  );
  expect(screen.getByRole("status")).toBeTruthy();
  const user = userEvent.setup();
  screen.getByRole("combobox", { name: "Agent" }).focus();
  await user.keyboard("{Enter}");
  await user.click(screen.getByRole("option", { name: /^sonnet-review ·/ }));
  expect(screen.queryByRole("status")).toBeNull();
  expect(await screen.findByText(/entrera en file en position #4/)).toBeTruthy();
  const submit = screen.getByRole("button", { name: "Mettre en file" }) as HTMLButtonElement;
  expect(submit.disabled).toBe(false);
  await user.click(submit);
  await waitFor(() => expect(onClose).toHaveBeenCalled());
  expect(calls.map((c) => c.method)).toEqual(["previewAssign", "assignAgent"]);
});

test("a read-only viewer sees the folder warning without the edit button", async () => {
  const project = withoutFolder();
  render(
    <AssignDialogView
      project={{ ...project, sync: { ...project.sync, access: "read-only" } }}
      ticketId="t14"
      config={configFixture()}
      agents={AGENTS}
      onClose={() => {}}
      onEditProject={() => {}}
    />,
  );
  expect(within(screen.getByRole("status")).getByText(NO_FOLDER)).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Modifier le projet" })).toBeNull();
  await Bun.sleep(10);
});

test("without a local folder an isolated agent still launches", async () => {
  const isolated = AGENTS.filter((a) => a.settings.workspace === "isolated");
  const onClose = mock(() => {});
  render(
    <AssignDialogView
      project={withoutFolder()}
      ticketId="t14"
      config={configFixture()}
      agents={isolated}
      onClose={onClose}
    />,
  );
  expect(screen.queryByRole("status")).toBeNull();
  expect(screen.getByText("dossier isolé")).toBeTruthy();
  await userEvent.setup().click(screen.getByRole("button", { name: "Mettre en file" }));
  await waitFor(() => expect(onClose).toHaveBeenCalled());
  expect(calls.some((c) => c.method === "assignAgent" && c.profileId === "global:sonnet-review")).toBe(true);
});

test("with a local folder no folder warning is shown", async () => {
  render(
    <AssignDialogView
      project={kiboProject()}
      ticketId="t14"
      config={configFixture()}
      agents={AGENTS}
      onClose={() => {}}
    />,
  );
  expect(screen.queryByRole("status")).toBeNull();
  expect(screen.queryByRole("button", { name: "Modifier le projet" })).toBeNull();
  expect((screen.getByRole("button", { name: "Mettre en file" }) as HTMLButtonElement).disabled).toBe(false);
  await waitFor(() => expect(calls.length).toBe(1));
});

const RESUMABLE: AssignPreview = {
  position: null,
  reason: null,
  guidelines: 2,
  session: { runId: "r9", label: "opus-dev-2", turns: 3, tokens: 12_000, resumable: true, reason: null },
};

test("a resumable main session is announced and Start over sends fresh", async () => {
  preview = () => Promise.resolve(RESUMABLE);
  const onClose = mock(() => {});
  render(
    <AssignDialogView
      project={kiboProject()}
      ticketId="t14"
      config={configFixture()}
      agents={AGENTS}
      onClose={onClose}
    />,
  );
  expect(await screen.findByText("reprend opus-dev-2 (3 tours, 12k tokens)")).toBeTruthy();
  const reset = screen.getByRole("checkbox", { name: "Repartir de zéro" });
  expect(reset.getAttribute("aria-checked")).toBe("false");
  const user = userEvent.setup();
  await user.click(reset);
  expect(reset.getAttribute("aria-checked")).toBe("true");
  await user.click(screen.getByRole("button", { name: "Mettre en file" }));
  await waitFor(() => expect(onClose).toHaveBeenCalled());
  expect(calls.at(-1)).toMatchObject({ method: "assignAgent", ticketId: "t14", fresh: true });
});

test("a session that cannot be resumed says why, without the reset box", async () => {
  preview = () =>
    Promise.resolve({
      ...RESUMABLE,
      session: { ...RESUMABLE.session, resumable: false, reason: "transcript_missing" },
    });
  render(
    <AssignDialogView
      project={kiboProject()}
      ticketId="t14"
      config={configFixture()}
      agents={AGENTS}
      onClose={() => {}}
    />,
  );
  expect(await screen.findByText("nouvelle (transcript introuvable)")).toBeTruthy();
  expect(screen.queryByRole("checkbox", { name: "Repartir de zéro" })).toBeNull();
});

test("a ticket without a started run opens a first session", async () => {
  preview = () => Promise.resolve({ ...RESUMABLE, session: null });
  render(
    <AssignDialogView
      project={kiboProject()}
      ticketId="t14"
      config={configFixture()}
      agents={AGENTS}
      onClose={() => {}}
    />,
  );
  expect(await screen.findByText("nouvelle (première session du ticket)")).toBeTruthy();
  expect(screen.queryByRole("checkbox")).toBeNull();
});

test("the dialog lists the agents of the project with scope and description, shadowed ones aside", async () => {
  render(
    <AssignDialog
      project={kiboProject()}
      ticketId="t15"
      config={configFixture()}
      projects={projectsFixture}
      onClose={() => {}}
    />,
  );
  const agent = await screen.findByRole("combobox", { name: "Agent" });
  expect(calls[0]).toEqual({ method: "agents.list", projectId: "kibo" });
  expect(agent.textContent).toBe(
    "opus-dev · GlobalLivre un ticket : lit le ticket, planifie, code en TDD, commite et ouvre la PR.",
  );
  expect(screen.getByText("Opus")).toBeTruthy();
  agent.focus();
  await userEvent.setup().keyboard("{Enter}");
  const options = (await screen.findAllByRole("option")).map((o) => o.textContent?.split("·")[0]?.trim());
  expect(options).toEqual(["opus-dev", "review-pr", "sonnet-dev"]);
  expect(screen.getByRole("option", { name: /^review-pr · Projet · Kibo/ })).toBeTruthy();
});
