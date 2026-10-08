import { beforeEach, expect, mock, test } from "bun:test";
import {
  DEFAULT_WORKFLOW,
  type DesignFrame,
  KiboError,
  type ProjectSnapshot,
  type RpcRequest,
  type TicketView,
} from "@kibo/schema";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const FIGMA_URL = "https://www.figma.com/design/AbC123xyz/Kibo?node-id=12-34";
const FILE = "11111111-1111-4111-8111-111111111111";
const PAGE = "22222222-2222-4222-8222-222222222222";
const BOARD = "33333333-3333-4333-8333-333333333333";
const PENPOT_URL = `https://design.penpot.app/#/workspace/team/proj/${FILE}?page-id=${PAGE}&board-id=${BOARD}`;
const PNG = "data:image/png;base64,iVBORw0KGgo=";
const frameOf = (url: string, over: Partial<DesignFrame> = {}): DesignFrame => ({
  id: url,
  provider: url === FIGMA_URL ? "figma" : "penpot",
  name: url === FIGMA_URL ? "Tickets / Arbre" : "Accueil",
  width: 1440,
  height: 900,
  url: `${PNG}${url === FIGMA_URL ? "F" : "P"}`,
  mime: "image/png",
  fetchedAt: 0,
  stale: false,
  reachable: true,
  source: url,
  ...over,
});
let frames: Record<string, () => DesignFrame> = {};
const defaultFrames = (): Record<string, () => DesignFrame> => ({
  [FIGMA_URL]: () => frameOf(FIGMA_URL),
  [PENPOT_URL]: () => frameOf(PENPOT_URL, { stale: true, reachable: false }),
});

const calls: RpcRequest[] = [];
const replies: Record<string, (req: RpcRequest) => unknown> = {
  getSyncState: () => ({
    bindings: [],
    pending: ["t1"],
    errors: [
      {
        outboxId: 7,
        ticketId: "t1",
        op: "create",
        code: "REMOTE_REJECTED",
        message: "github 422: Validation Failed",
      },
    ],
  }),
  listCiRuns: () => [
    {
      repo: "adam/kibo",
      runId: 900,
      prNumber: 12,
      ticketKey: "KIB-1",
      headSha: "abc",
      workflow: "CI",
      status: "completed",
      conclusion: "failure",
      url: "https://github.com/adam/kibo/actions/runs/900",
      startedAt: "2026-09-26T10:00:00Z",
      updatedAt: "2026-09-26T10:03:12Z",
      jobs: [
        {
          jobId: 70,
          name: "build",
          status: "completed",
          conclusion: "failure",
          startedAt: "2026-09-26T10:00:00Z",
          completedAt: "2026-09-26T10:03:12Z",
        },
      ],
    },
  ],
  getCiLog: () => ({
    text: "2026-09-26T10:00:01.0000000Z setup\n##[error]Test failed\ndone\n",
    truncated: false,
    errorLines: [2],
  }),
  linkDesignFrame: () => null,
  getDesignFrame: (req) => {
    const reply = req.method === "getDesignFrame" ? frames[req.url] : undefined;
    if (!reply) throw new KiboError("REMOTE_NOT_FOUND", "unknown frame");
    return reply();
  },
};
mock.module("../../api", () => ({
  client: {
    rpc: async (req: RpcRequest) => {
      calls.push(req);
      return replies[req.method]?.(req) ?? null;
    },
    subscribeIntegrations: () => () => undefined,
  },
}));

const { TicketSheet } = await import("../TicketSheet");
const { TicketTab } = await import("../../pages/TicketTab");

const ticket: TicketView = {
  id: "t1",
  key: "KIB-1",
  pendingSeq: null,
  keyLabel: "KIB-1",
  title: "Arbre",
  description: "<img src=x onerror=alert(1)> **gras**",
  statusId: "in_progress",
  parentId: null,
  assignee: null,
  domainId: null,
  blockedReason: null,
  labels: [],
  externalRefs: [
    {
      kind: "github_issue",
      bindingId: "b1",
      repo: "adam/kibo",
      number: 42,
      nodeId: "I_42",
      url: "https://github.com/adam/kibo/issues/42",
    },
    {
      kind: "github_pr",
      url: "https://github.com/adam/kibo/pull/12",
      number: 12,
      state: "open",
      base: null,
      head: null,
    },
    {
      kind: "figma_node",
      fileKey: "AbC123xyz",
      nodeId: "12:34",
      url: FIGMA_URL,
      name: "Tickets / Arbre",
    },
    {
      kind: "penpot_board",
      instance: "https://design.penpot.app",
      fileId: FILE,
      pageId: PAGE,
      boardId: BOARD,
      url: PENPOT_URL,
      name: "Accueil",
    },
  ],
  progress: { done: 0, total: 0 },
  waitingOn: [],
  openQuestions: 0,
};
const project: ProjectSnapshot = {
  meta: { id: "p1", name: "Kibo", key: "KIB", folder: null, color: "#14B8A6", worktree: null },
  workflow: DEFAULT_WORKFLOW,
  pages: [],
  links: [],
  questions: [],
  instances: [],
  rules: [],
  bindings: [],
  nextTicketKey: "KIB-2",
  sync: { shared: false, keyAllocator: "local", role: null, access: "write", members: [] },
  tickets: [ticket],
};
const show = async (shown: TicketView = ticket) => {
  const view = render(
    <TicketSheet
      project={{ ...project, tickets: [shown] }}
      ticketId={shown.id}
      domains={[]}
      viewer="adam"
      onClose={() => {}}
      onAssign={() => {}}
      onOpenInTab={() => {}}
      onOpenFile={() => {}}
      onOpenTicket={() => {}}
      onDeleted={() => {}}
    />,
  );
  await screen.findAllByRole("alert");
  if (shown.externalRefs.some((r) => r.kind === "github_pr")) await screen.findByText("3 min 12 s");
  if (shown.externalRefs.some((r) => r.kind === "figma_node")) await screen.findAllByText("Tickets / Arbre");
  return view;
};

beforeEach(() => {
  calls.length = 0;
  frames = defaultFrames();
});

test("the issue and PR chips sit in the header, issue first", async () => {
  await show();
  const header = screen.getByRole("heading", { name: "Arbre" }).parentElement;
  if (!header) throw new Error("sheet has a header");
  const links = within(header).getAllByRole("link");
  expect(links.map((l) => [l.textContent, l.getAttribute("href")])).toEqual([
    ["#42", "https://github.com/adam/kibo/issues/42"],
    ["#12", "https://github.com/adam/kibo/pull/12"],
  ]);
  expect(screen.getAllByRole("link", { name: "#12" })).toHaveLength(1);
  expect(screen.queryByText("Pull requests")).toBeNull();
});

test("the ticket tab shows the GitHub chips in its header", async () => {
  render(
    <TicketTab project={project} ticketId="t1" viewer="adam" onOpenFile={() => {}} onOpenTicket={() => {}} />,
  );
  const header = screen.getByRole("heading", { name: "Arbre" }).parentElement;
  if (!header) throw new Error("tab has a header");
  expect(await within(header).findByRole("link", { name: "#42" })).toBeDefined();
  expect(within(header).getByRole("link", { name: "#12" })).toBeDefined();
  await screen.findAllByText("Tickets / Arbre");
});

test("a broken issue link shows a badge instead of a link", async () => {
  const broken: TicketView = {
    ...ticket,
    externalRefs: [
      { kind: "github_issue", bindingId: "b1", repo: "adam/kibo", number: 42, nodeId: null, url: null },
    ],
  };
  await show(broken);
  expect(screen.getByText("Lien GitHub rompu").closest("[data-slot=badge]")?.className).toContain(
    "text-amber-700",
  );
  expect(screen.getByText("L'issue a été supprimée ou transférée.")).toBeDefined();
  expect(screen.queryByRole("link", { name: "#42" })).toBeNull();
});

test("the branch chip sits beside the PR, a stacked merge names its parent, imports stay hidden", async () => {
  const stacked: TicketView = {
    ...ticket,
    externalRefs: [
      {
        kind: "github_pr",
        url: "https://github.com/adam/kibo/pull/12",
        number: 12,
        state: "merged",
        base: "feat/a",
        head: "feat/x",
      },
      { kind: "git_branch", branch: "feat/x", base: "feat/parent" },
      { kind: "import_ref", source: "plan", id: "C0-9" },
    ],
  };
  await show(stacked);
  const header = screen.getByRole("heading", { name: "Arbre" }).parentElement;
  if (!header) throw new Error("sheet has a header");
  expect(within(header).getByRole("link", { name: "#12" }).getAttribute("title")).toBe(
    "fusionnée dans feat/a",
  );
  const branch = within(header).getByText("feat/x").closest("[data-slot=badge]");
  expect(branch?.getAttribute("title")).toBe("Base : feat/parent");
  expect(branch?.tagName).not.toBe("A");
  expect(header.textContent).not.toContain("C0-9");
  expect(screen.getByRole("heading", { name: "Arbre" }).getAttribute("title")).toBe("Importé de plan · C0-9");
});

test("an unstacked branch chip names the branch", async () => {
  await show({ ...ticket, externalRefs: [{ kind: "git_branch", branch: "feat/x", base: null }] });
  const header = screen.getByRole("heading", { name: "Arbre" }).parentElement;
  if (!header) throw new Error("sheet has a header");
  expect(within(header).getByText("feat/x").closest("[data-slot=badge]")?.getAttribute("title")).toBe(
    "Branche feat/x",
  );
  expect(screen.getByRole("heading", { name: "Arbre" }).getAttribute("title")).toBeNull();
});

test("a sync failure can be retried", async () => {
  await show();
  const alert = screen.getByRole("alert");
  expect(within(alert).getByText("Échec de synchronisation")).toBeDefined();
  expect(alert.textContent).toContain("GitHub a répondu 422, données refusées par GitHub.");
  expect(alert.textContent).not.toContain("github 422");
  await userEvent.setup().click(within(alert).getByRole("button", { name: "Réessayer" }));
  expect(calls).toContainEqual({ method: "resolveOutbox", projectId: "p1", outboxId: 7, action: "retry" });
});

const pendingCreate: TicketView = {
  ...ticket,
  externalRefs: [
    { kind: "github_issue", bindingId: "b1", repo: "adam/kibo", number: null, nodeId: null, url: null },
    ...ticket.externalRefs.filter((r) => r.kind !== "github_issue"),
  ],
};
const dropped: RpcRequest = { method: "resolveOutbox", projectId: "p1", outboxId: 7, action: "drop" };
const unlinked: RpcRequest = {
  method: "command",
  projectId: "p1",
  command: { method: "removeExternalRef", ticketId: "t1", kind: "github_issue", key: "b1" },
};
const openDrop = async () => {
  const user = userEvent.setup();
  await user.click(within(screen.getByRole("alert")).getByRole("button", { name: "Abandonner" }));
  const dialog = await screen.findByRole("alertdialog");
  return { user, dialog };
};

test("dropping a failed send asks for confirmation and can be cancelled", async () => {
  await show();
  const { user, dialog } = await openDrop();
  expect(dialog.textContent).toContain("réimportée comme un second ticket");
  expect(within(dialog).queryByRole("checkbox")).toBeNull();
  await user.click(within(dialog).getByRole("button", { name: "Annuler" }));
  expect(screen.queryByRole("alertdialog")).toBeNull();
  expect(calls).not.toContainEqual(dropped);
});

test("dropping a linked issue only drops the send", async () => {
  await show();
  const { user, dialog } = await openDrop();
  await user.click(within(dialog).getByRole("button", { name: "Abandonner" }));
  expect(calls).toContainEqual(dropped);
  expect(calls).not.toContainEqual(unlinked);
});

test("dropping a pending creation removes the GitHub link by default", async () => {
  await show(pendingCreate);
  const { user, dialog } = await openDrop();
  const box = within(dialog).getByRole("checkbox", { name: "Retirer le lien GitHub" });
  expect(box.getAttribute("aria-checked")).toBe("true");
  await user.click(within(dialog).getByRole("button", { name: "Abandonner" }));
  await waitFor(() => expect(calls).toContainEqual(unlinked));
  expect(calls.findIndex((c) => c.method === "resolveOutbox")).toBeLessThan(
    calls.findIndex((c) => c.method === "command"),
  );
});

test("dropping a pending creation can keep the GitHub link", async () => {
  await show(pendingCreate);
  const { user, dialog } = await openDrop();
  await user.click(within(dialog).getByRole("checkbox", { name: "Retirer le lien GitHub" }));
  await user.click(within(dialog).getByRole("button", { name: "Abandonner" }));
  await waitFor(() => expect(calls).toContainEqual(dropped));
  expect(calls).not.toContainEqual(unlinked);
});

test("the CI section opens the logs, filterable to errors", async () => {
  await show();
  expect(screen.getByText("3 min 12 s")).toBeDefined();
  expect(screen.getByText("Échec")).toBeDefined();
  expect(screen.getByText("PR #12")).toBeDefined();
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: "Voir les logs" }));
  expect(await screen.findByText("Logs · build")).toBeDefined();
  expect(screen.getByRole("dialog", { name: "Logs · build" }).className).toContain(
    "w-full sm:max-w-[min(90vw,720px)]",
  );
  expect(screen.getByText("CI · PR #12 · KIB-1")).toBeDefined();
  expect(await screen.findByText("2026-09-26T10:00:01Z setup")).toBeDefined();
  await user.click(screen.getByRole("switch", { name: "Erreurs seulement" }));
  expect(screen.queryByText("2026-09-26T10:00:01Z setup")).toBeNull();
  expect(screen.getByText("##[error]Test failed")).toBeDefined();
});

const frameCalls = () => calls.filter((c) => c.method === "getDesignFrame");
const mockups = () => {
  const section = screen.getByRole("heading", { name: "Maquettes" }).closest("section");
  if (!section) throw new Error("the mockups section");
  return within(section);
};

test("Mockups: each frame is a thumbnail served by the daemon, with its badges", async () => {
  await show();
  const figma = await screen.findByRole("img", { name: "Tickets / Arbre" });
  const penpot = await screen.findByRole("img", { name: "Accueil" });
  expect(figma.getAttribute("src")).toBe(`${PNG}F`);
  expect(penpot.getAttribute("src")).toBe(`${PNG}P`);
  expect([figma, penpot].map((img) => img.getAttribute("crossorigin"))).toEqual(["anonymous", "anonymous"]);
  expect(frameCalls()).toEqual([
    { method: "getDesignFrame", url: FIGMA_URL, refresh: false },
    { method: "getDesignFrame", url: PENPOT_URL, refresh: false },
  ]);
  expect(screen.getAllByText("Périmé")).toHaveLength(1);
  expect(screen.getAllByText("Hors ligne")).toHaveLength(1);
  expect(screen.getByRole("link", { name: "Ouvrir dans Figma" }).getAttribute("href")).toBe(FIGMA_URL);
  const toPenpot = screen.getByRole("link", { name: "Ouvrir dans Penpot" });
  expect(toPenpot.getAttribute("href")).toBe(PENPOT_URL);
  expect(toPenpot.getAttribute("rel")).toBe("noreferrer noopener");
});

test("Mockups: a missing Penpot thumbnail and an unconnected provider are explained", async () => {
  frames = {
    [FIGMA_URL]: () => {
      throw new KiboError("NOT_CONNECTED", "figma");
    },
    [PENPOT_URL]: () => {
      throw new KiboError("REMOTE_NOT_RENDERED", "no thumbnail");
    },
  };
  await show();
  const statuses = await mockups().findAllByRole("status");
  expect(statuses.map((s) => s.textContent)).toEqual([
    "Connecte Figma dans Paramètres › Intégrations.",
    "Pas encore d'aperçu : ouvre ce fichier dans Penpot pour le générer, puis actualise.",
  ]);
  expect(screen.queryByRole("img", { name: "Accueil" })).toBeNull();
});

test("Mockups: any other failure names its cause and can be retried", async () => {
  let down = true;
  frames = {
    [PENPOT_URL]: () => {
      throw new KiboError("REMOTE_NOT_FOUND", "gone");
    },
    [FIGMA_URL]: () => {
      if (down) throw new KiboError("REMOTE_UNAVAILABLE", "down");
      return frameOf(FIGMA_URL);
    },
  };
  await show();
  const alerts = await mockups().findAllByRole("alert");
  expect(alerts.map((a) => a.textContent)).toEqual([
    "Figma ne répond pas. Vérifie ta connexion, ou que l'instance est démarrée.",
    "Board introuvable : supprimé, ou le lien vise un autre fichier.",
  ]);
  const [retry] = mockups().getAllByRole("button", { name: "Réessayer" });
  if (!retry) throw new Error("a retry button per failed frame");
  down = false;
  await userEvent.setup().click(retry);
  expect(await screen.findByRole("img", { name: "Tickets / Arbre" })).toBeDefined();
  expect(frameCalls()).toContainEqual({ method: "getDesignFrame", url: FIGMA_URL, refresh: true });
});

test("Mockups: a failure without a code shows no empty parentheses", async () => {
  frames = {
    [PENPOT_URL]: () => {
      throw new KiboError("INTERNAL", "boom");
    },
    [FIGMA_URL]: () => {
      throw new Error("boom");
    },
  };
  await show();
  const alerts = await mockups().findAllByRole("alert");
  expect(alerts.map((a) => a.textContent)).toEqual([
    "Maquette indisponible.",
    "Maquette indisponible (INTERNAL).",
  ]);
});

test("Mockups: Actualiser asks the daemon again with refresh", async () => {
  await show();
  await screen.findByRole("img", { name: "Tickets / Arbre" });
  const [first] = screen.getAllByRole("button", { name: "Actualiser" });
  if (!first) throw new Error("a refresh button per frame");
  await userEvent.setup().click(first);
  await waitFor(() =>
    expect(frameCalls()).toContainEqual({ method: "getDesignFrame", url: FIGMA_URL, refresh: true }),
  );
  expect(await screen.findByRole("img", { name: "Tickets / Arbre" })).toBeDefined();
});

test("Mockups: a Penpot URL is linked, an invalid one is refused without a call", async () => {
  await show();
  const user = userEvent.setup();
  const input = screen.getByPlaceholderText("Colle l'URL d'un cadre Figma ou d'un board Penpot");
  await user.type(input, "https://example.com/x");
  await user.click(screen.getByRole("button", { name: "Lier un cadre" }));
  expect(
    await screen.findByText("Lien Figma (figma.com) ou Penpot (design.penpot.app ou ton instance) attendu."),
  ).toBeDefined();
  expect(input.getAttribute("aria-invalid")).toBe("true");
  expect(calls.some((c) => c.method === "linkDesignFrame")).toBe(false);
  await user.clear(input);
  await user.type(input, PENPOT_URL);
  await user.click(screen.getByRole("button", { name: "Lier un cadre" }));
  await waitFor(() =>
    expect(calls).toContainEqual({
      method: "linkDesignFrame",
      projectId: "p1",
      ticketId: "t1",
      url: PENPOT_URL,
    }),
  );
});

test("Mockups: Retirer removes the Penpot board by its key", async () => {
  await show();
  const buttons = screen.getAllByRole("button", { name: "Retirer" });
  const last = buttons[buttons.length - 1];
  if (!last) throw new Error("a remove button per frame");
  await userEvent.setup().click(last);
  expect(calls).toContainEqual({
    method: "command",
    projectId: "p1",
    command: {
      method: "removeExternalRef",
      ticketId: "t1",
      kind: "penpot_board",
      key: `${FILE}/${PAGE}/${BOARD}`,
    },
  });
});

const mockupProperty = () => {
  const term = screen.getByText("Maquette", { selector: "dt" });
  const value = term.nextElementSibling;
  if (!(value instanceof HTMLElement)) throw new Error("the property has a value");
  return value;
};

test("Mockups: the sheet scrolls when its thumbnails overflow it", async () => {
  await show();
  expect(screen.getByRole("dialog").className).toContain("overflow-y-auto");
});

test("the Maquette property shows the first frame with its provider icon", async () => {
  await show();
  const value = mockupProperty();
  expect(within(value).getByRole("link", { name: "Tickets / Arbre" }).getAttribute("href")).toBe(FIGMA_URL);
  expect(within(value).getByRole("img", { name: "Figma" })).toBeDefined();
});

test("a Penpot board first shows the Penpot icon", async () => {
  await show({ ...ticket, externalRefs: [...ticket.externalRefs].reverse() });
  const value = mockupProperty();
  expect(within(value).getByRole("link", { name: "Accueil" }).getAttribute("href")).toBe(PENPOT_URL);
  expect(within(value).getByRole("img", { name: "Penpot" })).toBeDefined();
});

test("an issue body is never rendered as HTML", async () => {
  const { container } = await show();
  expect(container.ownerDocument.querySelector("img[src='x']")).toBeNull();
  expect(screen.getByText(/<img src=x onerror=alert\(1\)>/)).toBeDefined();
});
