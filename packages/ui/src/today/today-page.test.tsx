import { expect, mock, spyOn, test } from "bun:test";
import type { GithubPrRef, ProjectSnapshot, RpcRequest, TicketView } from "@kibo/schema";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { apiMock } from "../api-mock";
import { siloSnapshot, summaryOf, ticket } from "./today-fixtures";

mock.module("../api", () =>
  apiMock({
    client: {
      rpc: (req: RpcRequest) =>
        Promise.resolve(req.method === "t3.status" ? { available: true, bin: "t3" } : null),
      subscribe: () => () => {},
    },
  }),
);

const { TodayPage } = await import("./TodayPage");

const NOW = Date.parse("2026-10-16T12:00:00Z");

const pr = (number: number): GithubPrRef => ({
  kind: "github_pr",
  url: `https://github.com/silo-labs/silo/pull/${number}`,
  number,
  state: "open",
  base: null,
  head: null,
  review: "none",
  checks: null,
});

const project = (tickets: TicketView[]): ProjectSnapshot => {
  const base = siloSnapshot();
  return { ...base, tickets, questions: [], links: [] };
};

const blocked = (n: number): TicketView =>
  ticket({ id: `b${n}`, key: `SILO-${n}`, title: `Bloqué ${n}`, statusId: "blocked" });
const startable = (n: number): TicketView =>
  ticket({ id: `s${n}`, key: `SILO-${n}`, title: `Démarrable ${n}`, startable: true });

function show(p: ProjectSnapshot, handlers: Partial<Parameters<typeof TodayPage>[0]> = {}) {
  return render(
    <TodayPage
      projects={[summaryOf(p)]}
      snapshots={new Map([[p.meta.id, p]])}
      now={NOW}
      onNewProject={() => {}}
      onOpenProject={() => {}}
      onOpenTicket={() => {}}
      {...handlers}
    />,
  );
}

const headings = () => screen.getAllByRole("heading").map((h) => h.textContent);

test("the header names the day of the daemon and counts every project", () => {
  show(project([startable(1), ticket({ id: "d", key: "SILO-2", title: "Fini", statusId: "done" })]));
  expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Aujourd'hui");
  expect(screen.getByText("vendredi 16 octobre · 1 projet · 1 ticket ouvert")).toBeTruthy();
});

test("renders the four sections in order and hides empty ones", () => {
  const { unmount } = show(
    project([
      blocked(1),
      ticket({ id: "p", key: "SILO-2", title: "Avec PR", externalRefs: [pr(20)] }),
      startable(3),
    ]),
  );
  expect(headings().slice(1)).toEqual(["Ce qui bloque", "PR à relire", "Démarrable", "Projets"]);
  unmount();
  show(project([startable(3)]));
  expect(headings().slice(1)).toEqual(["Démarrable", "Projets"]);
  expect(screen.queryByText(/Rien ne bloque/)).toBeNull();
});

test("shows the calm line when nothing blocks", () => {
  show(project([ticket({ id: "t", key: "SILO-1", title: "Calme" })]));
  expect(headings().slice(1)).toEqual(["Projets"]);
  expect(screen.getByText("Rien ne bloque, rien à relire, rien à démarrer.")).toBeTruthy();
});

test("no calm line while a project is still loading", () => {
  const p = project([ticket({ id: "t", key: "SILO-1", title: "Calme" })]);
  show(p, { projects: [summaryOf(p), { ...summaryOf(p), id: "other" }] });
  expect(screen.queryByText(/Rien ne bloque/)).toBeNull();
});

test("Tout voir expands in place", async () => {
  show(project([1, 2, 3, 4, 5, 6, 7].map(blocked)));
  const section = screen.getByRole("region", { name: "Ce qui bloque" });
  expect(within(section).getAllByRole("listitem")).toHaveLength(5);
  await userEvent.click(within(section).getByRole("button", { name: "Tout voir (7)" }));
  expect(within(section).getAllByRole("listitem")).toHaveLength(7);
  expect(within(section).queryByRole("button", { name: /Tout voir/ })).toBeNull();
  expect(location.hash).not.toContain("kanban");
});

test("startable stops at eight lines until Tout voir", async () => {
  show(project([1, 2, 3, 4, 5, 6, 7, 8, 9].map(startable)));
  const section = screen.getByRole("region", { name: "Démarrable" });
  expect(within(section).getAllByRole("listitem")).toHaveLength(8);
  await userEvent.click(within(section).getByRole("button", { name: "Tout voir (9)" }));
  expect(within(section).getAllByRole("listitem")).toHaveLength(9);
});

test("the startable row shows LaunchInT3Button and the copy entry in its menu", async () => {
  show(project([startable(34)]));
  const row = within(screen.getByRole("region", { name: "Démarrable" })).getByRole("listitem");
  await waitFor(() => expect(within(row).getByRole("button", { name: "Lancer dans T3" })).toBeTruthy());
  await userEvent.click(within(row).getByRole("button", { name: "Actions pour SILO-34" }));
  expect(await screen.findByRole("menuitem", { name: "Copier /full-delivery SILO-34" })).toBeTruthy();
});

test("a row opens its ticket, a project row its project", async () => {
  const tickets: string[][] = [];
  const projects: string[] = [];
  show(project([blocked(1)]), {
    onOpenTicket: (projectId, ticketId) => tickets.push([projectId, ticketId]),
    onOpenProject: (id) => projects.push(id),
  });
  await userEvent.click(screen.getByRole("button", { name: /Bloqué 1/ }));
  expect(tickets).toEqual([["silo", "b1"]]);
  await userEvent.click(screen.getByRole("button", { name: /^Silo/ }));
  expect(projects).toEqual(["silo"]);
});

test("Nouveau projet opens the dialog", async () => {
  const created: boolean[] = [];
  show(project([]), { onNewProject: () => created.push(true) });
  await userEvent.click(screen.getByRole("button", { name: "Nouveau projet" }));
  expect(created).toEqual([true]);
});

function watchedSections(reduce: boolean): boolean {
  const media = spyOn(window, "matchMedia").mockImplementation(
    (query: string) =>
      ({
        matches: reduce && query.includes("reduce"),
        media: query,
        addEventListener: () => {},
        removeEventListener: () => {},
        addListener: () => {},
        removeListener: () => {},
      }) as unknown as MediaQueryList,
  );
  const observe = spyOn(MutationObserver.prototype, "observe");
  try {
    show(project([blocked(1)]));
    const list = within(screen.getByRole("region", { name: "Ce qui bloque" })).getByRole("list");
    return observe.mock.calls.some(([target]) => target === list);
  } finally {
    observe.mockRestore();
    media.mockRestore();
  }
}

test("auto-animate watches the lines of a section", () => {
  expect(watchedSections(false)).toBe(true);
});

test("with reduced motion auto-animate leaves the lines of a section alone", () => {
  expect(watchedSections(true)).toBe(false);
});
