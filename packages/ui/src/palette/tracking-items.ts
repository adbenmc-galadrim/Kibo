import {
  deliveryBrief,
  isInbox,
  type ProjectMeta,
  type ProjectSnapshot,
  type Spotlight,
  type TicketView,
} from "@kibo/schema";
import type { CopyTicket } from "@kibo/sdk";
import { frShell } from "../i18n/fr-shell";
import { normalize, type PaletteItem } from "./palette-items";

export type LocalAction =
  | { kind: "projectAgent" }
  | { kind: "copyDelivery"; ticket: CopyTicket }
  | { kind: "openView"; componentId: "planning" | "questions"; spotlight?: Spotlight }
  | { kind: "openSprint"; sprintId: string };

export const isTracked = (snapshot: Pick<ProjectSnapshot, "sprints"> | undefined): boolean =>
  snapshot !== undefined && snapshot.sprints.length > 0;

const localItem = (
  id: string,
  label: string,
  icon: PaletteItem["icon"],
  action: LocalAction,
): PaletteItem => ({
  id: `action:${id}`,
  group: "actions",
  label,
  keywords: normalize(label),
  detail: null,
  statusId: null,
  color: null,
  icon,
  run: { kind: "local", action },
  ticket: null,
});

const t = frShell.palette;

const newQuestion = (ticket: TicketView | undefined): LocalAction =>
  ticket
    ? { kind: "openView", componentId: "questions", spotlight: { kind: "newQuestion", ticketId: ticket.id } }
    : { kind: "openView", componentId: "questions" };

function creationItems(
  snapshot: ProjectSnapshot | undefined,
  ticket: TicketView | undefined,
  editable: boolean,
): PaletteItem[] {
  if (!editable || !isTracked(snapshot)) return [];
  return [
    localItem("newFeature", t.newFeature, "new", {
      kind: "openView",
      componentId: "planning",
      spotlight: { kind: "newFeature" },
    }),
    localItem("newSprint", t.newSprint, "new", { kind: "openView", componentId: "planning" }),
    localItem("newQuestion", t.newQuestion, "new", newQuestion(ticket)),
  ];
}

export function sprintItems(project: ProjectMeta, snapshot: ProjectSnapshot | undefined): PaletteItem[] {
  return (snapshot?.sprints ?? []).map((sprint) => ({
    ...localItem(`sprint:${sprint.id}`, t.sprint(sprint.code, sprint.name), "sprint", {
      kind: "openSprint",
      sprintId: sprint.id,
    }),
    id: `sprint:${project.id}:${sprint.id}`,
    group: "pages",
    keywords: normalize(`${sprint.code} ${sprint.name} ${project.name}`),
  }));
}

export function trackingItems(
  project: ProjectMeta | undefined,
  snapshot: ProjectSnapshot | undefined,
  ticket: TicketView | undefined,
  editable: boolean,
): PaletteItem[] {
  if (!project || isInbox(project.id)) return [];
  const out = [
    ...creationItems(snapshot, ticket, editable),
    localItem("projectAgent", t.projectAgent, "projectAgent", { kind: "projectAgent" }),
  ];
  if (ticket?.key) {
    const command = deliveryBrief(ticket.key);
    const copy: CopyTicket = {
      key: ticket.key,
      startable: ticket.startable,
      waitingOn: ticket.waitingOn,
      startReason: ticket.startReason,
    };
    out.push(
      localItem("copyDelivery", t.copy(command), "copy", {
        kind: "copyDelivery",
        ticket: copy,
      }),
    );
  }
  return out;
}
