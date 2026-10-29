import type { FileRef, Page, ProjectEditField } from "@kibo/schema";
import type { NewTicketDefaults } from "@kibo/sdk";

export type SheetTicket = { projectId: string; ticketId: string };
export type SheetSprint = { projectId: string; sprintId: string };
export type NewTicketRequest = NewTicketDefaults & { projectId?: string };

export type DialogsState = {
  newProject: boolean;
  newProjectFocus: "name" | "folder";
  newPageParent: string | null | undefined;
  sheet: SheetTicket | null;
  sprintSheet: SheetSprint | null;
  newTicket: NewTicketRequest | null;
  fileTicket: { ticketId: string } | null;
  preview: FileRef | null;
  share: string | null;
  join: boolean;
  renamePage: Page | null;
  deletePage: Page | null;
  editProject: string | null;
  editFocus: ProjectEditField | null;
  deleteProject: string | null;
  about: boolean;
  whatsNew: boolean;
  shortcutsHelp: boolean;
  report: boolean;
};

export const NO_DIALOG: DialogsState = {
  newProject: false,
  newProjectFocus: "name",
  newPageParent: undefined,
  sheet: null,
  sprintSheet: null,
  newTicket: null,
  fileTicket: null,
  preview: null,
  share: null,
  join: false,
  renamePage: null,
  deletePage: null,
  editProject: null,
  editFocus: null,
  deleteProject: null,
  about: false,
  whatsNew: false,
  shortcutsHelp: false,
  report: false,
};
