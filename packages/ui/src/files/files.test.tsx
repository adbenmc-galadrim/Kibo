import { afterEach, beforeEach, expect, mock, test } from "bun:test";
import { type CodeEvent, type CodeRequest, type FileContent, KiboError } from "@kibo/schema";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { apiMock } from "../api-mock";

const calls: CodeRequest[] = [];
const listeners = new Set<(e: CodeEvent) => void>();
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

mock.module("../api", () =>
  apiMock({
    client: {
      code: (req: CodeRequest) => {
        calls.push(req);
        if (req.method === "worktrees")
          return Promise.resolve([{ path: "/repo", branch: "kib-12", head: "a".repeat(40), isMain: true }]);
        if (req.method === "readFile") return readOutcome();
        if (req.method === "writeFile") return writeOutcome();
        return Promise.resolve(null);
      },
      subscribeCode: (l: (e: CodeEvent) => void) => {
        listeners.add(l);
        return () => listeners.delete(l);
      },
    },
  }),
);
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
  localStorage.clear();
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
  expect(screen.getByText("Ligne 4 · Col 3")).toBeTruthy();
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

function setPlatform(platform: string): () => void {
  const original = navigator.platform;
  Object.defineProperty(navigator, "platform", { value: platform, configurable: true });
  return () => Object.defineProperty(navigator, "platform", { value: original, configurable: true });
}

test("the footer shows the external editor shortcut of the running platform", async () => {
  const restoreMac = setPlatform("MacIntel");
  try {
    const { unmount } = render(<FilePreviewSheet fileRef={ref} onClose={() => {}} onOpenInTab={() => {}} />);
    expect(await screen.findByText("⌘⇧O ouvrir dans l'éditeur externe · Esc fermer")).toBeTruthy();
    unmount();
  } finally {
    restoreMac();
  }
  const restoreLinux = setPlatform("Linux x86_64");
  try {
    render(<FilePreviewSheet fileRef={ref} onClose={() => {}} onOpenInTab={() => {}} />);
    expect(await screen.findByText("Ctrl+Shift+O ouvrir dans l'éditeur externe · Esc fermer")).toBeTruthy();
  } finally {
    restoreLinux();
  }
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

const reads = () => calls.filter((c) => c.method === "readFile").length;
const emitCode = (worktree: string) =>
  act(async () => {
    for (const l of listeners) l({ type: "code", projectId: "p1", worktree });
    await new Promise((r) => setTimeout(r, 20));
  });

test("the preview re-reads the file when its worktree changes", async () => {
  render(<FilePreviewSheet fileRef={ref} onClose={() => {}} onOpenInTab={() => {}} />);
  await waitFor(() => expect(document.querySelector('[data-line="4"]')).toBeTruthy());
  readOutcome = () =>
    Promise.resolve({ ...content, content: "export const changed = 1;\n", hash: "c".repeat(40), lines: 1 });
  await emitCode("/elsewhere");
  expect(reads()).toBe(1);
  await emitCode("/repo");
  await waitFor(() => expect(document.body.textContent).toContain("export const changed = 1;"));
});

test("a file tab being edited is not re-read on a change", async () => {
  render(<FileTabView fileRef={ref} startEditing />);
  await screen.findByRole("textbox", { name: "packages/core/ticket.ts" });
  const before = reads();
  await emitCode("/repo");
  expect(reads()).toBe(before);
});

test("a remote view previews the file without Modifier nor the external editor, even when asked to edit", async () => {
  render(<FileTabView fileRef={ref} startEditing remote />);
  expect(await screen.findByText(/n'est possible que sur l'ordinateur où tourne Kibo/)).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Modifier" })).toBeNull();
  expect(screen.queryByRole("button", { name: "Ouvrir dans l'éditeur externe" })).toBeNull();
  expect(screen.queryByRole("button", { name: /Enregistrer/ })).toBeNull();
  expect(screen.queryByRole("textbox")).toBeNull();
});

test("a remote preview hides Modifier and the external editor, and ignores the shortcut", async () => {
  render(<FilePreviewSheet fileRef={ref} onClose={() => {}} onOpenInTab={() => {}} remote />);
  expect(await screen.findByText(/worktree kib-12 · TypeScript/)).toBeTruthy();
  expect(screen.getByRole("button", { name: "Ouvrir dans un onglet" })).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Modifier" })).toBeNull();
  expect(screen.queryByRole("button", { name: "Ouvrir dans l'éditeur externe" })).toBeNull();
  fireEvent.keyDown(window, { key: "O", metaKey: true, shiftKey: true });
  await act(() => Promise.resolve());
  expect(calls.some((c) => c.method === "openInEditor")).toBe(false);
});

const appRef = { ...ref, path: "src/app.ts", line: null, origin: null };
const appContent: FileContent = {
  ...content,
  path: "src/app.ts",
  content: "const Kibo = 1;\nkibo.run();\nexport { KIBO };\n",
  lines: 4,
};

const clipboard = Object.getOwnPropertyDescriptor(navigator, "clipboard");
afterEach(() => {
  if (clipboard) Object.defineProperty(navigator, "clipboard", clipboard);
  else Reflect.deleteProperty(navigator, "clipboard");
});

function setClipboard(writeText: (text: string) => Promise<void>): void {
  Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
}

function captureClipboard(): string[] {
  const copied: string[] = [];
  setClipboard(async (text) => {
    copied.push(text);
  });
  return copied;
}

test("screen 124: wrap is on by default and remembered, the search highlights and steps, :n goes to a line, the path is copied", async () => {
  readOutcome = () => Promise.resolve(appContent);
  const copied = captureClipboard();
  render(<FilePreviewSheet fileRef={appRef} onClose={() => {}} onOpenInTab={() => {}} />);
  const wrap = await screen.findByRole("switch", { name: "Retour à la ligne" });
  expect(wrap.getAttribute("aria-checked")).toBe("true");
  await waitFor(() => expect(document.querySelector("code")?.className).toContain("whitespace-pre-wrap"));
  fireEvent.click(wrap);
  expect(localStorage.getItem("kibo.wrap")).toBe("off");
  expect(document.querySelector("code")?.className).toContain("whitespace-pre");
  expect(document.querySelector("code")?.className).not.toContain("whitespace-pre-wrap");
  fireEvent.keyDown(screen.getByRole("dialog"), { key: "f", metaKey: true });
  const find = screen.getByRole("searchbox", { name: "Rechercher ou :ligne" });
  fireEvent.change(find, { target: { value: "kibo" } });
  expect(screen.getByText("1 / 3")).toBeTruthy();
  await waitFor(() => expect(document.querySelectorAll("mark")).toHaveLength(3));
  expect(
    document.querySelector('mark[aria-current="true"]')?.closest("[data-line]")?.getAttribute("data-line"),
  ).toBe("1");
  expect(screen.getByText("Ligne 1 · Col 7")).toBeTruthy();
  fireEvent.keyDown(find, { key: "Enter" });
  expect(screen.getByText("2 / 3")).toBeTruthy();
  fireEvent.keyDown(find, { key: "Enter", shiftKey: true });
  expect(screen.getByText("1 / 3")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Occurrence précédente" }));
  expect(screen.getByText("3 / 3")).toBeTruthy();
  fireEvent.change(find, { target: { value: ":2" } });
  expect(screen.getByText("Ligne 2 · Col 1")).toBeTruthy();
  expect(document.querySelectorAll("mark")).toHaveLength(0);
  expect(document.querySelector('[data-line="2"]')?.getAttribute("aria-current")).toBe("location");
  fireEvent.click(screen.getByRole("button", { name: "Copier le chemin" }));
  await waitFor(() => expect(copied).toEqual(["src/app.ts"]));
  fireEvent.keyDown(find, { key: "Escape" });
  expect(screen.queryByRole("searchbox")).toBeNull();
  expect(screen.getByRole("dialog")).toBeTruthy();
});

test("the wrap preference is shared with the file tab, which also searches", async () => {
  localStorage.setItem("kibo.wrap", "off");
  readOutcome = () => Promise.resolve(appContent);
  render(<FileTabView fileRef={appRef} startEditing={false} />);
  const wrap = await screen.findByRole("switch", { name: "Retour à la ligne" });
  expect(wrap.getAttribute("aria-checked")).toBe("false");
  await waitFor(() => expect(document.querySelector("code")?.className).toContain("whitespace-pre"));
  fireEvent.keyDown(wrap, { key: "f", ctrlKey: true });
  fireEvent.change(screen.getByRole("searchbox", { name: "Rechercher ou :ligne" }), {
    target: { value: "nothing" },
  });
  expect(screen.getByText("0 / 0")).toBeTruthy();
});

test("a failed copy of the path is shown", async () => {
  readOutcome = () => Promise.resolve(appContent);
  setClipboard(() => Promise.reject(new Error("denied")));
  render(<FilePreviewSheet fileRef={appRef} onClose={() => {}} onOpenInTab={() => {}} />);
  fireEvent.click(await screen.findByRole("button", { name: "Copier le chemin" }));
  expect((await screen.findByRole("alert")).textContent).toBe("Impossible de copier le chemin.");
});
