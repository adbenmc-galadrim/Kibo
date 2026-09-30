import type { CommitInfo, FileChange, FileRef, ProjectSnapshot, Worktree } from "@kibo/schema";
import { useRef, useState } from "react";
import { client } from "../api";
import { fr } from "../i18n/fr";
import { errorMessage } from "../lib/error-message";
import { ChangesFiles } from "./ChangesFiles";
import { CommitColumn } from "./CommitColumn";
import type { ChangesSlotsHook } from "./changes-slots";
import { DiffColumn } from "./DiffColumn";
import type { DiffMode } from "./DiffView";
import { DiscardDialog } from "./DiscardDialog";
import { type FileSelection, pickSelected } from "./FileList";
import { ChangesAlerts } from "./OperationBanner";
import { linkedTicketKey } from "./PrCard";
import { PushPrDialog, type PushPrInput } from "./PushPrDialog";
import { useCodeStatus, useCommitDefaults, useCompare, useFileDiff, useRemoteInfo } from "./use-code";
import { useCommitDraft } from "./use-commit-draft";
import { useFileActions } from "./use-file-actions";
import { usePush } from "./use-push";

type Props = {
  project: ProjectSnapshot;
  worktrees: Worktree[];
  current: Worktree;
  onWorktreeChange(path: string): void;
  onOpenFile(ref: FileRef): void;
  onOpenInTab(ref: FileRef): void;
  useSlots: ChangesSlotsHook;
  readOnly: boolean;
};

export function ChangesBody(props: Props) {
  const { project, worktrees, current, onWorktreeChange, onOpenFile, onOpenInTab, useSlots, readOnly } =
    props;
  const projectId = project.meta.id;
  const w = { projectId, worktree: current.path };
  const { status, error: statusError, reload } = useCodeStatus(projectId, current.path);
  const [selection, setSelection] = useState<FileSelection | null>(null);
  const [mode, setMode] = useState<DiffMode>("unified");
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [prOpen, setPrOpen] = useState(false);
  const [base, setBase] = useState<string | null>(null);
  const messageRef = useRef<HTMLTextAreaElement>(null);
  const focusMessageOnClose = useRef(false);

  const files = status?.files ?? [];
  const selected = pickSelected(files, selection);
  const statusKey = status ? JSON.stringify([status.files, status.commits.map((c) => c.sha)]) : "";
  const {
    diff,
    error: diffError,
    reload: reloadDiff,
  } = useFileDiff(
    projectId,
    current.path,
    selected && { path: selected.path, area: selected.area },
    selected?.area === "staged" ? selected.origPath : null,
    statusKey,
  );
  const { defaults, error: defaultsError } = useCommitDefaults(
    projectId,
    current.path,
    status ? `${status.branch}:${status.commits[0]?.sha ?? ""}` : "",
  );
  const branch = status?.branch ?? null;
  const remote = useRemoteInfo(projectId, current.path, branch);
  const { pushing, pushError, push } = usePush(projectId, current.path, {
    onStart: () => setNotice(null),
    onPushed: remote.refresh,
    onSettled: reload,
  });
  const slots = useSlots(project, current.path, defaults?.ticketKey ?? null, worktrees);
  const baseBranch = base ?? remote.remote?.defaultBase ?? null;
  const head = status?.commits[0];
  const canAmend = head !== undefined && !head.pushed;
  const busy = working || pushing;
  const compare = useCompare(projectId, current.path, prOpen ? baseBranch : null);
  const draft = useCommitDraft(defaults, canAmend);

  const run = async (work: () => Promise<unknown>): Promise<boolean> => {
    setWorking(true);
    setError(null);
    setNotice(null);
    try {
      await work();
      return true;
    } catch (e) {
      setError(errorMessage(e));
      reloadDiff();
      return false;
    } finally {
      setWorking(false);
      reload();
    }
  };

  const fileActions = useFileActions({
    w,
    run,
    onOpenInTab,
    onDiscarded: () => {
      setSelection(null);
      reload();
    },
  });
  const toggle = (f: FileChange) => {
    const paths = f.origPath ? [f.path, f.origPath] : [f.path];
    void run(() => client.code({ method: f.area === "staged" ? "unstageFiles" : "stageFiles", ...w, paths }));
  };
  const hunk = (index: number, header: string) => {
    if (!selected) return;
    void run(() =>
      client.code({ method: "stageHunk", ...w, path: selected.path, area: selected.area, index, header }),
    );
  };
  const commit = () =>
    void run(() => client.code({ method: "commit", ...w, message: draft.message, amend: draft.amend })).then(
      (ok) => {
        if (ok) draft.clear();
      },
    );
  const modify = (c: CommitInfo) => {
    draft.load(c);
    messageRef.current?.focus();
  };
  const reword = async (c: CommitInfo, next: string) => {
    await client.code({ method: "reword", ...w, sha: c.sha, message: next });
    reload();
  };
  const undo = async (c: CommitInfo) => {
    await client.code({ method: "undoCommit", ...w, sha: c.sha });
    reload();
  };
  const createPr = async (input: PushPrInput) => {
    const pr = await client.code({
      method: "createPr",
      ...w,
      title: input.title,
      body: input.body,
      base: input.base,
      draft: input.draft,
      reviewers: input.reviewers,
      ticketId: input.link ? (defaults?.ticketId ?? null) : null,
    });
    setPrOpen(false);
    setNotice(fr.pr.created(pr.number));
    remote.refresh();
    reload();
  };

  const unpushed = status?.commits.filter((c) => !c.pushed) ?? [];
  const staged = files.filter((f) => f.area === "staged");
  const prBlocked = !branch
    ? fr.commit.noBranch
    : remote.gh && !remote.gh.available
      ? fr.commit.ghUnavailable
      : null;
  const shownError = error ?? statusError ?? diffError ?? defaultsError ?? remote.error ?? compare.error;
  const remoteName = remote.remote?.remote ?? "origin";
  const upToDate = status?.upstream && status.ahead === 0 ? status.upstream : null;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <ChangesAlerts
        operation={status?.operation ?? null}
        busy={busy}
        onAbort={readOnly ? null : () => void run(() => client.code({ method: "abortOperation", ...w }))}
        error={shownError}
        notice={notice}
      />
      {fileActions.copy.message && (
        <p
          role={fileActions.copy.tone === "error" ? "alert" : "status"}
          className="border-b px-4 py-2 text-sm"
        >
          {fileActions.copy.message}
        </p>
      )}
      <div className="grid min-h-0 flex-1 grid-cols-[272px_minmax(0,1fr)_340px] grid-rows-1">
        <ChangesFiles
          worktrees={worktrees}
          current={current}
          ahead={status?.ahead ?? 0}
          files={status ? files : null}
          selected={selected && { path: selected.path, area: selected.area }}
          busy={busy}
          readOnly={readOnly}
          onWorktreeChange={onWorktreeChange}
          onSelect={(f) => setSelection({ path: f.path, area: f.area })}
          onToggle={toggle}
          {...fileActions.handlers}
        />
        <div className="flex min-h-0 min-w-0 flex-col">
          <DiffColumn
            key={selected ? `${selected.area}:${selected.path}` : ""}
            projectId={projectId}
            worktree={current.path}
            file={selected}
            diff={diff}
            mode={mode}
            onModeChange={setMode}
            busy={busy}
            readOnly={readOnly}
            onHunk={hunk}
            onOpenFile={(line) => selected && onOpenFile({ ...w, path: selected.path, line, origin: null })}
            onOpenExternal={(line) =>
              selected &&
              void run(() => client.code({ method: "openInEditor", ...w, path: selected.path, line }))
            }
            onSaved={reload}
          />
        </div>
        <CommitColumn
          readOnly={readOnly}
          commit={{
            branch,
            loading: status === null,
            stagedCount: staged.length,
            message: draft.message,
            onMessageChange: draft.edit,
            prefilled: draft.prefilled,
            amend: draft.amend,
            onAmendChange: draft.setAmend,
            canAmend,
            busy,
            onCommit: commit,
            banner: slots.commitBanner,
            messageRef,
          }}
          unpushed={{
            commits: status?.commits ?? [],
            busy,
            onModify: modify,
            onReword: reword,
            onUndo: undo,
          }}
          push={{
            target: status?.upstream ?? `${remoteName}/${branch ?? ""}`,
            remote: remoteName,
            branch,
            base: baseBranch,
            pending: unpushed,
            prTicketKey: linkedTicketKey(project.tickets, remote.pr),
            canPush: branch !== null,
            upToDate,
            pushing,
            pushError,
            busy,
            pr: remote.pr,
            prBlocked,
            canOpenPr: baseBranch !== null,
            onPush: push,
            onOpenPr: () => setPrOpen(true),
          }}
        />
      </div>
      {!readOnly && branch && baseBranch && (
        <PushPrDialog
          open={prOpen}
          onOpenChange={setPrOpen}
          branch={branch}
          remote={remoteName}
          bases={remote.remote?.branches ?? []}
          base={baseBranch}
          onBaseChange={setBase}
          unpushedCount={unpushed.length}
          fileCount={compare.fileCount}
          stagedCount={staged.length}
          ticketKey={defaults?.ticketKey ?? null}
          defaultTitle={defaults?.prTitle ?? head?.subject ?? ""}
          defaultBody={defaults?.prBody ?? ""}
          onCommitFirst={() => {
            focusMessageOnClose.current = true;
            setPrOpen(false);
          }}
          onCloseAutoFocus={(e) => {
            if (!focusMessageOnClose.current) return;
            focusMessageOnClose.current = false;
            e.preventDefault();
            messageRef.current?.focus();
          }}
          onSubmit={createPr}
          extraOptions={slots.prOptions}
          ruleNote={slots.prRuleNote ?? null}
        />
      )}
      {fileActions.discarding && (
        <DiscardDialog
          file={fileActions.discarding}
          onClose={fileActions.closeDiscard}
          onConfirm={fileActions.discard}
        />
      )}
    </div>
  );
}
