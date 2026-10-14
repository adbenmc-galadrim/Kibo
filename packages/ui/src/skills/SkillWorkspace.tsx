import type { ProjectSummary, Skill, SkillReview } from "@kibo/schema";
import { cn } from "@kibo/sdk/lib/utils";
import { Alert, AlertDescription, AlertTitle } from "@kibo/sdk/ui/alert";
import { Button } from "@kibo/sdk/ui/button";
import { ConfirmDialog } from "@kibo/sdk/ui/confirm-dialog";
import { ScrollPane } from "@kibo/sdk/ui/scroll-pane";
import { Lock } from "lucide-react";
import { useState } from "react";
import { client } from "../api";
import { ConflictDialog } from "../file-editor/ConflictDialog";
import { MarkdownPane, type PaneMode } from "../file-editor/MarkdownPane";
import { VersionHistory } from "../file-editor/VersionHistory";
import { fr } from "../i18n/fr";
import { frSkills } from "../i18n/fr-skills";
import { errorMessage } from "../lib/error-message";
import { EditorNotices } from "./EditorNotices";
import { IntegrateDiff } from "./IntegrateDiff";
import { ReviewNotes } from "./ReviewNotes";
import { SkillAssets } from "./SkillAssets";
import type { ReviewFocus } from "./SkillEditor";
import { SkillFieldsCard } from "./SkillFieldsCard";
import { type SkillDialog, SkillHeader } from "./SkillHeader";
import { skillAddress, skillHistoryRef } from "./skill-sections";
import { useIntegration } from "./use-integration";
import { useSkillEditor } from "./use-skill-editor";

type Props = {
  skill: Skill;
  file: string;
  projects: ProjectSummary[];
  reviews: SkillReview[];
  notesOpen: boolean;
  focus: ReviewFocus | null;
  notice: string | null;
  onBack(): void;
  onFile(file: string): void;
  onNotes(): void;
  onFocus(focus: ReviewFocus | null): void;
  onIntegrate(review: SkillReview): void;
  onOpenReview(review: SkillReview): void;
  onIgnore(review: SkillReview): void;
  onCopy(review: SkillReview | null): void;
  onReviewed(reviewId: string | null): void;
};

const t = frSkills.editor;

export function SkillWorkspace(p: Props) {
  const { skill, file, focus } = p;
  const pinned = focus?.mode === "pinned" ? focus.review : null;
  const sk = useSkillEditor(skill, file, p.onReviewed);
  const { editor } = sk;
  const integration = useIntegration(skill, editor, p.onReviewed);
  const [mode, setMode] = useState<PaneMode>("edit");
  const [dialog, setDialog] = useState<SkillDialog | null>(null);
  const [restoreFailed, setRestoreFailed] = useState(false);
  const integrating = focus?.mode === "integrate" && !skill.readOnly && editor.ready ? focus.review : null;
  const open = p.reviews.filter((r) => r.status === "new").length;
  const canSave =
    !skill.readOnly && !editor.saving && editor.ready && (sk.dirty || editor.missing || pinned !== null);
  const save = () => {
    sk.setReview(pinned?.id ?? null);
    void editor.save();
  };
  const restore = async (id: string) => {
    const result = await client.rpc({ method: "fileVersions.restore", id, baseHash: editor.baseHash });
    setRestoreFailed(!result.ok);
    if (result.ok) await editor.reload();
    return result.ok;
  };
  const side = p.notesOpen || integrating !== null;
  return (
    <div className="grid content-start gap-5 p-6 lg:flex lg:h-full lg:min-h-0 lg:flex-col">
      <SkillHeader
        skill={skill}
        projects={p.projects}
        dirty={sk.dirty}
        canSave={canSave}
        openReviews={open}
        notesOpen={p.notesOpen}
        onBack={p.onBack}
        onSave={save}
        onNotes={p.onNotes}
        onDialog={(d) => (d === "copy" ? p.onCopy(null) : setDialog(d))}
      />
      {skill.readOnly && (
        <Alert>
          <Lock aria-hidden />
          <AlertTitle>{t.pluginNotice}</AlertTitle>
          {open > 0 && <AlertDescription>{t.pluginNotes(open)}</AlertDescription>}
        </Alert>
      )}
      <EditorNotices
        editor={editor}
        error={p.notice ?? (restoreFailed ? t.restoreConflict : editor.error !== null ? t.saveFailed : null)}
      />
      <div
        className={cn(
          "grid items-start gap-4 lg:min-h-0 lg:flex-1 lg:grid-cols-[15rem_minmax(0,1fr)] lg:items-stretch",
          side && "xl:grid-cols-[15rem_minmax(0,1fr)_20rem]",
        )}
      >
        <SkillAssets skill={skill} current={file} onPick={p.onFile} />
        <ScrollPane className="grid min-w-0 content-start gap-4">
          {integrating ? (
            <IntegrateDiff
              review={integrating}
              current={sk.text()}
              changed={integrating.baseHash !== null && integrating.baseHash !== editor.baseHash}
              saving={integration.saving}
              error={integration.error}
              onSave={(content) => void integration.save(content, integrating.id)}
              onCancel={() => p.onFocus(null)}
            />
          ) : (
            <>
              {pinned && (
                <Alert className="border-brand/50">
                  <AlertTitle className="flex items-center gap-2">
                    {t.pinned}
                    <span className="flex-1" />
                    <Button size="sm" variant="ghost" onClick={() => p.onFocus(null)}>
                      {t.unpin}
                    </Button>
                  </AlertTitle>
                  <AlertDescription className="grid gap-1">
                    <span className="whitespace-pre-line text-foreground">{pinned.note}</span>
                    <span>{t.pinnedHelp}</span>
                  </AlertDescription>
                </Alert>
              )}
              {sk.main && (
                <SkillFieldsCard
                  fields={sk.fields}
                  extra={skill.file?.frontmatter.extra ?? ""}
                  readOnly={skill.readOnly}
                  onChange={sk.setFields}
                />
              )}
              <MarkdownPane
                value={editor.content}
                onChange={editor.setContent}
                mode={mode}
                onMode={setMode}
                readOnly={skill.readOnly}
                label={sk.main ? t.body : t.assetBody(file)}
                title={
                  <p className="flex items-baseline gap-2">
                    <span className="text-sm font-semibold">{sk.main ? t.body : file}</span>
                    <span className="text-xs text-muted-foreground">
                      {sk.main ? t.bodyHelp : t.assetBody(file)}
                    </span>
                  </p>
                }
                docKey={editor.revision}
                path={file}
                onSave={save}
              />
            </>
          )}
        </ScrollPane>
        {side && (
          <ScrollPane>
            <ReviewNotes
              skill={skill}
              reviews={integrating ? [integrating] : p.reviews}
              onIntegrate={p.onIntegrate}
              onOpen={p.onOpenReview}
              onIgnore={p.onIgnore}
              onCopy={p.onCopy}
              onClose={integrating ? undefined : p.onNotes}
            />
          </ScrollPane>
        )}
      </div>
      {editor.conflict && (
        <ConflictDialog
          path={`${skill.path}/${file}`}
          mine={sk.text()}
          disk={editor.conflict.content}
          modifiedAt={editor.conflict.modifiedAt}
          onReload={() => void editor.reload()}
          onOverwrite={() => void editor.overwrite()}
          onCancel={editor.dismissConflict}
        />
      )}
      {!skill.readOnly && (
        <VersionHistory
          open={dialog === "history"}
          onClose={() => setDialog(null)}
          title={`${skill.id} · ${file}`}
          kind="skills"
          versionRef={skillHistoryRef(skill)}
          file={file}
          currentContent={sk.text()}
          currentHash={editor.baseHash}
          onRestore={restore}
        />
      )}
      <ConfirmDialog
        open={dialog === "delete"}
        onOpenChange={(o) => !o && setDialog(null)}
        title={t.deleteTitle(skill.id)}
        description={t.deleteHelp}
        confirmLabel={fr.common.delete}
        cancelLabel={fr.common.cancel}
        onConfirm={async () => {
          await client.rpc({ method: "skills.delete", ...skillAddress(skill) });
          p.onBack();
        }}
        describeError={errorMessage}
      />
    </div>
  );
}
