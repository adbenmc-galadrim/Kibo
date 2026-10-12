import { beforeEach, expect, mock, test } from "bun:test";
import { type RpcRequest, runSubject, type Topic } from "@kibo/schema";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { apiMock } from "../api-mock";
import { frAgentsPage } from "../i18n/fr-agents-page";
import { agentFixture, catalogFixture } from "./catalog/fixtures";
import { agentsFixture, NOW, projectsFixture } from "./fixtures";

const calls: RpcRequest[] = [];
const topics = new Map<Topic, () => void>();
const NOTICE = {
  profileName: "opus",
  text: "Profil opus : un agent du même nom existait déjà, il a été gardé.",
};
const listed = (notices = [NOTICE]) =>
  Promise.resolve({ agents: catalogFixture(), notices, partialWatch: false });
const answer = (req: RpcRequest): Promise<unknown> => {
  if (req.method === "agents.list") return listed();
  if (req.method === "agents.read") return Promise.resolve(agentFixture({ name: "opus-dev", ref: req.ref }));
  if (req.method === "skills.list") return Promise.resolve({ skills: [], partialWatch: false });
  return Promise.resolve(null);
};
let respond: (req: RpcRequest) => Promise<unknown> = answer;

mock.module("../api", () =>
  apiMock({
    client: {
      rpc: (req: RpcRequest) => {
        calls.push(req);
        return respond(req);
      },
      subscribeTopic: (topic: Topic, listener: () => void) => {
        topics.set(topic, listener);
        return () => topics.delete(topic);
      },
    },
  }),
);

const { AgentsPage } = await import("./AgentsPage");

beforeEach(() => {
  localStorage.clear();
  calls.length = 0;
  topics.clear();
  respond = answer;
});

const show = (onOpenRun: (runId: string) => void = () => {}) =>
  render(<AgentsPage state={agentsFixture()} projects={projectsFixture} now={NOW} onOpenRun={onOpenRun} />);
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
  expect(screen.queryByRole("button", { name: "Nouvel agent" })).toBeNull();
});

const mine = async () => within(await screen.findByRole("region", { name: "Mes agents" }));
const card = (region: ReturnType<typeof within>, index: number) => {
  const found = region.getAllByRole("article")[index];
  if (!found) throw new Error(`no card ${index}`);
  return within(found);
};
const names = (region: ReturnType<typeof within>) =>
  region.getAllByRole("article").map((a: HTMLElement) => a.getAttribute("aria-label"));

test("screen 192: my agents are cards with description, scope, model, skills and runs", async () => {
  show();
  const region = await mine();
  expect(names(region)).toEqual(["opus-dev", "review-pr", "review-pr", "sonnet-dev", "ux-audit"]);
  const delivery = card(region, 0);
  expect(
    delivery.getByText("Livre un ticket : lit le ticket, planifie, code en TDD, commite et ouvre la PR."),
  ).toBeTruthy();
  expect(delivery.getByText("Global")).toBeTruthy();
  expect(delivery.getByText("Opus · 3 skills · 0 sous-agent")).toBeTruthy();
  expect(delivery.getByText("En cours :")).toBeTruthy();
  expect(delivery.getByRole("button", { name: "opus-dev-3" })).toBeTruthy();
  const shadowed = card(region, 1);
  expect(shadowed.getByText("Sonnet · 2 skills · 1 sous-agent")).toBeTruthy();
  expect(shadowed.getByText("masqué dans Kibo par un agent du même nom")).toBeTruthy();
  expect(card(region, 2).getByText("Projet · Kibo")).toBeTruthy();
  expect(card(region, 2).getByText("Sonnet · Tous les skills · 0 sous-agent")).toBeTruthy();
  expect(card(region, 3).getByText("fable · Tous les skills · 0 sous-agent")).toBeTruthy();
  expect(card(region, 3).getByText("Nom peu parlant")).toBeTruthy();
  expect(card(region, 3).getByRole("button", { name: "Renommer" })).toBeTruthy();
  expect(card(region, 4).getByText("fichier illisible")).toBeTruthy();
  expect(card(region, 4).getByText("frontmatter illisible : description")).toBeTruthy();
  expect(screen.getByText("~/.claude/agents · Kibo : .claude/agents")).toBeTruthy();
});

test("the agents of Kibo are folded until asked", async () => {
  show();
  await mine();
  const trigger = screen.getByRole("button", { name: /Agents de Kibo/ });
  expect(trigger.getAttribute("aria-expanded")).toBe("false");
  expect(screen.queryByRole("article", { name: "kibo-demo" })).toBeNull();
  await userEvent.setup().click(trigger);
  const system = within(screen.getByRole("region", { name: "Agents de Kibo" }));
  expect(names(system)).toEqual(["kibo-assistant", "kibo-generateur", "kibo-demo", "kibo-project-agent"]);
});

test("a migration notice shows once, and the file topic reloads the list", async () => {
  show();
  await mine();
  expect(screen.getByRole("alert").textContent).toContain(NOTICE.text);
  const before = calls.filter((c) => c.method === "agents.list").length;
  respond = (req) => (req.method === "agents.list" ? listed([]) : answer(req));
  await act(async () => topics.get("agent-files")?.());
  await waitFor(() => expect(calls.filter((c) => c.method === "agents.list").length).toBe(before + 1));
  expect(screen.getAllByRole("alert")).toHaveLength(1);
});

test("the project filter asks the agents of that project and hides the others", async () => {
  show();
  await mine();
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: "Filtrer par projet" }));
  await user.click(await screen.findByRole("menuitemradio", { name: "API Facturation" }));
  await waitFor(() => expect(calls).toContainEqual({ method: "agents.list", projectId: "fac" }));
  const region = await mine();
  expect(region.queryByText("Projet · Kibo")).toBeNull();
  expect(names(region)).toEqual(["opus-dev", "review-pr", "sonnet-dev", "ux-audit"]);
});

test("opening a card shows the agent in the page, and Agents goes back", async () => {
  show();
  const region = await mine();
  const user = userEvent.setup();
  await user.click(card(region, 0).getByRole("button", { name: "Ouvrir l'agent opus-dev" }));
  expect(await screen.findByRole("heading", { level: 2, name: "opus-dev" })).toBeTruthy();
  expect(calls).toContainEqual({ method: "agents.read", ref: "global:opus-dev" });
  await user.click(screen.getByRole("button", { name: "Agents" }));
  expect(await screen.findByRole("region", { name: "Mes agents" })).toBeTruthy();
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
  expect(screen.getByText(/^Un agent est un fichier Claude Code/)).toBeTruthy();
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
  const seq = within(second).getAllByRole("button")[0];
  if (!seq) throw new Error("no run button");
  await user.click(seq);
  expect(opened).toEqual([expected, expected]);
  for (const row of rows) {
    for (const button of within(row).getAllByRole("button"))
      expect(button.className).not.toContain("after:absolute");
  }
});

test("a history row names its run with an agent mention", () => {
  show();
  const row = screen.getByRole("row", { name: /^KIB-14/ });
  expect(within(row).getByRole("button", { name: "opus-dev-2" }).querySelector(".font-mono")).not.toBeNull();
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

test("screen 162: the project filter narrows queue, waiting and history, and is remembered", async () => {
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
