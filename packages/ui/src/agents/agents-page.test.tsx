import { beforeEach, expect, mock, test } from "bun:test";
import { KiboError, type RpcRequest, runSubject } from "@kibo/schema";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { frAgentsPage } from "../i18n/fr-agents-page";
import { agentsFixture, configFixture, NOW, profilesFixture, projectsFixture } from "./fixtures";

const calls: RpcRequest[] = [];
let respond: (req: RpcRequest) => Promise<unknown> = () => Promise.resolve(null);

mock.module("../api", () => ({
  client: {
    rpc: (req: RpcRequest) => {
      calls.push(req);
      return respond(req);
    },
  },
}));

const { AgentsPage } = await import("./AgentsPage");
const { ProfileSheet } = await import("./ProfileSheet");

beforeEach(() => {
  localStorage.clear();
  calls.length = 0;
  respond = () => Promise.resolve(null);
});

const show = (onOpenRun: (runId: string) => void = () => {}) =>
  render(
    <AgentsPage
      state={agentsFixture()}
      config={configFixture()}
      projects={projectsFixture}
      now={NOW}
      onOpenRun={onOpenRun}
    />,
  );
const sheet = () => within(screen.getByRole("dialog"));

function NewProfile() {
  const [open, setOpen] = useState(true);
  return open ? (
    <ProfileSheet profile={null} config={configFixture()} hostSlots={3} onClose={() => setOpen(false)} />
  ) : null;
}

const showNew = () => render(<NewProfile />);

test("the page counts places, queue, waiting runs and today's tokens", () => {
  show();
  const stats = within(screen.getByRole("list", { name: "Agents" }));
  expect(stats.getAllByRole("listitem").map((li) => li.textContent)).toEqual([
    "3 places sur 3runs en cours",
    "4runs en file d'attente",
    "1attend une réponse (place libérée)",
    "1,2Mtokens aujourd'huiComptés par Claude Code sur ton abonnement.",
  ]);
});

test("the page leaves its title and actions to the shell header", () => {
  show();
  expect(screen.queryByRole("heading", { level: 1 })).toBeNull();
  expect(screen.queryByRole("button", { name: "Nouveau profil" })).toBeNull();
});

test("profile cards describe each profile", () => {
  show();
  const opus = within(screen.getByRole("article", { name: "opus-dev" }));
  expect(opus.getByText("Claude Opus 5.5 · Claude Code")).toBeTruthy();
  expect(opus.getByText("2 actifs")).toBeTruthy();
  for (const text of ["worktree par ticket", "Modifications acceptées", "2 max", "Sonnet, Haiku"]) {
    expect(opus.getByText(text)).toBeTruthy();
  }
  const sonnet = within(screen.getByRole("article", { name: "sonnet-review" }));
  for (const text of ["dossier isolé", "Lecture seule (plan)", "3 max", "aucun"])
    expect(sonnet.getByText(text)).toBeTruthy();
  expect(sonnet.getByText("Claude Sonnet 5 · Claude Code")).toBeTruthy();
  const haiku = within(screen.getByRole("article", { name: "haiku-tests" }));
  expect(haiku.getByText("Claude Haiku 4.5 · Claude Code")).toBeTruthy();
});

test("the history lists runs newest first with their result", () => {
  show();
  const rows = within(screen.getByRole("table")).getAllByRole("row").slice(1);
  expect(rows.map((r) => r.firstElementChild?.textContent)).toEqual([
    "#60",
    "#51",
    "#50",
    "#47",
    "#46",
    "#45",
    "#44",
    "#43",
    "#42",
    "#41",
    "#40",
    "#39",
  ]);
  expect(rows[0]?.textContent).toContain("En file #4");
  expect(rows[3]?.textContent).toContain("En file #3");
  expect(rows[9]?.textContent).toContain("Attend une réponse");
  expect(rows[11]?.textContent).toContain("Échec : exit code 1");
  expect(rows[10]?.textContent).toContain("41m");
  expect(screen.getByText("41m").className).toContain("font-mono");
});

test("screen 121: a history line opens the run, the filter and the key search narrow it", () => {
  const opened: string[] = [];
  show((id) => opened.push(id));
  expect(screen.getByText("Un run est le travail d'un agent sur un ticket.")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: /^sonnet-review · KIB-11/ }));
  expect(opened).toEqual(["r40"]);
  fireEvent.click(screen.getByRole("radio", { name: "En échec" }));
  expect(screen.getAllByRole("row")).toHaveLength(2);
  expect(screen.getByRole("row", { name: /KIB-7/ })).toBeTruthy();
  fireEvent.click(screen.getByRole("radio", { name: "Tous" }));
  fireEvent.change(screen.getByRole("searchbox", { name: "Clé du ticket" }), { target: { value: "kib-1" } });
  const keys = screen
    .getAllByRole("row")
    .slice(1)
    .map((r) => r.getAttribute("aria-label")?.split(" · ")[0]);
  expect(keys).toEqual(["KIB-18", "KIB-10", "KIB-16", "KIB-12", "KIB-14", "KIB-11"]);
  fireEvent.click(screen.getByRole("radio", { name: "Annulés" }));
  expect(screen.getByText("Aucun run ne correspond à ce filtre.")).toBeTruthy();
});

test("clicking anywhere on a history row opens that run, and only once", async () => {
  const opened: string[] = [];
  show((id) => opened.push(id));
  const user = userEvent.setup();
  await user.click(screen.getByRole("radio", { name: "Tous" }));
  const rows = screen.getAllByRole("row").filter((r) => r.getAttribute("aria-label"));
  expect(rows.length).toBeGreaterThan(2);
  const second = rows[1];
  if (!second) throw new Error("no second row");
  const cells = within(second).getAllByRole("cell");
  await user.click(cells[2] ?? second);
  const expected = agentsFixture().runs.find((r) => runSubject(r) === second.getAttribute("aria-label"))?.id;
  if (!expected) throw new Error("no run for the second row");
  expect(opened).toEqual([expected]);
  await user.click(within(second).getByRole("button"));
  expect(opened).toEqual([expected, expected]);
  for (const row of rows) {
    expect(within(row).getByRole("button").className).not.toContain("after:absolute");
  }
});

const slotsText = () => {
  const { host } = agentsFixture();
  return frAgentsPage.stats.slots(host.used, host.hostSlots);
};
const projectTrigger = () => screen.getByRole("button", { name: "Filtrer par projet" });
const stat = (label: string) =>
  within(screen.getByRole("list", { name: "Agents" }))
    .getAllByRole("listitem")
    .find((li) => li.textContent?.includes(label));

test("screen 162: the project filter narrows queue, waiting, profile counts and history, and is remembered", async () => {
  show();
  const user = userEvent.setup();
  expect(projectTrigger().textContent).toContain("Projet : tous");
  await user.click(projectTrigger());
  await user.click(await screen.findByRole("menuitemradio", { name: "API Facturation" }));
  expect(projectTrigger().textContent).toContain("Projet : API Facturation");
  expect(localStorage.getItem("kibo.agents.project")).toBe("fac");
  expect(screen.queryByText("KIB-7")).toBeNull();
  expect(screen.getByRole("row", { name: /FAC-3/ })).toBeTruthy();
  expect(stat("en file")?.textContent).toBe("1runs en file d'attente");
  expect(stat("attend")?.textContent).toBe("0attend une réponse (place libérée)");
  expect(stat("en cours")?.textContent).toBe(`${slotsText()}runs en cours`);
  expect(stat("tokens")?.textContent).toContain("1,2M");
  expect(within(screen.getByRole("article", { name: "opus-dev" })).queryByText("2 actifs")).toBeNull();
  fireEvent.click(screen.getByRole("radio", { name: "En échec" }));
  expect(screen.getByText("Aucun run ne correspond à ce filtre.")).toBeTruthy();
});

test("a vanished project falls back to all without rewriting the preference", () => {
  localStorage.setItem("kibo.agents.project", "ghost");
  show();
  expect(projectTrigger().textContent).toContain("Projet : tous");
  expect(screen.getAllByRole("row", { name: /KIB-7/ })).toHaveLength(2);
  expect(screen.getByRole("row", { name: /FAC-3/ })).toBeTruthy();
  expect(localStorage.getItem("kibo.agents.project")).toBe("ghost");
});

test("runs without a project only appear under all projects", async () => {
  show();
  const user = userEvent.setup();
  expect(screen.getByRole("row", { name: /Composant Graphique/ })).toBeTruthy();
  await user.click(projectTrigger());
  await user.click(await screen.findByRole("menuitemradio", { name: "Kibo" }));
  expect(screen.queryByRole("row", { name: /Composant Graphique/ })).toBeNull();
  expect(screen.queryByRole("row", { name: /FAC-3/ })).toBeNull();
  expect(stat("en file")?.textContent).toBe("3runs en file d'attente");
});

const subjectOf = (id: string) => {
  const run = agentsFixture().runs.find((r) => r.id === id);
  if (!run) throw new Error(`run ${id} missing`);
  return runSubject(run);
};

test("the history names the project of each run under all projects only", async () => {
  show();
  const user = userEvent.setup();
  expect(screen.getByRole("columnheader", { name: "Projet" })).toBeTruthy();
  expect(screen.getByRole("row", { name: subjectOf("r50") }).textContent).toContain("API Facturation");
  expect(screen.getByRole("row", { name: subjectOf("r39") }).textContent).toContain("Kibo");
  expect(screen.getByRole("row", { name: subjectOf("r51") }).textContent).toContain("—");
  await user.click(projectTrigger());
  await user.click(await screen.findByRole("menuitemradio", { name: "Kibo" }));
  expect(screen.queryByRole("columnheader", { name: "Projet" })).toBeNull();
});

test("a new profile is created with its guidelines", async () => {
  respond = (req) =>
    Promise.resolve(
      req.method === "config" && req.command.method === "createProfile"
        ? { ...req.command.profile, id: "new-id" }
        : null,
    );
  showNew();
  const user = userEvent.setup();
  expect(sheet().getByText("Nouveau profil d'agent")).toBeTruthy();
  await user.type(sheet().getByLabelText("Nom"), "opus-front");
  await user.click(sheet().getByText("Dossier isolé"));
  await user.click(sheet().getByText("Lecture seule (plan)"));
  const parallel = sheet().getByLabelText("Runs en parallèle (profil)");
  await user.clear(parallel);
  await user.type(parallel, "2");
  await user.click(sheet().getByText("Sonnet"));
  expect(
    sheet().getByText(
      "Les sous-agents travaillent dans la place de leur parent. La limite de la machine (3) s'applique en plus.",
    ),
  ).toBeTruthy();
  expect(sheet().getByRole("combobox", { name: "Modèle" }).textContent).toBe("Claude Opus 5.5");
  await user.type(sheet().getByLabelText("Fichier"), "guidelines/front.md");
  await user.click(sheet().getByRole("button", { name: "Ajouter" }));
  expect(sheet().queryByLabelText("Contenu")).toBeNull();
  await user.click(sheet().getByRole("button", { name: "guidelines/front.md" }));
  await user.type(sheet().getByLabelText("Contenu"), "# Front");
  await user.click(sheet().getByRole("button", { name: "Enregistrer guidelines/front.md" }));
  expect(sheet().queryByLabelText("Contenu")).toBeNull();
  await user.click(sheet().getByRole("button", { name: "Créer le profil" }));
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  expect(calls).toEqual([
    {
      method: "config",
      command: {
        method: "createProfile",
        profile: {
          name: "opus-front",
          model: "opus",
          execution: "cli",
          permissionMode: "plan",
          workspace: "isolated",
          maxParallel: 2,
          subagents: ["sonnet"],
          enabled: true,
          allow: [],
        },
      },
    },
    {
      method: "config",
      command: {
        method: "addGuideline",
        owner: { scope: "profile", profileId: "new-id" },
        path: "guidelines/front.md",
        content: "# Front",
      },
    },
  ]);
});

test("a new profile starts with safe defaults", async () => {
  showNew();
  const user = userEvent.setup();
  await user.type(sheet().getByLabelText("Nom"), "haiku-tests");
  await user.click(sheet().getByRole("button", { name: "Créer le profil" }));
  expect(calls[0]).toEqual({
    method: "config",
    command: {
      method: "createProfile",
      profile: {
        name: "haiku-tests",
        model: "opus",
        execution: "cli",
        permissionMode: "default",
        workspace: "worktree",
        maxParallel: 1,
        subagents: [],
        enabled: true,
        allow: [],
      },
    },
  });
});

test("invalid names and guideline paths are refused before any call", async () => {
  showNew();
  const user = userEvent.setup();
  await user.type(sheet().getByLabelText("Nom"), "Opus Front");
  await user.click(sheet().getByRole("button", { name: "Créer le profil" }));
  expect(sheet().getByRole("alert").textContent).toBe("Nom invalide : minuscules, chiffres et tirets.");
  await user.type(sheet().getByLabelText("Fichier"), "../secrets.md");
  await user.click(sheet().getByRole("button", { name: "Ajouter" }));
  expect(sheet().getByRole("alert").textContent).toBe(
    "Chemin invalide : minuscules, chiffres et tirets, terminé par .md.",
  );
  expect(calls).toEqual([]);
});

test("editing saves the whole profile; deleting is confirmed and a busy profile is refused", async () => {
  show();
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: "Modifier le profil opus-dev" }));
  expect(sheet().getByText("Profil opus-dev")).toBeTruthy();
  await user.click(sheet().getByRole("button", { name: "Enregistrer" }));
  const { id, system, ...input } = profilesFixture[0] ?? { id: "", system: false };
  expect([id, system]).toEqual(["opus", false]);
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  expect(calls).toEqual([
    { method: "config", command: { method: "updateProfile", profileId: "opus", patch: input } },
  ]);
  calls.length = 0;
  await user.click(screen.getByRole("button", { name: "Modifier le profil opus-dev" }));
  respond = () => Promise.reject(new KiboError("PROFILE_IN_USE", "opus has active runs"));
  await user.click(sheet().getByRole("button", { name: "Supprimer le profil" }));
  const confirm = within(await screen.findByRole("alertdialog"));
  expect(confirm.getByText("Supprimer le profil opus-dev ?")).toBeTruthy();
  expect(confirm.getByText("Ses runs passés restent dans l'historique.")).toBeTruthy();
  expect(calls).toEqual([]);
  await user.click(confirm.getByRole("button", { name: "Supprimer" }));
  expect(calls).toEqual([{ method: "config", command: { method: "deleteProfile", profileId: "opus" } }]);
  expect((await confirm.findByRole("alert")).textContent).toBe("Ce profil a des runs en cours ou en file.");
});

test("in edit mode a guideline is added to the profile at once", async () => {
  show();
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: "Modifier le profil opus-dev" }));
  await user.type(sheet().getByLabelText("Fichier"), "guidelines/review.md");
  await user.click(sheet().getByRole("button", { name: "Ajouter" }));
  expect(calls).toEqual([
    {
      method: "config",
      command: {
        method: "addGuideline",
        owner: { scope: "profile", profileId: "opus" },
        path: "guidelines/review.md",
        content: "",
      },
    },
  ]);
});

test("enter in the guideline field adds the file without submitting the profile", async () => {
  showNew();
  const user = userEvent.setup();
  await user.type(sheet().getByLabelText("Fichier"), "guidelines/front.md{Enter}");
  expect(sheet().getByText("guidelines/front.md")).toBeTruthy();
  expect(sheet().getByLabelText("Fichier")).toHaveProperty("value", "");
  expect(calls).toEqual([]);
});

test("in edit mode a guideline's content is edited in place", async () => {
  const config = configFixture();
  config.guidelines.push({
    id: "g1",
    owner: { scope: "profile", profileId: "opus" },
    path: "guidelines/review.md",
    content: "# Review",
  });
  render(
    <AgentsPage
      state={agentsFixture()}
      config={config}
      projects={projectsFixture}
      now={NOW}
      onOpenRun={() => {}}
    />,
  );
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: "Modifier le profil opus-dev" }));
  const row = sheet().getByRole("button", { name: "guidelines/review.md" });
  expect(row.getAttribute("aria-expanded")).toBe("false");
  await user.click(row);
  expect(row.getAttribute("aria-expanded")).toBe("true");
  const editor = sheet().getByLabelText("Contenu");
  expect(editor).toHaveProperty("value", "# Review");
  await user.clear(editor);
  await user.type(editor, "# Relecture");
  await user.click(sheet().getByRole("button", { name: "Enregistrer guidelines/review.md" }));
  expect(calls).toEqual([
    {
      method: "config",
      command: {
        method: "updateGuideline",
        owner: { scope: "profile", profileId: "opus" },
        guidelineId: "g1",
        content: "# Relecture",
      },
    },
  ]);
  await waitFor(() => expect(sheet().queryByLabelText("Contenu")).toBeNull());
  respond = () => Promise.reject(new KiboError("NOT_FOUND", "guideline g1"));
  await user.click(row);
  await user.click(sheet().getByRole("button", { name: "Enregistrer guidelines/review.md" }));
  expect((await sheet().findByRole("alert")).textContent).toBe("Impossible d'enregistrer le profil.");
  expect(sheet().getByLabelText("Contenu")).toBeTruthy();
});
