import { afterEach, beforeEach, expect, jest, mock, test } from "bun:test";
import {
  type CodeRequest,
  KiboError,
  type KiboErrorCode,
  type RepoStatus,
  type Worktree,
} from "@kibo/schema";
import { act, renderHook, waitFor } from "@testing-library/react";
import { apiMock } from "../api-mock";

type Reply = () => Promise<unknown>;
const calls: CodeRequest["method"][] = [];
let worktreesReply: Reply;
let statusReply: Reply;

const main: Worktree = { path: "/repo", branch: "main", head: "a".repeat(40), isMain: true };
const status: RepoStatus = {
  worktree: "/repo",
  branch: "main",
  upstream: null,
  ahead: 0,
  behind: 0,
  hasHead: true,
  operation: null,
  files: [{ path: "a.ts", origPath: null, area: "unstaged", kind: "modified", additions: 1, deletions: 0 }],
  commits: [],
};
const never: Reply = () => new Promise(() => {});
const ok =
  (value: unknown): Reply =>
  () =>
    Promise.resolve(value);
const failing =
  (code: KiboErrorCode): Reply =>
  () =>
    Promise.reject(new KiboError(code, `${code} failure`));

mock.module("../api", () =>
  apiMock({
    client: {
      code: (req: CodeRequest) => {
        calls.push(req.method);
        return req.method === "worktrees" ? worktreesReply() : statusReply();
      },
      subscribeCode: () => () => {},
    },
  }),
);

const { useProjectGit } = await import("./use-project-git");
const { GIT_RETRY_MS } = await import("./use-worktrees");

beforeEach(() => {
  calls.length = 0;
  worktreesReply = ok([main]);
  statusReply = ok(status);
});
afterEach(() => jest.useRealTimers());

const freshProject = () => crypto.randomUUID();
const renderGit = (folder: string | null) => {
  const projectId = freshProject();
  return renderHook(() => useProjectGit(projectId, folder));
};

test("the repository is known as soon as its worktrees answer, before the status", async () => {
  statusReply = never;
  const { result } = renderGit("/repo");
  await waitFor(() => expect(result.current.hasRepo).toBe(true));
  expect(result.current.changesCount).toBeNull();
});

test("a worktrees failure keeps the repository, reports the error and retries", async () => {
  jest.useFakeTimers();
  worktreesReply = failing("GIT_FAILED");
  const { result } = renderGit("/repo");
  await act(async () => {});
  expect(result.current.hasRepo).toBe(true);
  expect(result.current.error).toContain("GIT_FAILED failure");
  worktreesReply = ok([main]);
  await act(async () => {
    jest.advanceTimersByTime(GIT_RETRY_MS);
  });
  expect(result.current.error).toBeNull();
  expect(result.current.changesCount).toBe(1);
});

test("a later worktrees failure keeps the known worktrees", async () => {
  jest.useFakeTimers();
  const { result } = renderGit("/repo");
  await act(async () => {});
  expect(result.current.changesCount).toBe(1);
  worktreesReply = failing("GIT_FAILED");
  statusReply = never;
  await act(async () => {
    jest.advanceTimersByTime(GIT_RETRY_MS);
  });
  expect(result.current.worktrees).toEqual([main]);
});

test("a status failure keeps the repository and retries the status", async () => {
  jest.useFakeTimers();
  statusReply = failing("GIT_FAILED");
  const { result } = renderGit("/repo");
  await act(async () => {});
  expect(result.current.hasRepo).toBe(true);
  expect(result.current.error).toContain("GIT_FAILED failure");
  statusReply = ok(status);
  await act(async () => {
    jest.advanceTimersByTime(GIT_RETRY_MS);
  });
  expect(result.current.error).toBeNull();
  expect(result.current.changesCount).toBe(1);
});

test("a folder outside any repository has no Changements and is not retried", async () => {
  jest.useFakeTimers();
  worktreesReply = failing("NOT_A_REPO");
  const { result } = renderGit("/tmp/plain");
  await act(async () => {});
  await act(async () => {
    jest.advanceTimersByTime(GIT_RETRY_MS * 3);
  });
  expect(result.current.hasRepo).toBe(false);
  expect(result.current.error).toBeNull();
  expect(calls).toEqual(["worktrees"]);
});

test("a project without folder has no repository", () => {
  const { result } = renderGit(null);
  expect(result.current.hasRepo).toBe(false);
  expect(calls).toEqual([]);
});
