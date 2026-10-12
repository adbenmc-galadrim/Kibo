import {
  type AgentRef,
  KiboError,
  type ProjectSummary,
  parseAgentRef,
  SYSTEM_MAX_PARALLEL,
} from "@kibo/schema";
import { Alert, AlertDescription } from "@kibo/sdk/ui/alert";
import { Button } from "@kibo/sdk/ui/button";
import { ConfirmDialog } from "@kibo/sdk/ui/confirm-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@kibo/sdk/ui/dialog";
import { Info } from "lucide-react";
import { useState } from "react";
import { client } from "../../api";
import { ConflictDialog } from "../../file-editor/ConflictDialog";
import { MarkdownPane, type PaneMode } from "../../file-editor/MarkdownPane";
import { VersionHistory } from "../../file-editor/VersionHistory";
import { fr } from "../../i18n/fr";
import { frAgentsSkills } from "../../i18n/fr-agents-skills";
import { errorMessage } from "../../lib/error-message";
import { useAgentList } from "../catalog/use-agent-list";
import { AgentHeader, type SheetDialog } from "./AgentHeader";
import { agentFileText } from "./agent-file-text";
import { PreviewPane } from "./PreviewPane";
import { RenameAgentDialog } from "./RenameAgentDialog";
import { SkillsField } from "./SkillsField";
import { SpecFields } from "./SpecFields";
import { SubagentsField } from "./SubagentsField";
import { TechnicalSettings } from "./TechnicalSettings";
import { useAgentSheet } from "./use-agent-sheet";

type Props = {
  agentRef: AgentRef;
  projects: ProjectSummary[];
  hostSlots: number;
  startRename: boolean;
  onClose(): void;
  onRenamed(ref: AgentRef): void;
};

const t = frAgentsSkills.sheet;

function parallelMax(ref: AgentRef): number {
  const parsed = parseAgentRef(ref);
  if (parsed.scope !== "system") return 16;
  return parsed.id === "demo" ? 1 : SYSTEM_MAX_PARALLEL;
}

function FileDialog({ path, text, onClose }: { path: string; text: string; onClose(): void }) {
  const [mode, setMode] = useState<PaneMode>("edit");
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-[860px]">
        <DialogHeader>
          <DialogTitle className="font-mono text-sm">{path}</DialogTitle>
        </DialogHeader>
        <MarkdownPane
          value={text}
          onChange={() => {}}
          mode={mode}
          onMode={setMode}
          label={t.fileTitle}
          readOnly
        />
      </DialogContent>
    </Dialog>
  );
}

const describeDelete = (e: unknown) =>
  e instanceof KiboError && e.code === "AGENT_IN_USE" ? t.inUse : errorMessage(e);

export function AgentSheet({ agentRef, projects, hostSlots, startRename, onClose, onRenamed }: Props) {
  const sheet = useAgentSheet(agentRef);
  const { agent, editor } = sheet;
  const [dialog, setDialog] = useState<SheetDialog | null>(startRename ? "rename" : null);
  const [notice, setNotice] = useState<string | null>(null);
  const others = useAgentList(agent?.scope === "project" ? agent.projectId : null);
  if (sheet.failed) return <p className="p-6 text-sm text-destructive">{t.failed}</p>;
  if (!agent) return <p className="p-6 text-sm text-muted-foreground">{t.loading}</p>;
  const system = agent.scope === "system";
  const file = agent.file;
  const draftFile = sheet.draftFile();
  const canSave =
    file !== null &&
    !editor.saving &&
    sheet.draft.description.trim() !== "" &&
    (sheet.dirty || editor.missing);
  const restore = async (id: string) => {
    const result = await client.rpc({ method: "fileVersions.restore", id, baseHash: editor.baseHash });
    if (!result.ok) {
      setNotice(t.restoreConflict);
      return false;
    }
    await editor.reload();
    return true;
  };
  return (
    <div className="grid content-start gap-5 p-6">
      <AgentHeader
        agent={agent}
        projects={projects}
        dirty={sheet.dirty}
        canSave={canSave}
        onBack={onClose}
        onSave={() => void editor.save()}
        onDialog={setDialog}
      />
      {agent.activeRuns > 0 && (
        <Alert className="border-blue-500/50 text-blue-700 dark:text-blue-300">
          <Info aria-hidden />
          <AlertDescription className="text-inherit">{t.activeRuns(agent.activeRuns)}</AlertDescription>
        </Alert>
      )}
      {agent.problem !== null && (
        <Alert variant="destructive">
          <AlertDescription>{t.unreadable(agent.problem)}</AlertDescription>
        </Alert>
      )}
      {editor.changedOnDisk && (
        <Alert>
          <AlertDescription className="flex items-center gap-3">
            {t.changedOnDisk}
            <Button size="sm" variant="outline" onClick={() => void editor.reload()}>
              {t.reload}
            </Button>
          </AlertDescription>
        </Alert>
      )}
      {editor.missing && (
        <Alert variant="destructive">
          <AlertDescription className="flex items-center gap-3">
            {t.missing}
            <Button size="sm" variant="outline" onClick={() => void editor.recreate()}>
              {t.recreate}
            </Button>
          </AlertDescription>
        </Alert>
      )}
      {(editor.error !== null || notice !== null) && (
        <p role="alert" className="text-sm text-destructive">
          {notice ?? t.saveFailed}
        </p>
      )}
      <SpecFields
        name={agent.name}
        draft={sheet.draft}
        onDraft={sheet.setDraft}
        body={editor.content}
        bodyKey={editor.revision}
        onBody={editor.setContent}
        onSave={() => void editor.save()}
        readOnly={file === null}
      />
      <TechnicalSettings
        settings={agent.settings}
        extra={file?.frontmatter.extra ?? ""}
        system={system}
        parallelMax={parallelMax(agent.ref)}
        hostSlots={hostSlots}
        failed={sheet.settingsFailed}
        onPatch={(p) => void sheet.patch(p)}
      />
      <div className="grid items-start gap-4 lg:grid-cols-2">
        <SubagentsField
          agent={agent}
          agents={others.agents ?? []}
          projects={projects}
          disabled={system}
          onPatch={(p) => void sheet.patch(p)}
        />
        <SkillsField
          rule={agent.settings.skills}
          preloaded={file?.frontmatter.skills ?? []}
          projectId={agent.projectId}
          projects={projects}
          disabled={system}
          onPatch={(p) => void sheet.patch(p)}
        />
      </div>
      {editor.conflict && draftFile && (
        <ConflictDialog
          path={agent.path}
          mine={agentFileText(draftFile)}
          disk={editor.conflict.content}
          modifiedAt={editor.conflict.modifiedAt}
          onReload={() => void editor.reload()}
          onOverwrite={() => void editor.overwrite()}
          onCancel={editor.dismissConflict}
        />
      )}
      {dialog === "file" && file && (
        <FileDialog path={agent.path} text={agentFileText(file)} onClose={() => setDialog(null)} />
      )}
      <PreviewPane
        open={dialog === "preview"}
        onClose={() => setDialog(null)}
        agentRef={agent.ref}
        name={agent.name}
        projectId={agent.projectId ?? projects.find((p) => p.folder !== null)?.id ?? null}
      />
      <VersionHistory
        open={dialog === "history"}
        onClose={() => setDialog(null)}
        title={agent.name}
        kind="agents"
        versionRef={agent.ref}
        currentContent={file ? agentFileText(file) : ""}
        currentHash={agent.hash}
        onRestore={restore}
      />
      {dialog === "rename" && (
        <RenameAgentDialog
          agent={agent}
          onClose={() => setDialog(null)}
          onRenamed={(next) => onRenamed(next.ref)}
        />
      )}
      <ConfirmDialog
        open={dialog === "delete"}
        onOpenChange={(o) => !o && setDialog(null)}
        title={t.deleteTitle(agent.name)}
        description={t.deleteHelp}
        confirmLabel={fr.common.delete}
        cancelLabel={fr.common.cancel}
        onConfirm={async () => {
          await client.rpc({ method: "agents.delete", ref: agent.ref });
          onClose();
        }}
        describeError={describeDelete}
      />
    </div>
  );
}
