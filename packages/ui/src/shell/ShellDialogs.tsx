import type { AgentsState, FileRef, ProjectSnapshot, TabTarget, WorkspaceConfig } from "@kibo/schema";
import type { NewTicketDefaults } from "@kibo/sdk";
import { projectDomainsOf } from "../lib/project-domains";
import {
  AssignDialog,
  NewPageDialog,
  NewProjectDialog,
  NewTicketDialog,
  ProfileSheet,
  StarterDialog,
  TicketSheet,
} from "./lazy-dialogs";
import { FilePreviewSheet } from "./lazy-screens";
import { useOpened } from "./use-opened";

export type SheetTicket = { projectId: string; ticketId: string };

export type DialogsState = {
  newProject: boolean;
  newProjectFocus: "name" | "folder";
  newPageParent: string | null | undefined;
  suggestFor: string | null;
  sheet: SheetTicket | null;
  newTicket: NewTicketDefaults | null;
  assign: { projectId: string | null; ticketId: string | null } | null;
  newProfile: boolean;
  preview: FileRef | null;
};

export const NO_DIALOG: DialogsState = {
  newProject: false,
  newProjectFocus: "name",
  newPageParent: undefined,
  suggestFor: null,
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
  snapshots: ReadonlyMap<string, ProjectSnapshot>;
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
  snapshots,
  agents,
  config,
  ...p
}: Props) {
  const { sheet, preview } = state;
  const openFile = (ref: FileRef) => set({ preview: ref });
  const newProjectOpened = useOpened(state.newProject);
  return (
    <>
      {newProjectOpened && (
        <NewProjectDialog
          open={state.newProject}
          onOpenChange={(o) => set(o ? { newProject: true } : { newProject: false, newProjectFocus: "name" })}
          count={projectsCount}
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
          onSuggest={() => set({ newPageParent: undefined, suggestFor: project.meta.id })}
        />
      )}
      {state.suggestFor && (
        <StarterDialog
          projectId={state.suggestFor}
          open
          onOpenChange={(o) => !o && set({ suggestFor: null })}
        />
      )}
      {sheet && sheetProject && (
        <TicketSheet
          project={sheetProject}
          ticketId={sheet.ticketId}
          domains={projectDomainsOf(sheetProject, config) ?? []}
          onClose={() => set({ sheet: null })}
          onAssign={() =>
            set({ sheet: null, assign: { projectId: sheet.projectId, ticketId: sheet.ticketId } })
          }
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
          project={state.assign.projectId ? (snapshots.get(state.assign.projectId) ?? null) : project}
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
