import { beforeEach, expect, mock, test } from "bun:test";
import { EditorView } from "@codemirror/view";
import {
  type Agent,
  type AgentRef,
  KiboError,
  type RpcRequest,
  type Skill,
  systemAgentSettings,
  type Topic,
} from "@kibo/schema";
import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { apiMock } from "../../api-mock";
import { appInfoFixture } from "../../lib/app-info-fixture";
import { agentFixture, catalogFixture, SPEC_BODY } from "../catalog/fixtures";
import { projectsFixture } from "../fixtures";
import { skillGroups } from "./SkillsField";

const calls: RpcRequest[] = [];
const topics = new Map<Topic, Set<() => void>>();
const emit = (topic: Topic) => {
  for (const listener of topics.get(topic) ?? []) listener();
};
const skill = (id: string, source: Skill["source"], description: string): Skill => ({
  id,
  source,
  projectId: source === "project" ? "kibo" : null,
  plugin: source === "plugin" ? { name: "superpowers", version: "6.4.1" } : null,
  name: id.split(":").at(-1) ?? id,
  description,
  path: `/skills/${id}/SKILL.md`,
  file: null,
  problem: null,
  hash: null,
  readOnly: source === "plugin",
  shadowedBy: null,
  files: [],
  usage: { last: null, runs30d: 0 },
  reviews: { open: 0 },
  modifiedAt: null,
});
const SKILLS = [
  skill("porte-qualite", "user", "Porte qualité d'une branche avant son push."),
  skill("apply-review", "user", "Traite les reviews d'une PR."),
  skill("superpowers:brainstorming", "plugin", "Explore l'intention avant un travail créatif."),
];

let agent: Agent = agentFixture();
let rpc: (req: RpcRequest) => Promise<unknown>;
const base = (req: RpcRequest): Promise<unknown> => {
  switch (req.method) {
    case "agents.read":
      return Promise.resolve(agent);
    case "agents.list":
      return Promise.resolve({ agents: catalogFixture(), notices: [], partialWatch: false });
    case "skills.list":
      return Promise.resolve({ skills: SKILLS, partialWatch: false });
    case "agents.save":
      return Promise.resolve({ ok: true, value: { ...agent, hash: "h2" } });
    case "agents.settings":
      return Promise.resolve({ ...agent, settings: { ...agent.settings, ...req.patch } });
    case "agents.rename":
      return Promise.resolve({ ...agent, name: req.name, ref: `global:${req.name}` });
    case "agents.delete":
      return Promise.resolve({ ok: true });
    case "fileVersions.list":
      return Promise.resolve([]);
    case "getAppInfo":
      return Promise.resolve(appInfoFixture("/Users/adam"));
    case "agents.applyPreset":
      return Promise.resolve({
        ...agent,
        settings: {
          ...agent.settings,
          permissionMode: "auto",
          allSubagents: true,
          allow: [...agent.settings.allow, "Bash(pnpm *)"],
          addDirs: ["/Users/adam/.claude/skills"],
        },
      });
    default:
      return Promise.resolve(null);
  }
};

mock.module("../../api", () =>
  apiMock({
    client: {
      rpc: (req: RpcRequest) => {
        calls.push(req);
        return rpc(req);
      },
      subscribeTopic: (topic: Topic, listener: () => void) => {
        const set = topics.get(topic) ?? new Set();
        set.add(listener);
        topics.set(topic, set);
        return () => set.delete(listener);
      },
      subscribe: () => () => {},
    },
  }),
);

const { AgentSheet } = await import("./AgentSheet");

beforeEach(() => {
  calls.length = 0;
  topics.clear();
  agent = agentFixture();
  rpc = base;
});

const show = (over: { startRename?: boolean } = {}) => {
  const onClose = mock(() => {});
  const onRenamed = mock((_: AgentRef) => {});
  render(
    <AgentSheet
      agentRef="global:livraison"
      projects={projectsFixture}
      hostSlots={4}
      startRename={over.startRename ?? false}
      onClose={onClose}
      onRenamed={onRenamed}
    />,
  );
  return { onClose, onRenamed };
};

const ready = () => screen.findByRole("heading", { level: 2, name: "livraison" });
const views = () =>
  Array.from(document.querySelectorAll(".cm-editor")).flatMap((dom) => {
    const view = dom instanceof HTMLElement ? EditorView.findFromDOM(dom) : null;
    return view ? [view] : [];
  });
const saves = () => calls.filter((c) => c.method === "agents.save");
const patches = () => calls.flatMap((c) => (c.method === "agents.settings" ? [c.patch] : []));
const edit = async () => {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText("Description"), " Vite.");
  return user;
};
const section = async (name: RegExp) => {
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name }));
  return user;
};

test("screen 193: the spec comes first, under the path, the scope and the run notice", async () => {
  show();
  await ready();
  expect(screen.getByText("Global")).toBeTruthy();
  expect(
    screen.getByRole("button", { name: "Ouvrir le fichier ~/.claude/agents/livraison.md" }),
  ).toBeTruthy();
  expect(screen.getByText("1 run en cours : les changements s'appliquent à son prochain tour.")).toBeTruthy();
  const description = screen.getByLabelText("Description");
  expect(description instanceof HTMLInputElement && description.value).toBe(
    "Livre un ticket : lit le ticket, planifie, code en TDD, commite et ouvre la PR.",
  );
  expect(screen.getByRole("combobox", { name: "Modèle" }).textContent).toBe("Opus");
  expect(screen.getByText(/^Dans Claude Code :/).textContent).toBe(
    "Dans Claude Code : livraison — Livre un ticket : lit le ticket, planifie, code en TDD, commite et ouvre la PR.",
  );
  await waitFor(() => expect(views().map((v) => v.state.doc.toString())).toEqual([SPEC_BODY]));
  expect(screen.getByRole("button", { name: /^Réglages techniques/ }).getAttribute("aria-expanded")).toBe(
    "false",
  );
  expect(screen.queryByText("modifié, non enregistré")).toBeNull();
});

test("saving sends the whole file with its base hash and keeps the unknown keys", async () => {
  show();
  await ready();
  const user = userEvent.setup();
  const description = screen.getByLabelText("Description");
  await user.clear(description);
  await user.type(description, "Livre un ticket de bout en bout, jusqu'à la PR.");
  expect(screen.getByText("modifié, non enregistré")).toBeTruthy();
  await user.click(screen.getByRole("button", { name: "Enregistrer" }));
  await waitFor(() => expect(saves()).toHaveLength(1));
  expect(saves()[0]).toEqual({
    method: "agents.save",
    ref: "global:livraison",
    baseHash: "h1",
    file: {
      frontmatter: {
        name: "livraison",
        description: "Livre un ticket de bout en bout, jusqu'à la PR.",
        model: "opus",
        skills: ["porte-qualite"],
        extra: "color: orange\nmaxTurns: 80\n",
        extraKeys: ["color", "maxTurns"],
      },
      body: SPEC_BODY,
    },
  });
  await waitFor(() => expect(screen.queryByText("modifié, non enregistré")).toBeNull());
});

test("screen 193e: a conflict shows both versions, reload keeps the draft, overwrite saves on the disk", async () => {
  const disk = "---\nname: livraison\ndescription: Autre\n---\n\n# Disque\n";
  rpc = (req) =>
    req.method === "agents.save" && req.baseHash === "h1"
      ? Promise.resolve({ ok: false, conflict: { content: disk, hash: "h9", modifiedAt: 1 } })
      : base(req);
  show();
  await ready();
  const user = await edit();
  await user.click(screen.getByRole("button", { name: "Enregistrer" }));
  const dialog = within(await screen.findByRole("dialog", { name: "Le fichier a changé sur le disque" }));
  expect(dialog.getByText("Ma version")).toBeTruthy();
  expect(dialog.getByText("Sur le disque")).toBeTruthy();
  await user.click(dialog.getByRole("button", { name: "Écraser avec ma version" }));
  await waitFor(() =>
    expect(saves().map((s) => s.method === "agents.save" && s.baseHash)).toEqual(["h1", "h9"]),
  );
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
});

test("reloading after a conflict takes the disk and keeps nothing silently", async () => {
  rpc = (req) =>
    req.method === "agents.save"
      ? Promise.resolve({ ok: false, conflict: { content: "x", hash: "h9", modifiedAt: 1 } })
      : base(req);
  show();
  await ready();
  const user = await edit();
  await user.click(screen.getByRole("button", { name: "Enregistrer" }));
  agent = agentFixture({ hash: "h9" });
  const dialog = within(await screen.findByRole("dialog"));
  await user.click(dialog.getByRole("button", { name: "Recharger" }));
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  expect(calls.filter((c) => c.method === "agents.read").length).toBeGreaterThan(1);
});

test("a change on disk shows a banner before any save", async () => {
  show();
  await ready();
  agent = agentFixture({ hash: "h2" });
  await act(async () => emit("agent-files"));
  expect(await screen.findByText("Modifié sur le disque")).toBeTruthy();
  await userEvent.setup().click(screen.getByRole("button", { name: "Recharger" }));
  await waitFor(() => expect(screen.queryByText("Modifié sur le disque")).toBeNull());
});

test("a deleted file can be recreated", async () => {
  rpc = (req) =>
    req.method === "agents.save" && req.baseHash !== null
      ? Promise.reject(new KiboError("NOT_FOUND", "gone"))
      : base(req);
  show();
  await ready();
  const user = await edit();
  await user.click(screen.getByRole("button", { name: "Enregistrer" }));
  expect(await screen.findByText("Le fichier de cet agent a disparu du disque.")).toBeTruthy();
  await user.click(screen.getByRole("button", { name: "Recréer" }));
  await waitFor(() => expect(saves().at(-1)).toMatchObject({ baseHash: null }));
});

test("screen 193b: technical settings save on each change and roll back on error", async () => {
  show();
  await ready();
  const user = await section(/^Réglages techniques/);
  expect(screen.getByText("color: orange maxTurns: 80")).toBeTruthy();
  await user.click(screen.getByRole("radio", { name: "Dossier isolé" }));
  await waitFor(() => expect(patches()).toEqual([{ workspace: "isolated" }]));
  rpc = (req) => (req.method === "agents.settings" ? Promise.reject(new Error("refused")) : base(req));
  await user.click(screen.getByRole("radio", { name: "Lecture seule (plan)" }));
  expect(await screen.findByText("Impossible d'enregistrer ce réglage.")).toBeTruthy();
  expect(screen.getByRole("radio", { name: "Lecture seule (plan)" }).getAttribute("aria-checked")).toBe(
    "false",
  );
  await user.click(screen.getByRole("switch", { name: "Activé" }));
  expect(patches().at(-1)).toEqual({ enabled: false });
});

test("screen 210: the Delivery preset updates the settings in place, each field stays editable", async () => {
  show();
  await ready();
  const user = await section(/^Réglages techniques/);
  await user.click(screen.getByRole("button", { name: "Préréglage : Livraison" }));
  await user.click(await screen.findByRole("button", { name: "Appliquer le préréglage" }));
  expect(calls).toContainEqual({ method: "agents.applyPreset", ref: "global:livraison", preset: "delivery" });
  expect(await screen.findByText(/^Préréglage Livraison appliqué à \d\d:\d\d/)).toBeTruthy();
  expect(
    screen
      .getByRole("radio", { name: "Automatique (l'agent décide, sans contournement)" })
      .getAttribute("aria-checked"),
  ).toBe("true");
  expect((screen.getByRole("textbox", { name: "Autorisations" }) as HTMLTextAreaElement).value).toBe(
    "Bash(bun test *)\nBash(pnpm *)",
  );
  const dirs = screen.getByRole("textbox", { name: "Dossiers supplémentaires" }) as HTMLTextAreaElement;
  expect(dirs.value).toBe("~/.claude/skills");
  await user.type(dirs, "\n~/Documents/emis");
  await waitFor(() =>
    expect(patches().at(-1)).toEqual({
      addDirs: ["/Users/adam/.claude/skills", "/Users/adam/Documents/emis"],
    }),
  );
});

test("screen 193c: callable subagents are the global agents, with the generic ones", async () => {
  show();
  await ready();
  const user = await section(/^Sous-agents appelables/);
  const box = within(screen.getByRole("group", { name: "Sous-agents appelables" }));
  const options = box.getAllByRole("checkbox").map((c) => c.getAttribute("aria-label"));
  expect(options).toEqual([
    "opus-dev",
    "review-pr",
    "sonnet-dev",
    "ux-audit",
    "Sous-agents génériques de Claude Code",
  ]);
  expect(box.getByRole("checkbox", { name: "ux-audit" }).hasAttribute("disabled")).toBe(true);
  expect(box.getByText("Fichier illisible : non appelable.")).toBeTruthy();
  await user.click(box.getByRole("checkbox", { name: "opus-dev" }));
  await waitFor(() => expect(patches().at(-1)).toEqual({ subagents: ["global:opus-dev"] }));
  await user.click(box.getByRole("checkbox", { name: "Sous-agents génériques de Claude Code" }));
  await waitFor(() => expect(patches().at(-1)).toEqual({ genericSubagents: false }));
});

test("screen 193c: allowed skills are all or a searched list, with the preloaded ones", async () => {
  show();
  await ready();
  const user = await section(/^Skills autorisés/);
  expect(screen.getByText(/Préchargés par le fichier :/).textContent).toContain("porte-qualite");
  await user.click(screen.getByRole("radio", { name: "Liste" }));
  await waitFor(() => expect(patches().at(-1)).toEqual({ skills: { mode: "list", ids: [] } }));
  await user.type(screen.getByRole("searchbox", { name: "Rechercher un skill…" }), "brain");
  const list = within(screen.getByRole("group", { name: "Skills autorisés" }));
  expect(list.getAllByRole("checkbox").map((c) => c.getAttribute("aria-label"))).toEqual([
    "superpowers:brainstorming",
  ]);
  expect(list.getByText("Plugins")).toBeTruthy();
  await user.click(list.getByRole("checkbox", { name: "superpowers:brainstorming" }));
  await waitFor(() =>
    expect(patches().at(-1)).toEqual({ skills: { mode: "list", ids: ["superpowers:brainstorming"] } }),
  );
});

test("a Kibo agent shows its fixed settings greyed with the reason and cannot be deleted", async () => {
  agent = agentFixture({
    ref: "system:generateur",
    scope: "system",
    name: "kibo-generateur",
    settings: systemAgentSettings("generateur", {}),
  });
  render(
    <AgentSheet
      agentRef="system:generateur"
      projects={projectsFixture}
      hostSlots={4}
      startRename={false}
      onClose={() => {}}
      onRenamed={() => {}}
    />,
  );
  await screen.findByRole("heading", { level: 2, name: "kibo-generateur" });
  expect(screen.queryByRole("button", { name: "Supprimer l'agent" })).toBeNull();
  expect(screen.queryByRole("button", { name: "Renommer" })).toBeNull();
  await section(/^Réglages techniques/);
  expect(screen.getByText("Agent de Kibo : ces réglages sont fixés par Kibo.")).toBeTruthy();
  expect(screen.getByRole("radio", { name: "Dossier isolé" }).hasAttribute("disabled")).toBe(true);
  expect(screen.getByRole("switch", { name: "Activé" }).hasAttribute("disabled")).toBe(false);
  expect(screen.queryByRole("button", { name: "Préréglage : Livraison" })).toBeNull();
});

test("renaming refuses a vague name and follows the new reference", async () => {
  const { onRenamed } = show({ startRename: true });
  const user = userEvent.setup();
  const dialog = within(await screen.findByRole("dialog", { name: "Renommer livraison" }));
  const field = dialog.getByLabelText("Nouveau nom");
  await user.clear(field);
  await user.type(field, "opus-dev");
  expect(
    dialog.getByText("Nom peu parlant : dis ce que fait l'agent (review-pr, livraison-front)"),
  ).toBeTruthy();
  expect(dialog.getByRole("button", { name: "Renommer" }).hasAttribute("disabled")).toBe(true);
  await user.clear(field);
  await user.type(field, "livraison-front");
  await user.click(dialog.getByRole("button", { name: "Renommer" }));
  await waitFor(() => expect(onRenamed).toHaveBeenCalledWith("global:livraison-front"));
  expect(calls).toContainEqual({ method: "agents.rename", ref: "global:livraison", name: "livraison-front" });
});

test("deleting asks first and explains an agent in use", async () => {
  rpc = (req) =>
    req.method === "agents.delete" ? Promise.reject(new KiboError("AGENT_IN_USE", "busy")) : base(req);
  show();
  await ready();
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: "Supprimer l'agent" }));
  const dialog = within(await screen.findByRole("alertdialog"));
  await user.click(dialog.getByRole("button", { name: "Supprimer" }));
  expect(await dialog.findByText("Cet agent a des runs en cours ou en file.")).toBeTruthy();
});

test("the history opens the versions of this agent", async () => {
  show();
  await ready();
  await userEvent.setup().click(screen.getByRole("button", { name: "Historique" }));
  await waitFor(() =>
    expect(calls).toContainEqual({ method: "fileVersions.list", kind: "agents", ref: "global:livraison" }),
  );
});

test("a project skill masked by a personal one of the same name is offered once", () => {
  const personal = skill("brainstorming", "user", "Explore une idée");
  const masked = {
    ...skill("brainstorming", "project", "Brainstorm du projet"),
    shadowedBy: "brainstorming",
  };
  const groups = skillGroups([personal, masked], "", projectsFixture);
  expect(groups.flatMap((g) => g.skills)).toEqual([personal]);
});
