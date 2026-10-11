import { expect, mock, test } from "bun:test";
import type { RunView, Worktree } from "@kibo/schema";
import { renderHook, waitFor } from "@testing-library/react";
import { runFixture } from "../agents/fixtures";
import { apiMock } from "../api-mock";

const WT = "/repo/.kibo/worktrees/kib-14";
const worktrees: Worktree[] = [
  { path: "/repo", branch: "main", head: "a1", isMain: true },
  { path: WT, branch: "kib-14", head: "b2", isMain: false },
];

mock.module("../api", () =>
  apiMock({
    client: {
      rpc: () => Promise.resolve(null),
      code: () => Promise.resolve(worktrees),
      subscribeCode: () => () => {},
    },
  }),
);

const { fileRefOf } = await import("./file-context");
const { useRunFileContext } = await import("./use-run-file-context");

const run = (p: Partial<RunView>) =>
  runFixture({ id: "r41", projectId: "kibo", ticketKey: "KIB-14", label: "opus-dev-2", ...p });

const contextOf = async (r: RunView) => {
  const { result } = renderHook(() => useRunFileContext(r));
  await new Promise((resolve) => setTimeout(resolve, 10));
  return result.current;
};

test("a run in a subfolder opens its files in the worktree that owns that folder", async () => {
  const { result } = renderHook(() => useRunFileContext(run({ cwd: `${WT}/packages/ui` })));
  await waitFor(() =>
    expect(result.current).toEqual({ projectId: "kibo", worktree: WT, origin: "KIB-14 · opus-dev-2" }),
  );
});

test("an isolated run, or one outside every worktree, has no file context", async () => {
  expect(await contextOf(run({ cwd: "/repo/tmp/iso", workspace: "isolated" }))).toBeNull();
  expect(await contextOf(run({ cwd: "/elsewhere" }))).toBeNull();
});

test("a file target becomes a path relative to the worktree, a search or an outside path does not", () => {
  const ctx = { projectId: "kibo", worktree: WT, origin: "KIB-14 · opus-dev-2" };
  expect(fileRefOf(ctx, "edit", `${WT}/src/a.ts`)).toEqual({
    projectId: "kibo",
    worktree: WT,
    path: "src/a.ts",
    line: null,
    origin: "KIB-14 · opus-dev-2",
  });
  expect(fileRefOf(ctx, "read", "src/b.ts")?.path).toBe("src/b.ts");
  expect(fileRefOf(ctx, "read", "/etc/passwd")).toBeNull();
  expect(fileRefOf(ctx, "read", "../outside.ts")).toBeNull();
  expect(fileRefOf(ctx, "search", "src/a.ts")).toBeNull();
  expect(fileRefOf(ctx, "command", "bun test")).toBeNull();
  expect(fileRefOf(null, "read", "src/a.ts")).toBeNull();
});
