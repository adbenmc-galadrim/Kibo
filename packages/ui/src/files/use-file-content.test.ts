import { expect, mock, test } from "bun:test";
import type { CodeEvent, CodeRequest, FileContent } from "@kibo/schema";
import { act, renderHook, waitFor } from "@testing-library/react";
import { apiMock } from "../api-mock";

const reads: CodeRequest[] = [];
const listeners = new Set<(e: CodeEvent) => void>();
const content: FileContent = {
  path: "src/a.ts",
  revision: "worktree",
  content: "export const a = 1;\n",
  hash: "a".repeat(40),
  size: 20,
  binary: false,
  tooLarge: false,
  lines: 1,
  modifiedAt: 0,
  tracked: true,
  dirty: false,
};

mock.module("../api", () =>
  apiMock({
    client: {
      code: (req: CodeRequest) => {
        if (req.method === "worktrees")
          return Promise.resolve([{ path: "/repo", branch: "main", head: "a".repeat(40), isMain: true }]);
        reads.push(req);
        return Promise.resolve(content);
      },
      subscribeCode: (l: (e: CodeEvent) => void) => {
        listeners.add(l);
        return () => listeners.delete(l);
      },
    },
  }),
);
const { useFileContent } = await import("./use-file-content");

const emit = (paths?: string[]) =>
  act(async () => {
    for (const l of listeners)
      l({ type: "code", projectId: "p1", worktree: "/repo", ...(paths ? { paths } : {}) });
    await new Promise((r) => setTimeout(r, 10));
  });

test("the preview is read again only when the event may concern its file", async () => {
  const ref = { projectId: "p1", worktree: null, path: "src/a.ts", line: null, origin: null };
  const { result } = renderHook(() => useFileContent(ref));
  await waitFor(() => expect(result.current.content).not.toBeNull());
  reads.length = 0;
  await emit(["src/b.ts", "README.md"]);
  expect(reads).toEqual([]);
  await emit(["src/a.ts"]);
  expect(reads).toHaveLength(1);
  await emit(["src"]);
  expect(reads).toHaveLength(2);
  await emit();
  expect(reads).toHaveLength(3);
});
