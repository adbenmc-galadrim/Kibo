import {
  type AgentsState,
  type FileRef,
  INBOX_ID,
  isTerminal,
  type ProjectSnapshot,
  type ProjectSummary,
  type TabTarget,
  type WorkspaceConfig,
} from "@kibo/schema";
import { lazyPanel } from "@kibo/sdk";
import { client } from "../api";
import { fr } from "../i18n/fr";
import { errorMessage } from "../lib/error-message";
import { fileScope, newTicketProjects } from "../lib/inbox";
import { projectDomainsOf } from "../lib/project-domains";
import { canEdit } from "../state/access";
import type { DialogsState } from "./dialogs-state";
import {
  ConfirmDialog,
  DeleteProjectDialog,
  EditProjectDialog,
  FileTicketDialog,
  HelpDialogs,
  NewPageDialog,
  NewProjectDialog,
  NewTicketDialog,
  RenamePageDialog,
  TicketSheet,
} from "./lazy-dialogs";
import { FilePreviewSheet, JoinProjectDialog, ShareProjectDialog } from "./lazy-screens";
import { descendantIds } from "./page-menu";
import { useOpened } from "./use-opened";

export { type DialogsState, type NewTicketRequest, NO_DIALOG, type SheetTicket } from "./dialogs-state";

const SprintSheet = lazyPanel(() => import("./sprint/SprintSheet").then((m) => m.SprintSheet), fr.lazy, {
  fallback: "sr-only",
});

type Props = {
  state: DialogsState;
  set(patch: Partial<DialogsState>): void;
  viewer: string;
  projects: ProjectSummary[];
  project: ProjectSnapshot | null;
  ticketProject: ProjectSnapshot | null;
  sheetProject: ProjectSnapshot | null;
  snapshots: ReadonlyMap<string, ProjectSnapshot>;
  agents: AgentsState | null;
  config: WorkspaceConfig | null;
  onOpenTarget(target: TabTarget, newTab: boolean): void;
  onOpenFileTab(ref: FileRef, edit: boolean): void;
  onCloseProject(projectId: string): void;
};

export function ShellDialogs({
  state,
  set,
  viewer,
  projects,
  project,
  ticketProject,
  sheetProject,
  snapshots,
  agents,
  config,
  ...p
}: Props) {
  const { sheet, preview } = state;
  const openFile = (ref: FileRef) => set({ preview: ref });
  const newProjectOpened = useOpened(state.newProject);
  const helpOpened = useOpened(state.about || state.whatsNew || state.shortcutsHelp || state.report);
  const shareProject = state.share ? (snapshots.get(state.share) ?? null) : null;
  const editing = state.editProject ? (projects.find((x) => x.id === state.editProject) ?? null) : null;
  const doomedProject = state.deleteProject
    ? (projects.find((x) => x.id === state.deleteProject) ?? null)
    : null;
  const inbox = snapshots.get(INBOX_ID);
  const filing = inbox?.tickets.find((x) => x.id === state.fileTicket?.ticketId) ?? null;
  const doomed =
    project && state.deletePage ? descendantIds(project.pages, state.deletePage.id) : new Set<string>();
  return (
    <>
      {newProjectOpened && (
        <NewProjectDialog
          open={state.newProject}
          onOpenChange={(o) => set(o ? { newProject: true } : { newProject: false, newProjectFocus: "name" })}
          count={projects.length}
          existingKeys={projects.map((x) => x.key)}
          focusFolder={state.newProjectFocus === "folder"}
        />
      )}
      {project && state.newPageParent !== undefined && (
        <NewPageDialog
          projectId={project.meta.id}
          projectName={project.meta.name}
          parentId={state.newPageParent}
          open
          onOpenChange={(o) => !o && set({ newPageParent: undefined })}
        />
      )}
      {project && state.renamePage && (
        <RenamePageDialog
          projectId={project.meta.id}
          page={state.renamePage}
          onClose={() => set({ renamePage: null })}
        />
      )}
      {project && state.deletePage && (
        <ConfirmDialog
          open
          onOpenChange={(o) => !o && set({ deletePage: null })}
          title={fr.nav.deletePageTitle(state.deletePage.title)}
          description={fr.nav.deletePageHelp(
            doomed.size,
            project.instances.filter((i) => i.pageId === state.deletePage?.id || doomed.has(i.pageId)).length,
          )}
          confirmLabel={fr.common.delete}
          cancelLabel={fr.common.cancel}
          onConfirm={async () => {
            if (!state.deletePage) return;
            await client.rpc({
              method: "command",
              projectId: project.meta.id,
              command: { method: "deletePage", pageId: state.deletePage.id },
            });
          }}
          describeError={errorMessage}
        />
      )}
      {sheet && sheetProject && (
        <TicketSheet
          project={sheetProject}
          ticketId={sheet.ticketId}
          domains={projectDomainsOf(sheetProject, config) ?? []}
          viewer={sheetProject.viewer ?? viewer}
          onClose={() => set({ sheet: null })}
          onFile={() => set({ sheet: null, fileTicket: { ticketId: sheet.ticketId } })}
          onOpenInTab={() => {
            set({ sheet: null });
            p.onOpenTarget({ kind: "ticket", projectId: sheet.projectId, ticketId: sheet.ticketId }, true);
          }}
          onOpenFile={openFile}
          onOpenTicket={(ticketId) => set({ sheet: { projectId: sheet.projectId, ticketId } })}
          onDeleted={() => set({ sheet: null })}
        />
      )}
      {state.sprintSheet && (
        <SprintSheet
          route={state.sprintSheet}
          project={snapshots.get(state.sprintSheet.projectId) ?? project}
          onClose={() => set({ sprintSheet: null })}
          onOpenTicket={(ticketId) =>
            state.sprintSheet &&
            set({ sprintSheet: null, sheet: { projectId: state.sprintSheet.projectId, ticketId } })
          }
          onOpenInTab={(target) => {
            set({ sprintSheet: null });
            p.onOpenTarget(target, true);
          }}
        />
      )}
      {state.newTicket && (
        <NewTicketDialog
          projects={newTicketProjects(projects, snapshots)}
          snapshots={snapshots}
          initialProjectId={
            state.newTicket.projectId ??
            (ticketProject && canEdit(ticketProject) ? ticketProject.meta.id : INBOX_ID)
          }
          lockProject={state.newTicket.parentId != null || state.newTicket.instanceId != null}
          viewer={viewer}
          defaults={state.newTicket}
          onClose={() => set({ newTicket: null })}
        />
      )}
      {filing && inbox && (
        <FileTicketDialog
          ticket={filing}
          {...fileScope(inbox, filing.id)}
          projects={projects}
          snapshots={snapshots}
          onClose={() => set({ fileTicket: null })}
          onFiled={(projectId, ticketId) => set({ fileTicket: null, sheet: { projectId, ticketId } })}
        />
      )}
      {shareProject && (
        <ShareProjectDialog project={shareProject} open onOpenChange={(o) => !o && set({ share: null })} />
      )}
      {editing && (
        <EditProjectDialog
          project={editing}
          focus={state.editFocus ?? undefined}
          onClose={() => set({ editProject: null, editFocus: null })}
          config={config}
          go={(target) => p.onOpenTarget(target, false)}
        />
      )}
      {doomedProject && (
        <DeleteProjectDialog
          project={doomedProject}
          snapshot={snapshots.get(doomedProject.id) ?? null}
          activeRuns={
            agents
              ? agents.runs.filter((r) => r.projectId === doomedProject.id && !isTerminal(r.state)).length
              : 0
          }
          onClose={() => set({ deleteProject: null })}
          onDeleted={(projectId) => {
            set({ deleteProject: null });
            p.onCloseProject(projectId);
          }}
          onShare={() => set({ deleteProject: null, share: doomedProject.id })}
        />
      )}
      {state.join && <JoinProjectDialog open onOpenChange={(o) => !o && set({ join: false })} />}
      {preview && (
        <FilePreviewSheet
          fileRef={preview}
          onClose={() => set({ preview: null })}
          onOpenInTab={(edit) => p.onOpenFileTab(preview, edit)}
        />
      )}
      {helpOpened && <HelpDialogs state={state} set={set} />}
    </>
  );
}
