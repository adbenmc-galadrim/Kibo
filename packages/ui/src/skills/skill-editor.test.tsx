import { beforeEach, expect, mock, test } from "bun:test";
import { EditorView } from "@codemirror/view";
import type { RpcRequest, Skill, Topic } from "@kibo/schema";
import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { projectsFixture } from "../agents/fixtures";
import { apiMock } from "../api-mock";
import { pluginSkill, SKILL_TEXT, skillsFixture } from "./fixtures";

const calls: RpcRequest[] = [];
const topics = new Map<Topic, Set<() => void>>();
const emit = (topic: Topic) => {
  for (const listener of topics.get(topic) ?? []) listener();
};
let disk = { content: SKILL_TEXT, hash: "h1" };
let rpc: (req: RpcRequest) => Promise<unknown>;
const base = (req: RpcRequest): Promise<unknown> => {
  switch (req.method) {
    case "skills.read":
      return Promise.resolve(
        req.file
          ? { content: `# ${req.file}\n`, hash: "a1", modifiedAt: 0, file: req.file }
          : { ...disk, modifiedAt: 0, file: "SKILL.md" },
      );
    case "skills.save":
      return Promise.resolve({ ok: true, value: { hash: "h2", modifiedAt: 1 } });
    case "skills.assets":
      return Promise.resolve(skillsFixture()[0]?.files ?? []);
    case "skillReviews.list":
    case "fileVersions.list":
      return Promise.resolve([]);
    case "skills.copy":
      return Promise.resolve({ skill: { ...pluginSkill("brainstorming"), id: req.name }, citedBy: [] });
    default:
      return Promise.resolve({ ok: true });
  }
};

mock.module("../api", () =>
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

const { SkillEditor } = await import("./SkillEditor");

beforeEach(() => {
  calls.length = 0;
  topics.clear();
  disk = { content: SKILL_TEXT, hash: "h1" };
  rpc = base;
});

const porte = skillsFixture()[0] as Skill;
const show = (skill: Skill = porte) => {
  const onBack = mock(() => {});
  const onOpenSkill = mock((_: Skill) => {});
  render(
    <SkillEditor
      skill={skill}
      projects={projectsFixture}
      carried={null}
      onBack={onBack}
      onOpenSkill={onOpenSkill}
    />,
  );
  return { onBack, onOpenSkill };
};
const ready = async () => {
  await screen.findByRole("heading", { level: 2 });
  await waitFor(() => expect(views().length).toBeGreaterThan(0));
};
const views = () =>
  Array.from(document.querySelectorAll(".cm-editor")).flatMap((dom) => {
    const view = dom instanceof HTMLElement ? EditorView.findFromDOM(dom) : null;
    return view ? [view] : [];
  });
const saves = () => calls.filter((c) => c.method === "skills.save");

test("screen 195: the header, the frontmatter in fields and the body in the editor", async () => {
  show();
  await ready();
  expect(screen.getByRole("heading", { level: 2, name: "porte-qualite" })).toBeTruthy();
  expect(screen.getByText("Cet ordinateur")).toBeTruthy();
  expect(screen.getByText("~/.claude/skills/porte-qualite/SKILL.md")).toBeTruthy();
  expect(screen.getByText("7 runs/30 j")).toBeTruthy();
  const description = screen.getByLabelText("Description");
  expect(description instanceof HTMLInputElement && description.value).toBe(
    "Porte qualité d'une branche avant son push.",
  );
  const tools = screen.getByLabelText("allowed-tools");
  expect(tools instanceof HTMLInputElement && tools.value).toBe("Read, Grep");
  expect(screen.getByRole("switch", { name: "disable-model-invocation" }).getAttribute("aria-checked")).toBe(
    "false",
  );
  expect(screen.getByRole("switch", { name: "user-invocable" }).getAttribute("aria-checked")).toBe("true");
  expect(screen.getByText("context: fork")).toBeTruthy();
  await waitFor(() =>
    expect(views().map((v) => v.state.doc.toString())).toEqual([
      "# Porte qualité\nRelis le diff d'une branche avant son push.\n",
    ]),
  );
  expect(screen.getByRole("button", { name: "Enregistrer" }).hasAttribute("disabled")).toBe(true);
});

test("saving the body keeps the frontmatter byte for byte, with the scope and the base hash", async () => {
  show();
  await ready();
  const [view] = views();
  act(() => view?.dispatch({ changes: { from: view.state.doc.length, insert: "Ligne ajoutée.\n" } }));
  await userEvent.setup().click(screen.getByRole("button", { name: "Enregistrer" }));
  await waitFor(() => expect(saves()).toHaveLength(1));
  expect(saves()[0]).toEqual({
    method: "skills.save",
    id: "porte-qualite",
    scope: "user",
    content: `${SKILL_TEXT}Ligne ajoutée.\n`,
    baseHash: "h1",
  });
});

test("a changed field rewrites the frontmatter and keeps the other fields", async () => {
  show();
  await ready();
  const user = userEvent.setup();
  await user.click(screen.getByRole("switch", { name: "disable-model-invocation" }));
  expect(screen.getByText("modifié, non enregistré")).toBeTruthy();
  await user.click(screen.getByRole("button", { name: "Enregistrer" }));
  await waitFor(() => expect(saves()).toHaveLength(1));
  expect(saves()[0]).toMatchObject({
    content: SKILL_TEXT.replace(
      "description: Porte qualité d'une branche avant son push.\nallowed-tools: Read, Grep\n",
      'description: "Porte qualité d\'une branche avant son push."\nallowed-tools: Read, Grep\ndisable-model-invocation: true\n',
    ),
  });
});

test("the files column opens a text file, lists a binary one, adds and removes a file", async () => {
  show();
  await ready();
  const files = within(screen.getByRole("region", { name: "Fichiers" }));
  expect(await files.findByText("exemple.png")).toBeTruthy();
  expect(files.queryByRole("button", { name: /^exemple\.png/ })).toBeNull();
  const user = userEvent.setup();
  await user.click(files.getByRole("button", { name: /^volets\/conventions\.md/ }));
  await waitFor(() =>
    expect(calls.some((c) => c.method === "skills.read" && c.file === "volets/conventions.md")).toBe(true),
  );
  await user.click(screen.getByRole("button", { name: "Ajouter un fichier" }));
  const dialog = within(await screen.findByRole("dialog"));
  await user.type(dialog.getByLabelText("Chemin dans le dossier du skill"), "../x.md");
  expect(dialog.getByRole("alert").textContent).toBe("Chemin invalide : relatif, sans .. ni / au début.");
  await user.clear(dialog.getByLabelText("Chemin dans le dossier du skill"));
  await user.type(dialog.getByLabelText("Chemin dans le dossier du skill"), "notes/a.md");
  await user.click(dialog.getByRole("button", { name: "Ajouter" }));
  await waitFor(() =>
    expect(saves()).toContainEqual({
      method: "skills.save",
      id: "porte-qualite",
      scope: "user",
      file: "notes/a.md",
      content: "",
      baseHash: null,
    }),
  );
  await user.click(screen.getByRole("button", { name: "Supprimer exemple.png" }));
  const confirm = within(await screen.findByRole("alertdialog"));
  await user.click(confirm.getByRole("button", { name: "Supprimer" }));
  await waitFor(() =>
    expect(calls).toContainEqual({
      method: "skills.removeAsset",
      id: "porte-qualite",
      scope: "user",
      file: "exemple.png",
    }),
  );
});

test("the history lists the versions of the open file under the skill's history ref", async () => {
  show();
  await ready();
  await userEvent.setup().click(screen.getByRole("button", { name: "Historique" }));
  await waitFor(() =>
    expect(calls).toContainEqual({
      method: "fileVersions.list",
      kind: "skills",
      ref: "user:porte-qualite",
      file: "SKILL.md",
    }),
  );
});

test("deleting warns that binary files cannot be restored, then deletes with the scope", async () => {
  const { onBack } = show();
  await ready();
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: "Supprimer le skill" }));
  const confirm = within(await screen.findByRole("alertdialog"));
  expect(
    confirm.getByText(/les fichiers binaires \(images, archives…\) ne seront pas restaurables/),
  ).toBeTruthy();
  await user.click(confirm.getByRole("button", { name: "Supprimer" }));
  await waitFor(() =>
    expect(calls).toContainEqual({ method: "skills.delete", id: "porte-qualite", scope: "user" }),
  );
  expect(onBack).toHaveBeenCalled();
});

test("screen 194b: a plugin skill reads only, and Copier pour modifier copies it under a new id", async () => {
  const { onOpenSkill } = show(pluginSkill("brainstorming"));
  await ready();
  expect(screen.getByText("Ce skill vient d'un plugin : il se lit ici, il ne se modifie pas.")).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Enregistrer" })).toBeNull();
  expect(screen.getByLabelText("Description").hasAttribute("readonly")).toBe(true);
  expect(calls.find((c) => c.method === "skills.read")).toMatchObject({
    scope: "plugin",
    plugin: "superpowers",
  });
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: "Copier pour modifier" }));
  const dialog = within(await screen.findByRole("dialog"));
  const name = dialog.getByLabelText("Nom de la copie");
  expect(name instanceof HTMLInputElement && name.value).toBe("brainstorming-perso");
  expect(dialog.getByText("Nouvel identifiant pour les agents")).toBeTruthy();
  await user.click(dialog.getByRole("button", { name: "Copier" }));
  await waitFor(() =>
    expect(calls).toContainEqual({
      method: "skills.copy",
      id: "superpowers:brainstorming",
      to: { source: "user" },
      name: "brainstorming-perso",
    }),
  );
  await waitFor(() => expect(onOpenSkill).toHaveBeenCalled());
});

test("after a copy, the agents citing the original are listed before opening the copy", async () => {
  rpc = (req) =>
    req.method === "skills.copy"
      ? Promise.resolve({
          skill: { ...pluginSkill("brainstorming"), id: "brainstorming-perso" },
          citedBy: ["global:livraison", "project:kibo:chef-orchestre"],
        })
      : base(req);
  const { onOpenSkill } = show(pluginSkill("brainstorming"));
  await ready();
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: "Copier pour modifier" }));
  await user.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "Copier" }));
  const dialog = within(await screen.findByRole("dialog"));
  expect(
    await dialog.findByText(/2 agents autorisent l'original : livraison et chef-orchestre/),
  ).toBeTruthy();
  expect(dialog.getByRole("button", { name: "Ouvrir l'agent livraison" })).toBeTruthy();
  expect(onOpenSkill).not.toHaveBeenCalled();
  await user.click(dialog.getByRole("button", { name: "Ouvrir la copie" }));
  expect(onOpenSkill).toHaveBeenCalled();
});

test("a conflict shows both versions and overwriting saves on the disk hash", async () => {
  rpc = (req) =>
    req.method === "skills.save" && req.baseHash === "h1"
      ? Promise.resolve({ ok: false, conflict: { content: "# Disque\n", hash: "h9", modifiedAt: 1 } })
      : base(req);
  show();
  await ready();
  const user = userEvent.setup();
  await user.type(screen.getByLabelText("Description"), " Vite.");
  await user.click(screen.getByRole("button", { name: "Enregistrer" }));
  const dialog = within(await screen.findByRole("dialog", { name: "Le fichier a changé sur le disque" }));
  await user.click(dialog.getByRole("button", { name: "Écraser avec ma version" }));
  await waitFor(() =>
    expect(saves().map((s) => (s.method === "skills.save" ? s.baseHash : null))).toEqual(["h1", "h9"]),
  );
});

test("a change on disk shows a banner before any save", async () => {
  show();
  await ready();
  disk = { content: `${SKILL_TEXT}Autre.\n`, hash: "h3" };
  await act(async () => emit("skills"));
  expect(await screen.findByText("Modifié sur le disque")).toBeTruthy();
  await userEvent.setup().click(screen.getByRole("button", { name: "Recharger" }));
  await waitFor(() => expect(screen.queryByText("Modifié sur le disque")).toBeNull());
});
