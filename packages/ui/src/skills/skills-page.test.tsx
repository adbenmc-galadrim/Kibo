import { beforeEach, expect, mock, test } from "bun:test";
import type { RpcRequest, Skill, Topic } from "@kibo/schema";
import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { projectsFixture } from "../agents/fixtures";
import { apiMock } from "../api-mock";
import { SKILL_TEXT, skillFixture, skillsFixture } from "./fixtures";

let listed: Skill[] = skillsFixture();

const calls: RpcRequest[] = [];
const topics = new Map<Topic, Set<() => void>>();
const emit = (topic: Topic) => {
  for (const listener of topics.get(topic) ?? []) listener();
};

mock.module("../api", () =>
  apiMock({
    client: {
      rpc: (req: RpcRequest) => {
        calls.push(req);
        switch (req.method) {
          case "skills.list":
            return Promise.resolve({ skills: listed, partialWatch: false });
          case "skills.read":
            return Promise.resolve({ content: SKILL_TEXT, hash: "h1", modifiedAt: 0, file: "SKILL.md" });
          case "skills.assets":
          case "skillReviews.list":
            return Promise.resolve([]);
          default:
            return Promise.resolve(null);
        }
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

const { SkillsPage } = await import("./SkillsPage");

beforeEach(() => {
  localStorage.clear();
  listed = skillsFixture();
  calls.length = 0;
  topics.clear();
});

const lists = () => calls.filter((c) => c.method === "skills.list").length;

test("screen 194: groups by source, each row with its notes, its usage and its badges", async () => {
  render(<SkillsPage projects={projectsFixture} />);
  const computer = await screen.findByRole("region", { name: "Cet ordinateur" });
  const rows = within(computer).getAllByRole("button", { name: /^Ouvrir le skill/ });
  expect(rows.map((r) => r.getAttribute("aria-label"))).toEqual([
    "Ouvrir le skill apply-review",
    "Ouvrir le skill porte-qualite",
  ]);
  const porte = within(computer).getByRole("button", { name: "Ouvrir le skill porte-qualite" });
  expect(within(porte).getByText("2 notes").closest(".text-brand-strong")).toBeTruthy();
  expect(within(porte).getByText("utilisé il y a 2 j · 7 runs/30 j")).toBeTruthy();
  expect(within(porte).getByText("Porte qualité d'une branche avant son push.")).toBeTruthy();
  const kibo = screen.getByRole("region", { name: "Projet · Kibo" });
  expect(within(kibo).getByText("masqué")).toBeTruthy();
  expect(within(kibo).getByText("masqué par le skill personnel du même nom")).toBeTruthy();
  const plugin = screen.getByRole("region", { name: "superpowers 6.4.1" });
  await userEvent.setup().click(within(plugin).getByRole("button", { name: "superpowers 6.4.1" }));
  expect(within(plugin).getAllByText("lecture seule")).toHaveLength(2);
  expect(screen.queryByRole("region", { name: /API Facturation/ })).toBeNull();
  expect(screen.getByText("3 notes à traiter")).toBeTruthy();
});

test("the search filters the rows and a skills change reloads the list", async () => {
  render(<SkillsPage projects={projectsFixture} />);
  await screen.findByRole("region", { name: "Cet ordinateur" });
  await userEvent.setup().type(screen.getByRole("searchbox", { name: "Rechercher un skill…" }), "brain");
  expect(screen.getAllByRole("button", { name: /^Ouvrir le skill/ }).map((b) => b.textContent)).toEqual([
    expect.stringContaining("superpowers:brainstorming"),
  ]);
  const before = lists();
  await act(async () => emit("skills"));
  expect(lists()).toBe(before + 1);
});

test("a row opens the editor in the page, the breadcrumb comes back to the list", async () => {
  render(<SkillsPage projects={projectsFixture} />);
  const user = userEvent.setup();
  await user.click(await screen.findByRole("button", { name: "Ouvrir le skill porte-qualite" }));
  expect(await screen.findByRole("heading", { level: 2, name: "porte-qualite" })).toBeTruthy();
  await user.click(screen.getByRole("button", { name: "Skills" }));
  expect(await screen.findByRole("region", { name: "Cet ordinateur" })).toBeTruthy();
});

test("a skill target opens its editor with the scope of the skill", async () => {
  render(<SkillsPage projects={projectsFixture} initialSkill="clean-pr" />);
  expect(await screen.findByRole("heading", { level: 2, name: "clean-pr" })).toBeTruthy();
  expect(calls.find((c) => c.method === "skills.read")).toMatchObject({
    id: "clean-pr",
    scope: "project",
    projectId: "kibo",
  });
});

test("between a personal skill and a project skill of the same name, the target opens the personal one", async () => {
  listed = [...skillsFixture(), skillFixture({ id: "clean-pr", name: "clean-pr" })];
  render(<SkillsPage projects={projectsFixture} initialSkill="clean-pr" />);
  expect(await screen.findByRole("heading", { level: 2, name: "clean-pr" })).toBeTruthy();
  expect(calls.find((c) => c.method === "skills.read")).toEqual({
    method: "skills.read",
    id: "clean-pr",
    scope: "user",
  });
});

const toggle = (name: string) => screen.getByRole("button", { name });
const rowsOf = (name: string) =>
  within(screen.getByRole("region", { name })).queryAllByRole("button", { name: /^Ouvrir le skill/ });

test("plugin groups start collapsed with their counts in sight, a click unfolds and is remembered", async () => {
  const { unmount } = render(<SkillsPage projects={projectsFixture} />);
  await screen.findByRole("region", { name: "Cet ordinateur" });
  const header = toggle("superpowers 6.4.1");
  expect(header.getAttribute("aria-expanded")).toBe("false");
  expect(within(header).getByText("2")).toBeTruthy();
  expect(within(header).getByText("1 note").closest(".text-brand-strong")).toBeTruthy();
  expect(rowsOf("superpowers 6.4.1")).toHaveLength(0);
  expect(toggle("Cet ordinateur").getAttribute("aria-expanded")).toBe("true");
  await userEvent.setup().click(header);
  expect(rowsOf("superpowers 6.4.1")).toHaveLength(2);
  unmount();
  render(<SkillsPage projects={projectsFixture} />);
  await screen.findByRole("region", { name: "Cet ordinateur" });
  expect(rowsOf("superpowers 6.4.1")).toHaveLength(2);
});

test("collapse all folds every group, expand all unfolds them back", async () => {
  render(<SkillsPage projects={projectsFixture} />);
  await screen.findByRole("region", { name: "Cet ordinateur" });
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: "Tout déplier" }));
  expect(screen.getAllByRole("button", { name: /^Ouvrir le skill/ })).toHaveLength(5);
  await user.click(screen.getByRole("button", { name: "Tout replier" }));
  expect(screen.queryAllByRole("button", { name: /^Ouvrir le skill/ })).toHaveLength(0);
  expect(screen.getByRole("button", { name: "Tout déplier" })).toBeTruthy();
});

test("the notes filter shows only skills with open notes, unfolded, and is remembered", async () => {
  const { unmount } = render(<SkillsPage projects={projectsFixture} />);
  await screen.findByRole("region", { name: "Cet ordinateur" });
  expect(screen.getByRole("radio", { name: "Tous · 5" })).toBeTruthy();
  expect(screen.getByRole("radio", { name: "Utilisés · 1" })).toBeTruthy();
  await userEvent.setup().click(screen.getByRole("radio", { name: "Avec notes · 2" }));
  expect(
    screen.getAllByRole("button", { name: /^Ouvrir le skill/ }).map((b) => b.getAttribute("aria-label")),
  ).toEqual(["Ouvrir le skill porte-qualite", "Ouvrir le skill superpowers:brainstorming"]);
  expect(screen.queryByRole("region", { name: "Projet · Kibo" })).toBeNull();
  unmount();
  render(<SkillsPage projects={projectsFixture} />);
  await screen.findByRole("region", { name: "Cet ordinateur" });
  expect(screen.getByRole("radio", { name: "Avec notes · 2" }).getAttribute("aria-checked")).toBe("true");
});

test("a skill target unfolds its group when coming back to the list", async () => {
  render(<SkillsPage projects={projectsFixture} initialSkill="superpowers:brainstorming" />);
  expect(await screen.findByRole("heading", { level: 2, name: "superpowers:brainstorming" })).toBeTruthy();
  await userEvent.setup().click(screen.getByRole("button", { name: "Skills" }));
  await screen.findByRole("region", { name: "superpowers 6.4.1" });
  expect(rowsOf("superpowers 6.4.1")).toHaveLength(2);
});

test("an unreadable storage keeps the default folding and filter", async () => {
  localStorage.setItem("kibo.skills.collapsed", "{broken");
  localStorage.setItem("kibo.skills.filter", "bogus");
  render(<SkillsPage projects={projectsFixture} />);
  await screen.findByRole("region", { name: "Cet ordinateur" });
  expect(rowsOf("superpowers 6.4.1")).toHaveLength(0);
  expect(rowsOf("Cet ordinateur")).toHaveLength(2);
  expect(screen.getByRole("radio", { name: "Tous · 5" }).getAttribute("aria-checked")).toBe("true");
});
