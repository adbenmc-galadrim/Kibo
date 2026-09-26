import { beforeEach, expect, mock, test } from "bun:test";
import {
  DEFAULT_WORKFLOW,
  KiboError,
  type ProjectSnapshot,
  type RpcRequest,
  type TicketView,
} from "@kibo/schema";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const calls: RpcRequest[] = [];
const replies: Record<string, (req: RpcRequest) => unknown> = {
  getSyncState: () => ({
    bindings: [],
    pending: ["t1"],
    errors: [
      { outboxId: 7, ticketId: "t1", code: "REMOTE_REJECTED", message: "github 422: Validation Failed" },
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
  getCiLog: () => ({ text: "setup\n##[error]Test failed\ndone\n", truncated: false, errorLines: [2] }),
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

const { TicketDetail } = await import("../TicketDetail");

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
    <TicketDetail project={{ ...project, tickets: [shown] }} ticket={shown} onOpenFile={() => {}} />,
  );
  await screen.findByRole("alert");
  if (shown.externalRefs.some((r) => r.kind === "github_pr")) await screen.findByText("3 min 12 s");
  if (shown.externalRefs.some((r) => r.kind === "figma_node")) await screen.findByText("Figma non joignable");
  return view;
};

beforeEach(() => {
  calls.length = 0;
});

test("GitHub chips link to the issue and the PR", async () => {
  await show();
  expect(screen.getByRole("link", { name: "#42" }).getAttribute("href")).toBe(
    "https://github.com/adam/kibo/issues/42",
  );
  expect(screen.getByRole("link", { name: "#12" }).getAttribute("href")).toBe(
    "https://github.com/adam/kibo/pull/12",
  );
});

test("a broken issue link shows a badge instead of a link", async () => {
  const broken: TicketView = {
    ...ticket,
    externalRefs: [
      { kind: "github_issue", bindingId: "b1", repo: "adam/kibo", number: 42, nodeId: null, url: null },
    ],
  };
  await show(broken);
  expect(screen.getByText("Lien GitHub rompu")).toBeDefined();
  expect(screen.queryByRole("link", { name: "#42" })).toBeNull();
});

test("a sync failure can be retried", async () => {
  await show();
  const alert = screen.getByRole("alert");
  expect(alert.textContent).toContain("github 422: Validation Failed");
  await userEvent.setup().click(within(alert).getByRole("button", { name: "Réessayer" }));
  expect(calls).toContainEqual({ method: "resolveOutbox", projectId: "p1", outboxId: 7, action: "retry" });
});

test("the CI section opens the logs, filterable to errors", async () => {
  await show();
  expect(screen.getByText("3 min 12 s")).toBeDefined();
  expect(screen.getByText("Échec")).toBeDefined();
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: "Voir les logs" }));
  expect(await screen.findByText("Logs · build")).toBeDefined();
  expect(await screen.findByText("setup")).toBeDefined();
  await user.click(screen.getByRole("switch", { name: "Erreurs seulement" }));
  expect(screen.queryByText("setup")).toBeNull();
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
