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
  listed = skillsFixture();
  calls.length = 0;
  topics.clear();
});

const lists = () => calls.filter((c) => c.method === "skills.list").length;

test("screen 194: groups by source, each row with its notes, its usage and its badges", async () => {
  render(<SkillsPage projects={projectsFixture} />);
  const computer = await screen.findByRole("region", { name: "Cet ordinateur" });
  const rows = within(computer).getAllByRole("button");
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
