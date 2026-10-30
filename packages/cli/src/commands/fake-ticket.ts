import {
  EMPTY_PROGRESS,
  type ExternalRef,
  type Hold,
  NOT_STARTED_STATUSES,
  type OnHold,
  type StartReason,
  type StatusId,
  type TicketView,
} from "@kibo/schema";

type TicketInput = {
  id: string;
  key: string;
  title?: string;
  description?: string;
  labels?: string[];
  statusId?: StatusId;
  parentId?: string;
  sprintId?: string;
  effectiveSprintId?: string;
  shortKey?: string;
  optional?: boolean;
  children?: number;
  refs?: ExternalRef[];
  startable?: boolean;
  startReason?: StartReason | null;
  hold?: Hold | null;
  onHold?: OnHold | null;
};

export function fakeTicket(input: TicketInput): TicketView {
  return {
    id: input.id,
    key: input.key,
    hold: input.hold ?? null,
    title: input.title ?? `Titre ${input.key}`,
    description: input.description ?? "",
    statusId: input.statusId ?? "todo",
    blockedReason: null,
    domainId: null,
    assignee: null,
    parentId: input.parentId ?? null,
    externalRefs: input.refs ?? [],
    labels: input.labels ?? [],
    agentProgress: EMPTY_PROGRESS,
    delivery: null,
    sprintId: input.sprintId ?? null,
    optional: input.optional ?? false,
    shortKey: input.shortKey ?? null,
    effectiveSprintId: input.effectiveSprintId ?? input.sprintId ?? null,
    session: null,
    updatedAt: null,
    feature: null,
    progress: { done: 0, total: input.children ?? 0 },
    waitingOn: [],
    keyLabel: input.key,
    openQuestions: 0,
    startable:
      input.startable ?? (NOT_STARTED_STATUSES.includes(input.statusId ?? "todo") && !input.children),
    startReason: input.startReason ?? null,
    onHold: input.onHold ?? null,
  };
}
