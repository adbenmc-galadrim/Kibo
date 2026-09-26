import { beforeEach, expect, mock, test } from "bun:test";
import { type CodeRequest, type FileContent, KiboError } from "@kibo/schema";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const calls: CodeRequest[] = [];
let writeOutcome: () => Promise<unknown> = () => Promise.resolve({ hash: "b".repeat(40) });
const content: FileContent = {
  path: "packages/core/ticket.ts",
  revision: "worktree",
  content: 'import { z } from "zod";\n\nexport const TicketSchema = z.object({\n  id: z.string(),\n});\n',
  hash: "a".repeat(40),
  size: 90,
  binary: false,
  tooLarge: false,
  lines: 5,
  modifiedAt: Date.now() - 8 * 60_000,
  tracked: true,
  dirty: true,
};
let readOutcome: () => Promise<unknown> = () => Promise.resolve(content);

mock.module("../api", () => ({
  client: {
    code: (req: CodeRequest) => {
      calls.push(req);
      if (req.method === "worktrees")
        return Promise.resolve([{ path: "/repo", branch: "kib-12", head: "a".repeat(40), isMain: true }]);
      if (req.method === "readFile") return readOutcome();
      if (req.method === "writeFile") return writeOutcome();
      return Promise.resolve(null);
    },
    subscribeCode: () => () => {},
  },
}));
const { FilePreviewSheet } = await import("./FilePreviewSheet");
const { FileTabView } = await import("./FileTabView");
const { languageOf, highlightLines, plainTokens, MAX_HIGHLIGHT_LINES } = await import("./highlight");

const ref = {
  projectId: "p1",
  worktree: null,
  path: "packages/core/ticket.ts",
  line: 4,
  origin: "KIB-12 · PostToolUse Edit",
};

beforeEach(() => {
  calls.length = 0;
  readOutcome = () => Promise.resolve(content);
  writeOutcome = () => Promise.resolve({ hash: "b".repeat(40) });
});

test("languages come from the extension, unknown ones are plain text", () => {
  expect(languageOf("a/ticket.ts")).toEqual({ id: "typescript", label: "TypeScript" });
  expect(languageOf("Makefile")).toEqual({ id: "text", label: "Texte brut" });
  expect(languageOf(".gitignore")).toEqual({ id: "text", label: "Texte brut" });
});

test("Shiki highlights TypeScript with light and dark colours", async () => {
  const lines = await highlightLines("const a = 1;", "typescript");
  expect(lines[0]?.map((t) => t.content).join("")).toBe("const a = 1;");
  expect(lines[0]?.some((t) => t.light && t.dark)).toBe(true);
});

test("unknown languages and huge files stay plain text", async () => {
  expect(await highlightLines("a\nb", "text")).toEqual(plainTokens("a\nb"));
  const huge = "x\n".repeat(MAX_HIGHLIGHT_LINES);
  expect(await highlightLines(huge, "typescript")).toEqual(plainTokens(huge));
});

test("the preview shows the header, metadata, highlighted line and footer", async () => {
  const events: string[] = [];
  render(
    <FilePreviewSheet
      fileRef={ref}
      onClose={() => events.push("close")}
      onOpenInTab={(edit) => events.push(`tab:${edit}`)}
    />,
  );
  expect(await screen.findByText("Ouvert depuis KIB-12 · PostToolUse Edit")).toBeTruthy();
  expect(
    await screen.findByText(/worktree kib-12 · TypeScript · 5 lignes · modifié il y a 8 min · non commité/),
  ).toBeTruthy();
  await waitFor(() =>
    expect(document.querySelector('[data-line="4"]')?.getAttribute("aria-current")).toBe("location"),
  );
  expect(screen.getByText("Ligne 4, col 3")).toBeTruthy();
  await userEvent.click(screen.getByRole("button", { name: "Ouvrir dans un onglet" }));
  await userEvent.click(screen.getByRole("button", { name: "Modifier" }));
  await userEvent.click(screen.getByRole("button", { name: "Fermer l'aperçu" }));
  expect(events).toEqual(["tab:false", "tab:true", "close"]);
  fireEvent.keyDown(window, { key: "O", metaKey: true, shiftKey: true });
  await waitFor(() => expect(calls.some((c) => c.method === "openInEditor")).toBe(true));
  expect(calls.find((c) => c.method === "openInEditor")).toEqual({
    method: "openInEditor",
    projectId: "p1",
    worktree: "/repo",
    path: "packages/core/ticket.ts",
    line: 4,
  });
});

test("a binary file is not previewed", async () => {
  readOutcome = () => Promise.resolve({ ...content, content: null, hash: null, binary: true });
  render(<FilePreviewSheet fileRef={ref} onClose={() => {}} onOpenInTab={() => {}} />);
  expect(await screen.findByText("Fichier binaire : aperçu indisponible.")).toBeTruthy();
  expect(document.querySelector("[data-line]")).toBeNull();
});

test("a failed read is shown as an alert", async () => {
  readOutcome = () => Promise.reject(new KiboError("PATH_OUTSIDE_PROJECT", "denied"));
  render(<FilePreviewSheet fileRef={ref} onClose={() => {}} onOpenInTab={() => {}} />);
  expect((await screen.findByRole("alert")).textContent).toBe("Chemin hors du projet : accès refusé.");
});

test("saving writes the draft against the hash that was read", async () => {
  render(<FileTabView fileRef={ref} startEditing />);
  const editor = await screen.findByRole("textbox", { name: "packages/core/ticket.ts" });
  fireEvent.keyDown(editor, { key: "s", metaKey: true });
  fireEvent.keyDown(editor, { key: "s", ctrlKey: true });
  await waitFor(() => expect(calls.filter((c) => c.method === "writeFile").length).toBeGreaterThan(0));
  expect(calls.find((c) => c.method === "writeFile")).toMatchObject({
    worktree: "/repo",
    path: "packages/core/ticket.ts",
    content: content.content,
    baseHash: "a".repeat(40),
  });
  await waitFor(() => expect(screen.queryByRole("alert")).toBeNull());
});

test("saving a file changed on disk shows an alert and offers a reload", async () => {
  writeOutcome = () => Promise.reject(new KiboError("FILE_CHANGED", "hash mismatch"));
  render(<FileTabView fileRef={ref} startEditing />);
  const editor = await screen.findByRole("textbox", { name: "packages/core/ticket.ts" });
  fireEvent.keyDown(editor, { key: "s", metaKey: true });
  fireEvent.keyDown(editor, { key: "s", ctrlKey: true });
  expect((await screen.findByRole("alert")).textContent).toContain("Le fichier a changé sur le disque");
  expect(calls.find((c) => c.method === "writeFile")).toMatchObject({ baseHash: "a".repeat(40) });
  const reads = calls.filter((c) => c.method === "readFile").length;
  await userEvent.click(screen.getByRole("button", { name: "Recharger" }));
  await waitFor(() => expect(calls.filter((c) => c.method === "readFile").length).toBe(reads + 1));
  await waitFor(() => expect(screen.queryByRole("alert")).toBeNull());
});

test("an unknown worktree is reported instead of loading forever", async () => {
  render(
    <FilePreviewSheet
      fileRef={{ ...ref, worktree: "/elsewhere" }}
      onClose={() => {}}
      onOpenInTab={() => {}}
    />,
  );
  expect((await screen.findByRole("alert")).textContent).toBe("Élément introuvable.");
  expect(calls.some((c) => c.method === "readFile")).toBe(false);
});
