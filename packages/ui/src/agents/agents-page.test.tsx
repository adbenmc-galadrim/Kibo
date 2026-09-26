import { beforeEach, expect, mock, test } from "bun:test";
import { KiboError, type RpcRequest } from "@kibo/schema";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { agentsFixture, configFixture, NOW, profilesFixture } from "./fixtures";

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

beforeEach(() => {
  calls.length = 0;
  respond = () => Promise.resolve(null);
});

const show = () => render(<AgentsPage state={agentsFixture()} config={configFixture()} now={NOW} />);
const sheet = () => within(screen.getByRole("dialog"));

test("the page counts slots, queue, waiting runs and today's tokens", () => {
  show();
  const stats = within(screen.getByRole("list", { name: "Agents" }));
  expect(stats.getAllByRole("listitem").map((li) => li.textContent)).toEqual([
    "3/3créneaux hôte utilisés",
    "3runs en file d'attente",
    "1attend une réponse (créneau libéré)",
    "1,2Mtokens aujourd'hui (abonnement)",
  ]);
});

test("profile cards describe each profile", () => {
  show();
  const opus = within(screen.getByRole("article", { name: "opus-dev" }));
  expect(opus.getByText("Claude Opus · CLI headless")).toBeTruthy();
  expect(opus.getByText("2 actifs")).toBeTruthy();
  for (const text of ["worktree par ticket", "acceptEdits", "2 max", "Sonnet, Haiku"]) {
    expect(opus.getByText(text)).toBeTruthy();
  }
  const sonnet = within(screen.getByRole("article", { name: "sonnet-review" }));
  for (const text of ["dossier isolé", "plan", "3 max", "aucun"]) expect(sonnet.getByText(text)).toBeTruthy();
});

test("the history lists runs newest first with their result", () => {
  show();
  const rows = within(screen.getByRole("table")).getAllByRole("row").slice(1);
  expect(rows.map((r) => r.firstElementChild?.textContent)).toEqual([
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
  expect(rows[0]?.textContent).toContain("En file #3");
  expect(rows[6]?.textContent).toContain("Attend une réponse");
  expect(rows[8]?.textContent).toContain("Échec : exit code 1");
  expect(rows[7]?.textContent).toContain("41m");
});

test("a new profile is created with its guidelines", async () => {
  respond = (req) =>
    Promise.resolve(
      req.method === "config" && req.command.method === "createProfile"
        ? { ...req.command.profile, id: "new-id" }
        : null,
    );
  show();
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: "Nouveau profil" }));
  expect(sheet().getByText("Nouveau profil d'agent")).toBeTruthy();
  await user.type(sheet().getByLabelText("Nom"), "opus-front");
  await user.click(sheet().getByText("Dossier isolé"));
  await user.click(sheet().getByText("plan"));
  const parallel = sheet().getByLabelText("Runs en parallèle (profil)");
  await user.clear(parallel);
  await user.type(parallel, "2");
  await user.click(sheet().getByText("Sonnet"));
  expect(
    sheet().getByText(
      "Les sous-agents utilisent le créneau de leur parent. La limite hôte (3) s'applique en plus.",
    ),
  ).toBeTruthy();
  await user.type(sheet().getByLabelText("Fichier"), "guidelines/front.md");
  await user.type(sheet().getByLabelText("Contenu"), "# Front");
  await user.click(sheet().getByRole("button", { name: "Ajouter" }));
  expect(sheet().getByText("guidelines/front.md")).toBeTruthy();
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
  show();
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: "Nouveau profil" }));
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
      },
    },
  });
});

test("invalid names and guideline paths are refused before any call", async () => {
  show();
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: "Nouveau profil" }));
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

test("editing saves the whole profile; deleting a busy profile is refused", async () => {
  show();
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: "Modifier le profil opus-dev" }));
  expect(sheet().getByText("Profil opus-dev")).toBeTruthy();
  await user.click(sheet().getByRole("button", { name: "Enregistrer" }));
  const { id, ...input } = profilesFixture[0] ?? { id: "" };
  expect(id).toBe("opus");
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  expect(calls).toEqual([
    { method: "config", command: { method: "updateProfile", profileId: "opus", patch: input } },
  ]);
  calls.length = 0;
  await user.click(screen.getByRole("button", { name: "Modifier le profil opus-dev" }));
  respond = () => Promise.reject(new KiboError("PROFILE_IN_USE", "opus has active runs"));
  await user.click(sheet().getByRole("button", { name: "Supprimer le profil" }));
  expect(calls).toEqual([{ method: "config", command: { method: "deleteProfile", profileId: "opus" } }]);
  expect((await sheet().findByRole("alert")).textContent).toBe("Ce profil a des runs en cours ou en file.");
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
