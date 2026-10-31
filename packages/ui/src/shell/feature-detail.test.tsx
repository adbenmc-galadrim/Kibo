import { afterEach, beforeEach, expect, mock, setSystemTime, test } from "bun:test";
import type { ProjectSnapshot, RpcRequest, Spotlight } from "@kibo/schema";
import type { NewTicketDefaults } from "@kibo/sdk";
import { isSeparator, isSubmenu, type MenuEntry } from "@kibo/sdk/ui/menu-entries";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { apiMock } from "../api-mock";
import { viewFixture } from "../project-agent/fixtures";
import { NOW, siloFeatureProject } from "./feature/fixture";
import { type Host, HostProvider } from "./Host";

const calls: RpcRequest[] = [];

const answer = (req: RpcRequest): unknown => {
  if (req.method === "listProjectEvents") return { items: [], nextBefore: null };
  if (req.method === "listCiRuns") return [];
  if (req.method === "getProjectAgent") return viewFixture({ batches: [] });
  if (req.method === "getAppInfo") return { today: "2026-10-16" };
  return null;
};

mock.module("../api", () =>
  apiMock({
    client: {
      rpc: async (req: RpcRequest) => {
        calls.push(req);
        return answer(req);
      },
      subscribeTopic: () => () => {},
      subscribeIntegrations: () => () => {},
    },
  }),
);

const { FeatureDetail } = await import("./FeatureDetail");

const created: NewTicketDefaults[] = [];
const views: (Spotlight | undefined)[] = [];
const host: Host = {
  openTicket: () => undefined,
  openNewTicket: (d) => void created.push(d),
  openFile: () => undefined,
  openView: (_id, _project, question) => void views.push(question),
  openTarget: () => undefined,
};

beforeEach(() => {
  calls.length = 0;
  created.length = 0;
  views.length = 0;
});
afterEach(() => {
  cleanup();
  setSystemTime();
});

const withStartableE34 = (project: ProjectSnapshot): ProjectSnapshot => ({
  ...project,
  tickets: project.tickets.map((t) =>
    t.id === "e34" ? { ...t, startable: true, startReason: null, waitingOn: [] } : t,
  ),
});

const renderFeature = (project: ProjectSnapshot = siloFeatureProject(), opened: string[] = []) => {
  const feature = project.tickets.find((t) => t.id === "f5");
  if (!feature) throw new Error("fixture without F5");
  return render(
    <HostProvider host={host}>
      <FeatureDetail
        project={project}
        ticket={feature}
        now={NOW}
        onOpenFile={() => undefined}
        onOpenTicket={(id) => opened.push(id)}
      />
    </HostProvider>,
  );
};

const commands = () => calls.flatMap((c) => (c.method === "command" ? [c.command] : []));
const aside = (name: string) => within(screen.getByRole("region", { name }));

test("the sprint card counts on the day of the daemon, not of the browser", async () => {
  setSystemTime(new Date(2026, 9, 20, 10));
  const project = siloFeatureProject();
  const feature = project.tickets.find((t) => t.id === "f5");
  if (!feature) throw new Error("fixture without F5");
  render(
    <HostProvider host={host}>
      <FeatureDetail
        project={project}
        ticket={feature}
        onOpenFile={() => undefined}
        onOpenTicket={() => undefined}
      />
    </HostProvider>,
  );
  expect(await screen.findByText("4 étapes restantes : ne tiendra pas dans S42.")).toBeTruthy();
  expect(calls.filter((c) => c.method === "getAppInfo")).toHaveLength(1);
});

test("the header names the feature, its sprint, its state and its progress", () => {
  renderFeature();
  expect(screen.getByText("Fonctionnalité · F5")).toBeTruthy();
  expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Envoyer les photos d'un constat");
  expect(screen.getByText("ouverte")).toBeTruthy();
  expect(screen.getByText("1 étape livrée sur 5")).toBeTruthy();
  const bar = screen.getByRole("img", { name: "Étapes de la fonctionnalité" });
  expect(Array.from(bar.children, (c) => c.getAttribute("data-tone"))).toEqual([
    "done",
    "review",
    "progress",
    "todo",
    "todo",
  ]);
});

test("the expected result is the description and editors change it", async () => {
  const user = userEvent.setup();
  renderFeature();
  await user.click(screen.getByRole("button", { name: "Modifier le résultat attendu" }));
  const field = screen.getByRole("textbox", { name: "Résultat attendu" });
  await user.clear(field);
  await user.type(field, "Les photos arrivent.");
  await user.click(screen.getByRole("button", { name: "Enregistrer" }));
  expect(commands()).toEqual([
    { method: "updateTicket", ticketId: "f5", description: "Les photos arrivent." },
  ]);
});

test("the journey lists the steps in order and offers the next one to deliver", async () => {
  const user = userEvent.setup();
  const written: string[] = [];
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: { writeText: async (text: string) => void written.push(text) },
  });
  renderFeature(withStartableE34(siloFeatureProject()));
  const titles = screen
    .getAllByRole("listitem")
    .map((li) => within(li).getAllByRole("button")[0]?.textContent);
  expect(titles.slice(0, 5)).toEqual([
    "Stockage des photos sur MinIO",
    "Route d'envoi des photos",
    "Écran d'envoi hors ligne",
    "Tests E2E de l'envoi",
    "Démo client",
  ]);
  await user.click(screen.getByRole("button", { name: "Copier la commande" }));
  expect(written).toEqual(["/full-delivery SILO-34"]);
});

test("when the next step cannot start, the journey says why and offers nothing to copy", () => {
  renderFeature();
  expect(screen.getByText("Prochaine étape SILO-34 : attend SILO-33.")).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Copier la commande" })).toBeNull();
});

test("adding a step opens the ticket dialog under the feature", async () => {
  renderFeature();
  await userEvent.setup().click(screen.getByRole("button", { name: "Ajouter une étape" }));
  expect(created).toEqual([{ parentId: "f5" }]);
});

const lateF5Project = (): ProjectSnapshot => {
  const project = siloFeatureProject();
  const tickets = project.tickets.map((t) =>
    t.id === "f5" && t.feature !== null ? { ...t, feature: { ...t.feature, status: "late" as const } } : t,
  );
  return { ...project, tickets };
};

test("the sprint card warns that a late feature will not fit and moves it to the next sprint", async () => {
  renderFeature(lateF5Project());
  const sprint = aside("Sprint");
  expect(sprint.getByText("Saisie hors ligne · 12–16 oct.")).toBeTruthy();
  expect(sprint.getByText("4 étapes restantes : ne tiendra pas dans S42.")).toBeTruthy();
  await userEvent.setup().click(sprint.getByRole("button", { name: "Déplacer en S43" }));
  expect(commands()).toEqual([{ method: "setTicketSprint", ticketId: "f5", sprintId: "s43" }]);
});

test("the side cards show dependencies, questions, activity and the footer", async () => {
  const opened: string[] = [];
  renderFeature(siloFeatureProject(), opened);
  const deps = aside("Dépendances");
  expect(deps.getAllByRole("button").map((b) => b.textContent)).toEqual([
    "Dépendance",
    "AttendF3Réaffecter un box",
    "DébloqueF7Rapport de centreS44",
  ]);
  const user = userEvent.setup();
  await user.click(deps.getByText("Rapport de centre"));
  expect(opened).toEqual(["f7"]);
  const questions = aside("Questions");
  expect(questions.getByText("Q16 · Produit · hier · SILO-34")).toBeTruthy();
  await user.click(questions.getByText("Quota par client : 2 Go ou 5 Go ?"));
  expect(views).toEqual([{ kind: "question", id: "q16" }]);
  await user.click(questions.getByRole("button", { name: "Question" }));
  expect(views.at(-1)).toEqual({ kind: "newQuestion", ticketId: "f5" });
  expect(
    aside("Activité")
      .getAllByRole("paragraph")
      .map((p) => p.textContent),
  ).toEqual([
    "PR #22 ouverte · SILO-3215:04",
    "Étape 7/12 · Porte qualité · SILO-3314:51",
    "PR #19 fusionnée · SILO-31hier",
  ]);
  expect(
    screen.getByText(
      "Une fonctionnalité ne se lance pas : chaque étape se livre dans T3 Code avec full-delivery.",
    ),
  ).toBeTruthy();
});

const menuOf = (extra: MenuEntry[]) => (
  <ul aria-label="Menu de la fiche">
    {extra.flatMap((e) =>
      isSeparator(e) || isSubmenu(e)
        ? []
        : [
            <li key={e.label}>
              <button type="button" onClick={() => e.onSelect()}>
                {e.label}
              </button>
            </li>,
          ],
    )}
  </ul>
);

const renderWithMenu = () => {
  const project = siloFeatureProject();
  const feature = project.tickets.find((t) => t.id === "f5");
  if (!feature) throw new Error("fixture without F5");
  return render(
    <HostProvider host={host}>
      <FeatureDetail
        project={project}
        ticket={feature}
        now={NOW}
        actions={menuOf}
        onOpenFile={() => undefined}
        onOpenTicket={() => undefined}
      />
    </HostProvider>,
  );
};

test("the header menu offers no delivery", () => {
  renderWithMenu();
  const menu = within(screen.getByRole("list", { name: "Menu de la fiche" }));
  expect(menu.queryByRole("button", { name: "Livrer les sous-tickets" })).toBeNull();
});

test("a blocking question asked on the feature shows in Questions with the « bloquante » badge", () => {
  const project = siloFeatureProject();
  const [q16] = project.questions;
  if (!q16) throw new Error("fixture without Q16");
  const onFeature = { ...q16, id: "q1", ticketId: "f5", blocking: true, importRef: null, number: 1 };
  renderFeature({ ...project, questions: [onFeature] });
  const row = screen.getByRole("button", { name: /Quota par client/ });
  expect(within(row).getByText("bloquante")).toBeTruthy();
  expect(within(row).getByText("Q1 · Produit · hier · F5")).toBeTruthy();
});
