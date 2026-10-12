import { beforeEach, expect, mock, test } from "bun:test";
import { type RpcRequest, runSubject } from "@kibo/schema";
import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { apiMock } from "../api-mock";
import { frAgentsPage } from "../i18n/fr-agents-page";
import { agentsFixture, NOW, projectsFixture } from "./fixtures";

const calls: RpcRequest[] = [];
let respond: (req: RpcRequest) => Promise<unknown> = () => Promise.resolve(null);

mock.module("../api", () =>
  apiMock({
    client: {
      rpc: (req: RpcRequest) => {
        calls.push(req);
        return respond(req);
      },
    },
  }),
);

const { AgentsPage } = await import("./AgentsPage");

beforeEach(() => {
  localStorage.clear();
  calls.length = 0;
  respond = () => Promise.resolve(null);
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
  expect(screen.queryByRole("button", { name: "Nouveau profil" })).toBeNull();
});

test("the agents section waits for the agent catalogue", () => {
  show();
  expect(screen.getByRole("heading", { level: 2, name: "Agents" })).toBeTruthy();
  expect(screen.getByText("Chargement…")).toBeTruthy();
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
