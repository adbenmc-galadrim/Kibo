import { beforeEach, expect, mock, test } from "bun:test";
import type {
  ComponentSummary,
  ComponentUsage,
  DraftSummary,
  PublishPreview,
  RpcRequest,
  TabTarget,
} from "@kibo/schema";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";

const H = "a".repeat(64);
let components: ComponentSummary[] = [];
let drafts: DraftSummary[] = [];
let preview: PublishPreview | null = null;

mock.module("../api", () => ({
  client: {
    rpc: (req: RpcRequest) => {
      if (req.method === "listComponents") return Promise.resolve(components);
      if (req.method === "getSandboxStatus")
        return Promise.resolve({
          kind: "bwrap",
          available: true,
          reason: null,
          fix: null,
          allowUnsandboxed: false,
        });
      if (req.method === "listProjects") return Promise.resolve([]);
      if (req.method === "listDrafts") return Promise.resolve(drafts);
      if (req.method === "previewPublish") return Promise.resolve(preview);
      return Promise.resolve([]);
    },
    subscribe: () => () => undefined,
    subscribeEvents: () => () => undefined,
  },
}));

const { ComponentsPage } = await import("./ComponentsPage");
const { placesOf } = await import("./UsagesSheet");

const use = (
  projectId: string,
  projectName: string,
  pageId: string,
  pageTitle: string,
  n = 1,
): ComponentUsage => ({
  projectId,
  projectName,
  pageId,
  pageTitle,
  instanceId: `${pageId}-${n}`,
});
const version = (
  over: Partial<ComponentSummary["versions"][number]>,
): ComponentSummary["versions"][number] => ({
  version: "1.0.0",
  hash: H,
  trust: "sandboxed",
  origin: "marketplace",
  active: true,
  tampered: false,
  manifest: null,
  usages: [],
  revoked: null,
  backend: false,
  ...over,
});
const kanbanSummary: ComponentSummary = {
  id: "kanban",
  title: "Kanban",
  builtin: true,
  versions: [
    version({
      origin: "kibo",
      trust: "trusted",
      usages: [
        use("p2", "Portfolio", "page-home", "Accueil"),
        use("p1", "Kibo", "page-board", "Tableau de bord"),
        use("p1", "Kibo", "page-board", "Tableau de bord", 2),
        use("p1", "Kibo", "page-sprint", "Sprint"),
      ],
    }),
  ],
};
const meteoSummary: ComponentSummary = {
  id: "meteo",
  title: "Météo",
  builtin: false,
  versions: [version({})],
};
const acmeSummary: ComponentSummary = {
  id: "acme.bug",
  title: "Bugs Acme",
  builtin: false,
  versions: [
    version({
      version: "2.1.0",
      origin: "ai",
      active: false,
      trust: null,
      usages: [1, 2, 3, 4, 5].map((n) => use(`p${n}`, `Projet ${n}`, `page-${n}`, `Page ${n}`)),
    }),
  ],
};

const noop = () => undefined;
const search = () => screen.getByRole("searchbox", { name: "Rechercher un composant" });
const group = (name: string) => screen.getByRole("radiogroup", { name });
const bodyRows = () => screen.getAllByRole("row").slice(1);

const ok = { ok: true, errors: [] };
const meteoPreview: PublishPreview = {
  id: "meteo",
  title: "Météo",
  from: "1.0.0",
  to: "1.1.0",
  hash: H,
  status: "update",
  usages: [{ ...use("p1", "Kibo", "page-board", "Tableau de bord"), version: "1.0.0" }],
  changes: [],
  newPermissions: [],
  migration: null,
  validation: {
    manifest: ok,
    imports: ok,
    typecheck: ok,
    tests: { ok: true, passed: 1, failed: 0, output: "" },
    conformance: ok,
    permissions: { declared: [], used: [], missing: [], unused: [], errors: [] },
    hash: H,
    ok: true,
  },
};

beforeEach(() => {
  localStorage.clear();
  components = [kanbanSummary, meteoSummary, acmeSummary];
  drafts = [];
  preview = null;
});

test("screen 116: title, explanation, search, filters and sortable headers", async () => {
  render(<ComponentsPage onOpen={noop} />);
  expect(await screen.findByRole("heading", { level: 1, name: "Composants" })).toBeTruthy();
  expect(screen.getByText(/Les widgets et vues disponibles dans tes pages/)).toBeTruthy();
  await screen.findByRole("row", { name: /Bugs Acme/ });
  fireEvent.change(search(), { target: { value: "météo" } });
  expect(screen.getAllByRole("row")).toHaveLength(2);
  fireEvent.change(search(), { target: { value: "" } });
  fireEvent.click(within(group("Confiance")).getByRole("radio", { name: "À examiner" }));
  expect(screen.getByRole("row", { name: /Bugs Acme/ })).toBeTruthy();
  expect(screen.queryByRole("row", { name: /Kanban/ })).toBeNull();
  fireEvent.click(within(group("Confiance")).getByRole("radio", { name: "Tous" }));
  fireEvent.click(within(group("Origine")).getByRole("radio", { name: "Marketplace" }));
  expect(bodyRows().map((r) => r.textContent?.slice(0, 5))).toEqual(["Météo"]);
  fireEvent.click(within(group("Origine")).getByRole("radio", { name: "Tous" }));
  expect(screen.getByRole("columnheader", { name: /Nom/ }).getAttribute("aria-sort")).toBe("ascending");
  fireEvent.click(screen.getByRole("button", { name: "Trier par Utilisé dans" }));
  expect(bodyRows()[0]?.textContent).toContain("Bugs Acme");
  expect(bodyRows()[1]?.textContent).toContain("Kanban");
  expect(screen.getByRole("columnheader", { name: /Utilisé dans/ }).getAttribute("aria-sort")).toBe(
    "descending",
  );
  expect(screen.getByRole("columnheader", { name: /Nom/ }).getAttribute("aria-sort")).toBe("none");
  fireEvent.click(screen.getByRole("button", { name: "Trier par Utilisé dans" }));
  expect(screen.getByRole("columnheader", { name: /Utilisé dans/ }).getAttribute("aria-sort")).toBe(
    "ascending",
  );
});

test("no match offers to clear the filters", async () => {
  render(<ComponentsPage onOpen={noop} />);
  await screen.findByRole("row", { name: /Bugs Acme/ });
  expect(screen.queryByRole("button", { name: "Effacer les filtres" })).toBeNull();
  fireEvent.change(search(), { target: { value: "introuvable" } });
  expect(screen.getByText("Aucun composant ne correspond.")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Effacer les filtres" }));
  expect((search() as HTMLInputElement).value).toBe("");
  expect(screen.getByRole("row", { name: /Bugs Acme/ })).toBeTruthy();
  expect(screen.queryByText("Aucun composant ne correspond.")).toBeNull();
});

test("Créer un composant opens the creation dialog", async () => {
  render(<ComponentsPage onOpen={noop} />);
  fireEvent.click(await screen.findByRole("button", { name: "Créer un composant" }));
  expect(await screen.findByRole("dialog", { name: "Créer un composant" })).toBeTruthy();
});

test("the usages sheet lists project › page and opens the page", async () => {
  const opened: TabTarget[] = [];
  render(<ComponentsPage onOpen={(t) => opened.push(t)} />);
  fireEvent.click(await screen.findByRole("button", { name: "3 pages · 2 projets" }));
  const sheet = await screen.findByRole("dialog", { name: "Utilisé dans" });
  expect(within(sheet).getByText("Kanban 1.0.0")).toBeTruthy();
  const places = within(within(sheet).getByRole("list")).getAllByRole("button");
  expect(places.map((b) => b.textContent)).toEqual([
    "Kibo › Sprint",
    "Kibo › Tableau de bord",
    "Portfolio › Accueil",
  ]);
  fireEvent.click(within(sheet).getByRole("button", { name: "Kibo › Sprint" }));
  expect(opened).toEqual([{ kind: "page", projectId: "p1", pageId: "page-sprint" }]);
  await waitFor(() => expect(screen.queryByRole("dialog", { name: "Utilisé dans" })).toBeNull());
});

test("an unused component has no usages button", async () => {
  render(<ComponentsPage onOpen={noop} />);
  const row = await screen.findByRole("row", { name: /Météo/ });
  expect(within(row).getByText("Aucune page")).toBeTruthy();
  expect(within(row).queryByRole("button", { name: "Aucune page" })).toBeNull();
});

test("the publish preview opens the same usages sheet", async () => {
  drafts = [
    { id: "meteo", title: "Météo", version: "1.1.0", hash: H, validated: true, publishedVersion: "1.0.0" },
  ];
  preview = meteoPreview;
  const opened: TabTarget[] = [];
  render(<ComponentsPage onOpen={(t) => opened.push(t)} />);
  fireEvent.click(await screen.findByRole("button", { name: "Publier" }));
  fireEvent.click(await screen.findByRole("button", { name: "Utilisé dans 1 projet" }));
  const sheet = await screen.findByRole("dialog", { name: "Utilisé dans" });
  expect(within(sheet).getByText("Météo 1.0.0")).toBeTruthy();
  fireEvent.click(within(sheet).getByRole("button", { name: "Kibo › Tableau de bord" }));
  expect(opened).toEqual([{ kind: "page", projectId: "p1", pageId: "page-board" }]);
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
});

test("the sort survives a remount, filters do not", async () => {
  const first = render(<ComponentsPage onOpen={noop} />);
  await screen.findByRole("row", { name: /Bugs Acme/ });
  fireEvent.click(screen.getByRole("button", { name: "Trier par Utilisé dans" }));
  fireEvent.change(search(), { target: { value: "kanban" } });
  first.unmount();
  render(<ComponentsPage onOpen={noop} />);
  await screen.findByRole("row", { name: /Bugs Acme/ });
  expect(screen.getByRole("columnheader", { name: /Utilisé dans/ }).getAttribute("aria-sort")).toBe(
    "descending",
  );
  expect((search() as HTMLInputElement).value).toBe("");
  localStorage.clear();
});

test("places are listed by project, then by page", () => {
  const places = placesOf([
    use("p2", "Portfolio", "page-home", "Accueil"),
    use("p1", "Kibo", "page-board", "Tableau de bord"),
    use("p1", "Kibo", "page-board", "Tableau de bord", 2),
    use("p1", "Kibo", "page-sprint", "Sprint"),
    use("p1", "Kibo", "page-api", "API"),
  ]);
  expect(places.map((p) => `${p.projectName} › ${p.pageTitle}`)).toEqual([
    "Kibo › API",
    "Kibo › Sprint",
    "Kibo › Tableau de bord",
    "Portfolio › Accueil",
  ]);
});
