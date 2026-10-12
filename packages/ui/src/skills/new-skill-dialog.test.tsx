import { beforeEach, expect, mock, test } from "bun:test";
import { KiboError, type RpcRequest, type Skill } from "@kibo/schema";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { projectsFixture } from "../agents/fixtures";
import { apiMock } from "../api-mock";
import { skillFixture, skillsFixture } from "./fixtures";

const calls: RpcRequest[] = [];
let createFails = false;

mock.module("../api", () =>
  apiMock({
    client: {
      rpc: (req: RpcRequest) => {
        calls.push(req);
        if (req.method === "skills.list")
          return Promise.resolve({ skills: skillsFixture(), partialWatch: false });
        if (req.method === "skills.create")
          return createFails
            ? Promise.reject(new KiboError("CONFLICT", "exists"))
            : Promise.resolve(skillFixture({ id: req.name, name: req.name }));
        return Promise.resolve(null);
      },
      subscribeTopic: () => () => {},
      subscribe: () => () => {},
    },
  }),
);

const { NewSkillDialog } = await import("./NewSkillDialog");

beforeEach(() => {
  calls.length = 0;
  createFails = false;
});

const show = () => {
  const onCreated = mock((_: Skill) => {});
  render(<NewSkillDialog projects={projectsFixture} onClose={() => {}} onCreated={onCreated} />);
  return { onCreated, user: userEvent.setup() };
};
const fill = async (user: ReturnType<typeof userEvent.setup>, name: string) => {
  await user.type(screen.getByLabelText("Nom"), name);
  await user.type(screen.getByLabelText("Description"), "Prépare une release.");
};

test("a new personal skill shows its file and is created with skills.create", async () => {
  const { onCreated, user } = show();
  await waitFor(() => expect(calls.some((c) => c.method === "skills.list")).toBe(true));
  await fill(user, "release");
  expect(screen.getByText("Fichier : ~/.claude/skills/release/SKILL.md")).toBeTruthy();
  await user.click(screen.getByRole("button", { name: "Créer" }));
  await waitFor(() =>
    expect(calls).toContainEqual({
      method: "skills.create",
      source: "user",
      name: "release",
      description: "Prépare une release.",
    }),
  );
  expect(onCreated.mock.calls[0]?.[0].id).toBe("release");
});

test("a project without a local folder cannot receive a skill", () => {
  show();
  const noFolder = screen.getByRole("radio", { name: /Projet · API Facturation/ });
  expect(noFolder.hasAttribute("disabled") || noFolder.getAttribute("data-disabled") !== null).toBe(true);
});

test("a project skill named like a personal one warns, highlights the name and offers to rename", async () => {
  const { user } = show();
  await waitFor(() => expect(calls.some((c) => c.method === "skills.list")).toBe(true));
  await user.click(screen.getByRole("radio", { name: /Projet · Kibo/ }));
  await fill(user, "porte-qualite");
  expect(
    screen.getByText(
      "Un skill « porte-qualite » existe sur Cet ordinateur : Claude Code chargera le skill personnel à la place.",
    ),
  ).toBeTruthy();
  expect(
    screen.getByText("Fichier : /Users/adam/goinfre/Kibo/.claude/skills/porte-qualite/SKILL.md"),
  ).toBeTruthy();
  const name = screen.getByLabelText("Nom");
  expect(name.className).toContain("border-brand");
  await user.click(screen.getByRole("button", { name: "Choisir un autre nom" }));
  expect(document.activeElement).toBe(name);
  await user.click(screen.getByRole("button", { name: "Créer quand même" }));
  await waitFor(() =>
    expect(calls).toContainEqual({
      method: "skills.create",
      source: "project",
      projectId: "kibo",
      name: "porte-qualite",
      description: "Prépare une release.",
    }),
  );
});

test("an invalid or taken name blocks the creation, a conflict says the skill exists", async () => {
  const { user } = show();
  await waitFor(() => expect(calls.some((c) => c.method === "skills.list")).toBe(true));
  await fill(user, "Mauvais");
  expect(
    screen.getByText("Nom invalide : minuscules, chiffres, . _ - (64 caractères au plus)."),
  ).toBeTruthy();
  expect(screen.getByRole("button", { name: "Créer" }).hasAttribute("disabled")).toBe(true);
  await user.clear(screen.getByLabelText("Nom"));
  await user.type(screen.getByLabelText("Nom"), "apply-review");
  expect(screen.getByText("Un skill de ce nom existe déjà à cette destination.")).toBeTruthy();
  expect(screen.getByRole("button", { name: "Créer" }).hasAttribute("disabled")).toBe(true);
  createFails = true;
  await user.clear(screen.getByLabelText("Nom"));
  await user.type(screen.getByLabelText("Nom"), "neuf");
  await user.click(screen.getByRole("button", { name: "Créer" }));
  expect((await screen.findByRole("alert")).textContent).toBe(
    "Un skill de ce nom existe déjà à cette destination.",
  );
});
