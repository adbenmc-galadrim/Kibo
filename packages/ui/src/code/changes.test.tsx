import { beforeEach, expect, mock, test } from "bun:test";
import {
  type CodeEvent,
  type CodeRequest,
  DEFAULT_WORKFLOW,
  type FileContent,
  type FileDiff,
  KiboError,
  type ProjectSnapshot,
  type RepoStatus,
} from "@kibo/schema";
import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const calls: CodeRequest[] = [];
const listeners = new Set<(e: CodeEvent) => void>();
let status: RepoStatus;
let overrides: Partial<Record<CodeRequest["method"], () => Promise<unknown>>> = {};
const diff: FileDiff = {
  path: "packages/core/ticket.ts",
  origPath: null,
  binary: false,
  hunkStaging: true,
  additions: 1,
  deletions: 1,
  hunks: [
    {
      header: "@@ -1,2 +1,2 @@",
      oldStart: 1,
      oldLines: 2,
      newStart: 1,
      newLines: 2,
      section: "",
      lines: [
        { kind: "del", text: "a", oldNo: 1, newNo: null, noEol: false },
        { kind: "add", text: "b", oldNo: null, newNo: 1, noEol: false },
        { kind: "context", text: "c", oldNo: 2, newNo: 2, noEol: false },
      ],
    },
  ],
};
const baseStatus: RepoStatus = {
  worktree: "/repo",
  branch: "kib-12",
  upstream: null,
  ahead: 1,
  behind: 0,
  hasHead: true,
  operation: null,
  files: [
    {
      path: "packages/core/ticket.ts",
      origPath: null,
      area: "staged",
      kind: "modified",
      additions: 1,
      deletions: 1,
    },
    {
      path: "packages/core/index.ts",
      origPath: null,
      area: "unstaged",
      kind: "modified",
      additions: 3,
      deletions: 1,
    },
  ],
  commits: [
    {
      sha: "a".repeat(40),
      shortSha: "aaaaaaa",
      subject: "feat: move",
      body: "",
      author: "Adam",
      time: 0,
      pushed: false,
    },
    {
      sha: "b".repeat(40),
      shortSha: "bbbbbbb",
      subject: "chore: init",
      body: "",
      author: "Adam",
      time: 0,
      pushed: true,
    },
  ],
};
const fileContent = (revision: FileContent["revision"]): FileContent => ({
  path: "packages/core/index.ts",
  revision,
  content: revision === "index" ? "export {};\n" : "export const a = 1;\n",
  hash: "c".repeat(40),
  size: 20,
  binary: false,
  tooLarge: false,
  lines: 1,
  modifiedAt: 0,
  tracked: true,
  dirty: true,
});
const responses: Partial<Record<CodeRequest["method"], (req: CodeRequest) => unknown>> = {
  worktrees: () => [{ path: "/repo", branch: "kib-12", head: "a".repeat(40), isMain: true }],
  status: () => status,
  diff: () => diff,
  readFile: (req) => fileContent(req.method === "readFile" ? req.revision : "worktree"),
  commitDefaults: () => ({
    ticketId: "12@1",
    ticketKey: "KIB-12",
    message: "feat: schéma Loro des tickets (KIB-12)",
    prTitle: "feat: schéma Loro des tickets (KIB-12)",
    prBody: "## Ticket\nKIB-12 · Schéma",
  }),
  remoteBranches: () => ({ remote: "origin", branches: ["main"], defaultBase: "main" }),
  ghStatus: () => ({ available: true, detail: null }),
  prForBranch: () => null,
  compare: () => ({ commits: [], fileCount: 3 }),
  createPr: () => ({ number: 7, url: "https://github.com/kibo/test/pull/7", state: "draft" }),
};
mock.module("../api", () => ({
  client: {
    code: (req: CodeRequest) => {
      calls.push(req);
      const override = overrides[req.method];
      if (override) return override();
      return Promise.resolve(responses[req.method]?.(req) ?? null);
    },
    subscribeCode: (l: (e: CodeEvent) => void) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
  },
}));
const unmockedModule = "./ChangesView?unmocked";
const { ChangesView }: typeof import("./ChangesView") = await import(unmockedModule);

const project: ProjectSnapshot = {
  meta: { id: "p1", name: "Kibo", key: "KIB", folder: "/repo", color: "#F97316" },
  workflow: DEFAULT_WORKFLOW,
  pages: [],
  tickets: [],
  links: [],
  instances: [],
  rules: [],
  bindings: [],
  nextTicketKey: "KIB-1",
};
const count = (method: CodeRequest["method"]) => calls.filter((c) => c.method === method).length;

beforeEach(() => {
  calls.length = 0;
  overrides = {};
  status = baseStatus;
});

const renderView = () =>
  render(<ChangesView project={project} worktree={null} onWorktreeChange={() => {}} onOpenFile={() => {}} />);

const enabledButton = async (name: string | RegExp) => {
  const button = await screen.findByRole("button", { name });
  await waitFor(() => expect(button.hasAttribute("disabled")).toBe(false));
  return button;
};

const prefilled = () =>
  waitFor(() =>
    expect(screen.getByLabelText("Message")).toHaveProperty(
      "value",
      "feat: schéma Loro des tickets (KIB-12)",
    ),
  );

test("the first staged file is selected, its diff shown and the message pre-filled", async () => {
  renderView();
  expect(await screen.findByRole("region", { name: "@@ -1,2 +1,2 @@" })).toBeTruthy();
  expect(calls.find((c) => c.method === "diff")).toMatchObject({
    path: "packages/core/ticket.ts",
    area: "staged",
  });
  await prefilled();
  expect(screen.getByRole("button", { name: /worktree kib-12/ })).toBeTruthy();
});

test("a stale hunk shows an alert and reloads the diff", async () => {
  overrides = { stageHunk: () => Promise.reject(new KiboError("GIT_STALE", "changed")) };
  renderView();
  await userEvent.click(await enabledButton("Désindexer le bloc"));
  expect((await screen.findByRole("alert")).textContent).toBe(
    "Le diff a changé entre-temps : il a été rechargé.",
  );
  expect(calls.find((c) => c.method === "stageHunk")).toMatchObject({
    index: 0,
    header: "@@ -1,2 +1,2 @@",
    area: "staged",
  });
  await waitFor(() => expect(count("diff")).toBeGreaterThanOrEqual(2));
});

test("committing sends the message, then prefills it again; Modifier loads the last commit into amend mode", async () => {
  renderView();
  await prefilled();
  await userEvent.clear(screen.getByLabelText("Message"));
  await userEvent.type(screen.getByLabelText("Message"), "fix: à la main");
  await userEvent.click(await enabledButton(/Commit sur kib-12/));
  expect(calls.find((c) => c.method === "commit")).toEqual({
    method: "commit",
    projectId: "p1",
    worktree: "/repo",
    message: "fix: à la main",
    amend: false,
  });
  await prefilled();
  const latest = screen.getAllByRole("listitem").find((li) => li.textContent?.includes("feat: move"));
  if (!latest) throw new Error("unpushed commit expected");
  await userEvent.click(within(latest).getByRole("button", { name: "Modifier" }));
  expect(screen.getByLabelText("Message")).toHaveProperty("value", "feat: move");
  expect(
    screen
      .getByRole("checkbox", { name: "Modifier le dernier commit (non poussé)" })
      .getAttribute("aria-checked"),
  ).toBe("true");
});

test("a rejected reword keeps its dialog open with the error", async () => {
  overrides = { reword: () => Promise.reject(new KiboError("GIT_PUSHED", "pushed")) };
  renderView();
  await prefilled();
  const latest = screen.getAllByRole("listitem").find((li) => li.textContent?.includes("feat: move"));
  if (!latest) throw new Error("unpushed commit expected");
  await userEvent.click(within(latest).getByRole("button", { name: "Reformuler" }));
  const dialog = await screen.findByRole("dialog");
  await userEvent.click(within(dialog).getByRole("button", { name: "Reformuler" }));
  expect((await within(dialog).findByRole("alert")).textContent).toBe(
    "Ce commit est déjà poussé : il ne peut plus être modifié.",
  );
});

test("a code event reloads the status", async () => {
  renderView();
  await screen.findByRole("region", { name: "@@ -1,2 +1,2 @@" });
  const before = count("status");
  act(() => {
    for (const l of listeners) l({ type: "code", projectId: "p1", worktree: "/repo" });
  });
  await waitFor(() => expect(count("status")).toBeGreaterThan(before));
});

test("editing an unstaged file reads the index and the worktree versions", async () => {
  renderView();
  await userEvent.click(await screen.findByRole("button", { name: /index\.ts/ }));
  await userEvent.click(await enabledButton("Édition"));
  await waitFor(() => expect(count("readFile")).toBe(2));
  expect(
    calls.filter((c) => c.method === "readFile").map((c) => (c.method === "readFile" ? c.revision : "")),
  ).toEqual(["index", "worktree"]);
  expect(screen.getByRole("button", { name: "Enregistrer" }).hasAttribute("disabled")).toBe(true);
});

test("push and PR creation link the ticket", async () => {
  renderView();
  await userEvent.click(await enabledButton("Pousser"));
  expect(count("push")).toBe(1);
  await userEvent.click(await enabledButton("Pousser et créer la PR"));
  const dialog = await screen.findByRole("dialog");
  expect(await within(dialog).findByText("kib-12 → main · 1 commit non poussé · 3 fichiers")).toBeTruthy();
  await userEvent.click(within(dialog).getByRole("button", { name: "Créer la PR" }));
  await waitFor(() => expect(count("createPr")).toBe(1));
  expect(calls.find((c) => c.method === "createPr")).toMatchObject({
    base: "main",
    draft: true,
    ticketId: "12@1",
  });
  expect(await screen.findByText("PR #7 créée")).toBeTruthy();
});

test("a push in progress names its target and freezes the actions", async () => {
  let finish: () => void = () => {};
  overrides = {
    push: () =>
      new Promise<void>((resolve) => {
        finish = resolve;
      }),
  };
  renderView();
  await userEvent.click(await enabledButton("Pousser"));
  const pending = await screen.findByRole("button", { name: "Envoi vers origin/kib-12…" });
  expect(pending.hasAttribute("disabled")).toBe(true);
  expect(screen.queryByRole("button", { name: "Pousser et créer la PR" })).toBeNull();
  await act(async () => finish());
  expect(await screen.findByRole("button", { name: "Pousser" })).toBeTruthy();
});

test("a failed push explains the error and offers a retry", async () => {
  overrides = {
    push: () => Promise.reject(new KiboError("GIT_FAILED", "! [rejected] kib-12 -> kib-12 (fetch first)")),
  };
  renderView();
  await userEvent.click(await enabledButton("Pousser"));
  const alert = await screen.findByRole("alert");
  expect(alert.textContent).toContain("Le push a échoué");
  expect(screen.getByLabelText("Sortie de git").textContent).toBe(
    "! [rejected] kib-12 -> kib-12 (fetch first)",
  );
  await userEvent.click(screen.getByRole("button", { name: "Réessayer" }));
  await waitFor(() => expect(count("push")).toBe(2));
});

test("an existing PR replaces the creation button, nothing to push disables Pousser", async () => {
  status = { ...baseStatus, upstream: "origin/kib-12", ahead: 0 };
  overrides = {
    prForBranch: () =>
      Promise.resolve({ number: 12, url: "https://github.com/kibo/test/pull/12", state: "open" }),
  };
  renderView();
  const link = await screen.findByRole("link", { name: "Voir la PR #12" });
  expect(link.getAttribute("href")).toBe("https://github.com/kibo/test/pull/12");
  expect(screen.getByRole("button", { name: "Pousser" }).hasAttribute("disabled")).toBe(true);
  expect(screen.getByText("Rien à pousser : la branche est à jour avec origin/kib-12.")).toBeTruthy();
});

test("without gh the PR button is disabled with an explanation, detached HEAD cannot push", async () => {
  overrides = { ghStatus: () => Promise.resolve({ available: false, detail: "gh: command not found" }) };
  status = { ...baseStatus, branch: null };
  renderView();
  const pr = await screen.findByRole("button", { name: "Pousser et créer la PR" });
  await waitFor(() => expect(pr.hasAttribute("disabled")).toBe(true));
  expect(pr.closest("[title]")?.getAttribute("title")).toBe("HEAD détachée : impossible de pousser.");
  expect(screen.getByRole("button", { name: "Pousser" }).hasAttribute("disabled")).toBe(true);
});

test("without gh on a branch the PR button explains gh is missing", async () => {
  overrides = { ghStatus: () => Promise.resolve({ available: false, detail: "gh: command not found" }) };
  renderView();
  const pr = await screen.findByRole("button", { name: "Pousser et créer la PR" });
  await waitFor(() =>
    expect(pr.closest("[title]")?.getAttribute("title")).toBe("GitHub CLI (gh) introuvable ou non connecté."),
  );
  expect(pr.hasAttribute("disabled")).toBe(true);
});

test("a project without repository explains how to link one", async () => {
  overrides = { worktrees: () => Promise.reject(new KiboError("NOT_A_REPO", "no folder")) };
  renderView();
  expect(await screen.findByText(/Ce projet n'est lié à aucun dépôt git/)).toBeTruthy();
});

test("a clean worktree says so", async () => {
  status = { ...baseStatus, files: [] };
  renderView();
  expect(await screen.findByText("Aucun changement dans ce worktree.")).toBeTruthy();
});

test("an operation in progress shows a banner with an abort action", async () => {
  status = { ...baseStatus, operation: "merge" };
  renderView();
  expect(await screen.findByText(/Fusion en cours/)).toBeTruthy();
  await userEvent.click(await enabledButton("Abandonner"));
  expect(count("abortOperation")).toBe(1);
});

test("Commiter d'abord closes the PR dialog and leaves the focus on the message", async () => {
  renderView();
  await prefilled();
  await userEvent.click(await enabledButton("Pousser et créer la PR"));
  const dialog = await screen.findByRole("dialog");
  await userEvent.click(within(dialog).getByRole("button", { name: "Commiter d'abord" }));
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  await act(async () => {
    await new Promise((r) => setTimeout(r, 30));
  });
  expect(document.activeElement).toBe(screen.getByLabelText("Message"));
});
