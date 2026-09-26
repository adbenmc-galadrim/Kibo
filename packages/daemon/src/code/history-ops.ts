import { type CommitInfo, KiboError } from "@kibo/schema";
import { currentBranch, currentOperation, headCommit, isPushed } from "./read";
import { optional } from "./read-file";
import type { WorktreeHandle } from "./repo";
import { firstLine, WRITE_TIMEOUT_MS } from "./run";

const MESSAGE_FLAGS = ["--cleanup=whitespace", "-F", "-"];

async function resolveCommit(h: WorktreeHandle, sha: string): Promise<string> {
  const resolved = await optional(h, ["rev-parse", "--verify", "-q", `${sha}^{commit}`]);
  if (!resolved) throw new KiboError("NOT_FOUND", `commit ${sha} not found`);
  return resolved;
}

async function assertUnpushed(h: WorktreeHandle, sha: string): Promise<void> {
  if (await isPushed(h, sha)) throw new KiboError("GIT_PUSHED", `${sha.slice(0, 7)} is already pushed`);
}

async function assertIdle(h: WorktreeHandle): Promise<void> {
  const op = await currentOperation(h);
  if (op) throw new KiboError("GIT_BUSY", `${op} in progress`);
}

async function assertInBranch(h: WorktreeHandle, sha: string): Promise<void> {
  const r = await h.git.run(["merge-base", "--is-ancestor", sha, "HEAD"]);
  if (r.code === 1) throw new KiboError("INVALID_INPUT", `${sha.slice(0, 7)} is not in the current branch`);
  if (r.code !== 0) throw new KiboError("GIT_FAILED", `git merge-base: ${firstLine(r.stderr)}`);
}

async function parentOf(h: WorktreeHandle, sha: string): Promise<string | null> {
  return (await optional(h, ["rev-parse", "--verify", "-q", `${sha}^`])) || null;
}

async function editableCommit(h: WorktreeHandle, sha: string): Promise<string> {
  await assertIdle(h);
  const target = await resolveCommit(h, sha);
  await assertUnpushed(h, target);
  await assertInBranch(h, target);
  return target;
}

export async function commit(h: WorktreeHandle, message: string, amend: boolean): Promise<CommitInfo> {
  if ((await currentOperation(h)) === "rebase") throw new KiboError("GIT_BUSY", "rebase in progress");
  if (amend) await assertUnpushed(h, await resolveCommit(h, "HEAD"));
  await h.git.ok(["commit", ...(amend ? ["--amend"] : []), ...MESSAGE_FLAGS], {
    stdin: message,
    timeoutMs: WRITE_TIMEOUT_MS,
  });
  return headCommit(h);
}

async function rewordHead(h: WorktreeHandle, message: string): Promise<void> {
  await h.git.ok(["commit", "--amend", "--only", ...MESSAGE_FLAGS], {
    stdin: message,
    timeoutMs: WRITE_TIMEOUT_MS,
  });
}

async function assertNoMergeAfter(h: WorktreeHandle, target: string): Promise<void> {
  if ((await h.git.ok(["rev-list", "--merges", `${target}..HEAD`])).trim())
    throw new KiboError("INVALID_INPUT", "cannot reword across a merge commit");
}

async function addAmendCommit(h: WorktreeHandle, target: string, message: string): Promise<void> {
  const subject = (await h.git.ok(["log", "-1", "--format=%s", target])).trim();
  await h.git.ok(["commit", "--allow-empty", "--only", "--no-verify", "--cleanup=verbatim", "-F", "-"], {
    stdin: `amend! ${subject}\n\n${message.trim()}\n`,
  });
}

async function rollbackReword(h: WorktreeHandle, index: string, cause: string): Promise<never> {
  const abort = await h.git.run(["rebase", "--abort"]);
  if (abort.code !== 0)
    throw new KiboError("GIT_FAILED", `git rebase: ${cause}; abort failed: ${firstLine(abort.stderr)}`);
  await h.git.ok(["reset", "--soft", "HEAD~1"]);
  await h.git.ok(["read-tree", index]);
  throw new KiboError("GIT_FAILED", `git rebase: ${cause}`);
}

async function rewordOlder(h: WorktreeHandle, target: string, message: string): Promise<void> {
  await assertNoMergeAfter(h, target);
  const index = (await h.git.ok(["write-tree"])).trim();
  await addAmendCommit(h, target, message);
  const parent = await parentOf(h, target);
  const r = await h.git.run(
    ["rebase", "-i", "--autosquash", "--autostash", ...(parent ? [parent] : ["--root"])],
    {
      env: { GIT_SEQUENCE_EDITOR: "true" },
      timeoutMs: WRITE_TIMEOUT_MS,
    },
  );
  if (r.code !== 0) await rollbackReword(h, index, firstLine(r.stderr) || firstLine(r.stdout));
  await h.git.ok(["read-tree", index]);
}

export async function reword(h: WorktreeHandle, sha: string, message: string): Promise<void> {
  const target = await editableCommit(h, sha);
  if (target === (await resolveCommit(h, "HEAD"))) return rewordHead(h, message);
  return rewordOlder(h, target, message);
}

export async function undoCommit(h: WorktreeHandle, sha: string): Promise<void> {
  const target = await editableCommit(h, sha);
  const parent = await parentOf(h, target);
  if (parent) {
    await h.git.ok(["reset", "--soft", parent]);
    return;
  }
  const branch = await currentBranch(h);
  if (!branch) throw new KiboError("INVALID_INPUT", "cannot undo the root commit on a detached HEAD");
  await h.git.ok(["update-ref", "-d", `refs/heads/${branch}`, target]);
}

export async function abortOperation(h: WorktreeHandle): Promise<void> {
  const op = await currentOperation(h);
  if (!op) throw new KiboError("INVALID_INPUT", "no git operation in progress");
  await h.git.ok([op, "--abort"], { timeoutMs: WRITE_TIMEOUT_MS });
}
