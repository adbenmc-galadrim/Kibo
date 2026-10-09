import type { FileChange, FileRef, ProjectSnapshot, Worktree } from "@kibo/schema";
import { useRef, useState } from "react";
import { client } from "../api";
import { fr } from "../i18n/fr";
import { errorMessage } from "../lib/error-message";
import { BranchFiles } from "./BranchFiles";
import { ChangesFiles } from "./ChangesFiles";
import { ChangesLayout } from "./ChangesLayout";
import { CommitColumn } from "./CommitColumn";
import type { ChangesSlotsHook } from "./changes-slots";
import { DiffColumn } from "./DiffColumn";
import type { DiffMode } from "./DiffView";
import { DiscardDialog } from "./DiscardDialog";
import { type FileSelection, pickSelected } from "./FileList";
import { ChangesAlerts } from "./OperationBanner";
import { linkedTicketKey } from "./PrCard";
import { PushPrDialog, type PushPrInput } from "./PushPrDialog";
import { trackedPr } from "./tracked-pr";
import { prBaseOf, useBranchView } from "./use-branch";
import { useCodeStatus, useCommitDefaults, useCompare, useFileDiff, useRemoteInfo } from "./use-code";
import { useCommitDraft } from "./use-commit-draft";
import { useFileActions } from "./use-file-actions";
import { useHistoryActions } from "./use-history-actions";
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
  const statusKey = status ? JSON.stringify([status.files, status.commits.map((c) => c.sha)]) : "";
  const branchView = useBranchView(projectId, current.path, statusKey, files.length > 0);
  const selected = branchView.selected ? null : pickSelected(files, selection);
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
  const branchBase = branchView.changes?.base ?? null;
  const baseBranch = base ?? prBaseOf(branchBase, remote.remote) ?? remote.remote?.defaultBase ?? null;
  const pr = trackedPr(remote.pr, project.tickets, branch);
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
  const history = useHistoryActions(w, reload, (c) => {
    draft.load(c);
    messageRef.current?.focus();
  });
  const createPr = async (input: PushPrInput) => {
    const created = await client.code({
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
    setNotice(fr.pr.created(created.number));
    remote.refresh();
    reload();
  };

  const unpushed = status?.commits.filter((c) => !c.pushed) ?? [];
  const shownFile = branchView.selected ? { ...branchView.selected, area: null } : selected;
  const staged = files.filter((f) => f.area === "staged");
  const prBlocked = !branch
    ? fr.commit.noBranch
    : remote.gh && !remote.gh.available
      ? fr.commit.ghUnavailable
      : null;
  const shownError =
    error ?? statusError ?? diffError ?? branchView.error ?? defaultsError ?? remote.error ?? compare.error;
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
        flash={fileActions.copy}
      />
      <ChangesLayout
        filesTitle={fr.changes.files(files.length)}
        files={
          <ChangesFiles
            worktrees={worktrees}
            current={current}
            ahead={status?.ahead ?? 0}
            files={status ? files : null}
            branch={<BranchFiles view={branchView} />}
            branchHasWork={Boolean(branchView.changes?.files.length)}
            selected={selected && { path: selected.path, area: selected.area }}
            busy={busy}
            readOnly={readOnly}
            onWorktreeChange={onWorktreeChange}
            onSelect={(f) => {
              branchView.clear();
              setSelection({ path: f.path, area: f.area });
            }}
            onToggle={toggle}
            {...fileActions.handlers}
          />
        }
        diff={
          <DiffColumn
            key={shownFile ? `${shownFile.area ?? "branch"}:${shownFile.path}` : ""}
            projectId={projectId}
            worktree={current.path}
            file={shownFile}
            diff={branchView.selected ? branchView.diff : diff}
            mode={mode}
            onModeChange={setMode}
            busy={busy}
            readOnly={readOnly}
            onHunk={hunk}
            onOpenFile={(line) => shownFile && onOpenFile({ ...w, path: shownFile.path, line, origin: null })}
            onOpenExternal={(line) =>
              shownFile &&
              void run(() => client.code({ method: "openInEditor", ...w, path: shownFile.path, line }))
            }
            onSaved={reload}
          />
        }
        commit={
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
            commits={{
              base: branchBase,
              commits: (branchBase ? branchView.changes?.commits : status?.commits) ?? [],
              busy,
              ...history,
            }}
            push={{
              target: status?.upstream ?? `${remoteName}/${branch ?? ""}`,
              remote: remoteName,
              branch,
              base: pr?.base ?? baseBranch,
              pending: unpushed,
              prTicketKey: linkedTicketKey(project.tickets, pr),
              canPush: branch !== null,
              upToDate,
              pushing,
              pushError,
              busy,
              pr,
              prBlocked,
              canOpenPr: baseBranch !== null,
              onPush: push,
              onOpenPr: () => setPrOpen(true),
            }}
          />
        }
      />
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
