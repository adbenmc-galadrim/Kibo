import type { AgentsState, FileRef, ProjectSnapshot, TabTarget, WorkspaceConfig } from "@kibo/schema";
import type { NewTicketDefaults } from "@kibo/sdk";
import { AssignDialog } from "../agents/AssignDialog";
import { ProfileSheet } from "../agents/ProfileSheet";
import { NewPageDialog } from "../dialogs/NewPageDialog";
import { NewProjectDialog } from "../dialogs/NewProjectDialog";
import { NewTicketDialog } from "../dialogs/NewTicketDialog";
import { FilePreviewSheet } from "./lazy-screens";
import { TicketSheet } from "./TicketSheet";

export type SheetTicket = { projectId: string; ticketId: string };

export type DialogsState = {
  newProject: boolean;
  newPageParent: string | null | undefined;
  sheet: SheetTicket | null;
  newTicket: NewTicketDefaults | null;
  assign: { ticketId: string | null } | null;
  newProfile: boolean;
  preview: FileRef | null;
};

export const NO_DIALOG: DialogsState = {
  newProject: false,
  newPageParent: undefined,
  sheet: null,
  newTicket: null,
  assign: null,
  newProfile: false,
  preview: null,
};

type Props = {
  state: DialogsState;
  set(patch: Partial<DialogsState>): void;
  viewer: string;
  projectsCount: number;
  project: ProjectSnapshot | null;
  ticketProject: ProjectSnapshot | null;
  sheetProject: ProjectSnapshot | null;
  agents: AgentsState | null;
  config: WorkspaceConfig | null;
  onOpenTarget(target: TabTarget, newTab: boolean): void;
  onOpenFileTab(ref: FileRef, edit: boolean): void;
};

export function ShellDialogs({
  state,
  set,
  viewer,
  projectsCount,
  project,
  ticketProject,
  sheetProject,
  agents,
  config,
  ...p
}: Props) {
  const { sheet, preview } = state;
  const openFile = (ref: FileRef) => set({ preview: ref });
  return (
    <>
      <NewProjectDialog
        open={state.newProject}
        onOpenChange={(o) => set({ newProject: o })}
        count={projectsCount}
      />
      {project && state.newPageParent !== undefined && (
        <NewPageDialog
          projectId={project.meta.id}
          projectName={project.meta.name}
          parentId={state.newPageParent}
          open
          onOpenChange={(o) => !o && set({ newPageParent: undefined })}
        />
      )}
      {sheet && sheetProject && (
        <TicketSheet
          project={sheetProject}
          ticketId={sheet.ticketId}
          domains={config?.domains ?? []}
          onClose={() => set({ sheet: null })}
          onAssign={() => set({ sheet: null, assign: { ticketId: sheet.ticketId } })}
          onOpenInTab={() => {
            set({ sheet: null });
            p.onOpenTarget({ kind: "ticket", projectId: sheet.projectId, ticketId: sheet.ticketId }, true);
          }}
          onOpenFile={openFile}
        />
      )}
      {ticketProject && state.newTicket && (
        <NewTicketDialog
          project={ticketProject}
          viewer={viewer}
          defaults={state.newTicket}
          onClose={() => set({ newTicket: null })}
        />
      )}
      {state.assign && (
        <AssignDialog
          project={project}
          ticketId={state.assign.ticketId}
          config={config}
          onClose={() => set({ assign: null })}
        />
      )}
      {state.newProfile && config && agents && (
        <ProfileSheet
          profile={null}
          config={config}
          hostSlots={agents.host.hostSlots}
          onClose={() => set({ newProfile: false })}
        />
      )}
      {preview && (
        <FilePreviewSheet
          fileRef={preview}
          onClose={() => set({ preview: null })}
          onOpenInTab={(edit) => p.onOpenFileTab(preview, edit)}
        />
      )}
    </>
  );
}
