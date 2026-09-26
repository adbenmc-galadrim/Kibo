import { beforeEach, expect, mock, test } from "bun:test";
import {
  DEFAULT_WORKFLOW,
  KiboError,
  type ProjectSnapshot,
  type RpcRequest,
  type TicketView,
} from "@kibo/schema";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

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
  getFigmaPreview: () => ({ png: null, fetchedAt: null, reachable: false, available: false }),
  linkFigmaNode: () => {
    throw new KiboError("INVALID_INPUT", "not a figma node url");
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
  title: "Arbre",
  description: "<img src=x onerror=alert(1)> **gras**",
  statusId: "in_progress",
  parentId: null,
  assignee: null,
  domainId: null,
  blockedReason: null,
  externalRefs: [
    {
      kind: "github_issue",
      bindingId: "b1",
      repo: "adam/kibo",
      number: 42,
      nodeId: "I_42",
      url: "https://github.com/adam/kibo/issues/42",
    },
    { kind: "github_pr", url: "https://github.com/adam/kibo/pull/12", number: 12, state: "open" },
    {
      kind: "figma_node",
      fileKey: "AbC123xyz",
      nodeId: "12:34",
      url: "https://www.figma.com/design/AbC123xyz/Kibo?node-id=12-34",
      name: "Tickets / Arbre",
    },
  ],
  progress: { done: 0, total: 0 },
  waitingOn: [],
};
const project: ProjectSnapshot = {
  meta: { id: "p1", name: "Kibo", key: "KIB", folder: null, color: "#14B8A6" },
  workflow: DEFAULT_WORKFLOW,
  pages: [],
  links: [],
  instances: [],
  rules: [],
  bindings: [],
  nextTicketKey: "KIB-2",
  tickets: [ticket],
};
const show = async (shown: TicketView = ticket) => {
  const view = render(
    <TicketSheet
      project={{ ...project, tickets: [shown] }}
      ticketId={shown.id}
      domains={[]}
      onClose={() => {}}
      onAssign={() => {}}
      onOpenInTab={() => {}}
      onOpenFile={() => {}}
    />,
  );
  await screen.findByRole("alert");
  if (shown.externalRefs.some((r) => r.kind === "github_pr")) await screen.findByText("3 min 12 s");
  if (shown.externalRefs.some((r) => r.kind === "figma_node")) await screen.findByText("Figma non joignable");
  return view;
};

beforeEach(() => {
  calls.length = 0;
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
  render(<TicketTab project={project} ticketId="t1" onOpenFile={() => {}} />);
  const header = screen.getByRole("heading", { name: "Arbre" }).parentElement;
  if (!header) throw new Error("tab has a header");
  expect(await within(header).findByRole("link", { name: "#42" })).toBeDefined();
  expect(within(header).getByRole("link", { name: "#12" })).toBeDefined();
  await screen.findByText("Figma non joignable");
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
  expect(screen.getByText("CI · PR #12 · KIB-1")).toBeDefined();
  expect(await screen.findByText("2026-09-26T10:00:01Z setup")).toBeDefined();
  await user.click(screen.getByRole("switch", { name: "Erreurs seulement" }));
  expect(screen.queryByText("2026-09-26T10:00:01Z setup")).toBeNull();
  expect(screen.getByText("##[error]Test failed")).toBeDefined();
});

test("Figma: unreachable badge, invalid URL message and unlink", async () => {
  await show();
  expect(screen.getByText("Figma non joignable")).toBeDefined();
  expect(screen.getAllByText("Tickets / Arbre").length).toBeGreaterThan(0);
  const user = userEvent.setup();
  await user.type(
    screen.getByPlaceholderText("Colle l'URL d'un nœud Figma (figma.com/design/…?node-id=…)"),
    "https://example.com/x",
  );
  await user.click(screen.getByRole("button", { name: "Lier un nœud Figma" }));
  expect(await screen.findByText("URL Figma invalide : il faut un lien de nœud (node-id).")).toBeDefined();
  expect(screen.getByRole("textbox", { name: "Lier un nœud Figma" }).getAttribute("aria-invalid")).toBe(
    "true",
  );
  await user.click(screen.getByRole("button", { name: "Retirer" }));
  expect(calls).toContainEqual({
    method: "command",
    projectId: "p1",
    command: { method: "removeExternalRef", ticketId: "t1", kind: "figma_node", key: "AbC123xyz:12:34" },
  });
});

test("an issue body is never rendered as HTML", async () => {
  const { container } = await show();
  expect(container.ownerDocument.querySelector("img[src='x']")).toBeNull();
  expect(screen.getByText(/<img src=x onerror=alert\(1\)>/)).toBeDefined();
});
