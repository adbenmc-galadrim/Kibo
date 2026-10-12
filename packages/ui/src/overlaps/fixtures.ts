import type {
  AgentsState,
  AutoLink,
  MomentData,
  Overlap,
  OverlapRpcResult,
  ParallelRun,
  ParallelWork,
  RunMoment,
  RunView,
} from "@kibo/schema";
import { agentsFixture, NOW, runFixture } from "../agents/fixtures";

const MIN = 60_000;

export const OWNER_RUN = "r-bou-12";
export const OTHER_RUN = "r-bou-15";
export const OWNER_NAME = "bou · livraison · BOU-12";
export const OTHER_NAME = "bou · livraison · BOU-15";
export const FIRST_SEEN = NOW - 10 * MIN;
export const RESOLVED_AT = NOW - 6 * MIN;
export const CANCELLED_AT = NOW + 5 * MIN;

export const ownerRun = (p: Partial<RunView> = {}): RunView =>
  runFixture({
    id: OWNER_RUN,
    projectId: "bou",
    ticketId: "t-bou-12",
    ticketKey: "BOU-12",
    ticketTitle: "Format des dates de livraison",
    projectKey: "BOU",
    profileName: "livraison",
    agentName: "livraison",
    label: OWNER_NAME,
    state: "running",
    startedAt: NOW - 22 * MIN,
    workspace: "worktree:bou-12",
    ...p,
  });

export const otherRun = (p: Partial<RunView> = {}): RunView =>
  runFixture({
    id: OTHER_RUN,
    projectId: "bou",
    ticketId: "t-bou-15",
    ticketKey: "BOU-15",
    ticketTitle: "Page de suivi de commande",
    projectKey: "BOU",
    profileName: "livraison",
    agentName: "livraison",
    label: OTHER_NAME,
    state: "running",
    startedAt: NOW - 10 * MIN,
    workspace: "worktree:bou-15",
    ...p,
  });

export function overlapFixture(p: Partial<Overlap> = {}): Overlap {
  return {
    id: "o1",
    projectId: "bou",
    kind: "export",
    key: "formatDate",
    ownerRunId: OWNER_RUN,
    otherRunId: OTHER_RUN,
    ownerWorkspace: "/repo/.kibo/worktrees/bou-12",
    otherWorkspace: "/repo/.kibo/worktrees/bou-15",
    detail: {
      kind: "export",
      name: "formatDate",
      ownerPath: "src/lib/format.ts",
      otherPath: "src/utils/date.ts",
    },
    firstSeenAt: FIRST_SEEN,
    lastSeenAt: FIRST_SEEN,
    status: "open",
    deliveredAt: FIRST_SEEN + MIN,
    ownerDeliveredAt: FIRST_SEEN + MIN,
    resolvedAt: null,
    ignoredBy: null,
    ignoredAt: null,
    ...p,
  };
}

export const OPEN_OVERLAP = overlapFixture();

export function autoLinkFixture(p: Partial<AutoLink> = {}): AutoLink {
  return {
    id: "a1",
    projectId: "bou",
    linkId: "l1",
    fromTicketId: "t-bou-12",
    toTicketId: "t-bou-15",
    fromTicketKey: "BOU-12",
    toTicketKey: "BOU-15",
    ownerRunId: OWNER_RUN,
    otherRunId: OTHER_RUN,
    reason: "copy",
    detail: { path: "src/lib/format-date.ts", name: "formatDate" },
    at: RESOLVED_AT,
    status: "added",
    cancelledBy: null,
    cancelledAt: null,
    ...p,
  };
}

export const overlapMoment = (
  p: Partial<Extract<MomentData, { kind: "overlap" }>> = {},
): Extract<MomentData, { kind: "overlap" }> => ({
  kind: "overlap",
  overlapId: "o1",
  overlapKind: "export",
  role: "other",
  withRunId: OWNER_RUN,
  withRunName: OWNER_NAME,
  summary: `Recouvrement avec ${OWNER_NAME} : \`formatDate\` exporté deux fois (\`src/utils/date.ts\`, chez lui \`src/lib/format.ts\`)`,
  ...p,
});

export const autoLinkMoment = (
  p: Partial<Extract<MomentData, { kind: "auto_link" }>> = {},
): Extract<MomentData, { kind: "auto_link" }> => ({
  kind: "auto_link",
  autoLinkId: "a1",
  fromTicketKey: "BOU-12",
  toTicketKey: "BOU-15",
  reason: "copy",
  path: "src/lib/format-date.ts",
  name: "formatDate",
  failure: null,
  ...p,
});

export const momentOf = (seq: number, at: number, data: MomentData, runId = OTHER_RUN): RunMoment => ({
  id: seq,
  runId,
  seq,
  at,
  stepId: null,
  data,
});

export function parallelRunFixture(p: Partial<ParallelRun> = {}): ParallelRun {
  return {
    runId: OWNER_RUN,
    name: OWNER_NAME,
    ticketKey: "BOU-12",
    ticketTitle: "Format des dates de livraison",
    startedAt: NOW - 22 * MIN,
    step: "Brancher le format sur le récapitulatif",
    plan: null,
    files: [
      { path: "src/lib/format-date.ts", status: "added", added: 24, removed: 0 },
      { path: "src/lib/format.ts", status: "modified", added: 3, removed: 1 },
      { path: "src/i18n/fr.ts", status: "modified", added: 6, removed: 2 },
    ],
    exports: [
      { name: "formatDate", path: "src/lib/format-date.ts" },
      { name: "formatDeliveryWindow", path: "src/lib/format-date.ts" },
    ],
    workspace: "worktree",
    worktreeName: "bou-12",
    truncated: false,
    ...p,
  };
}

export const parallelFixture = (p: Partial<ParallelWork> = {}): ParallelWork => ({
  runs: [parallelRunFixture()],
  more: 0,
  overlaps: [OPEN_OVERLAP],
  partial: false,
  ...p,
});

export const readFixture = (): OverlapRpcResult["overlaps.read"] => ({
  owner: {
    runId: OWNER_RUN,
    runName: OWNER_NAME,
    path: "src/lib/format.ts",
    content: "export const formatDate = (d: Date) => d.toISOString();\n",
    reason: null,
  },
  other: {
    runId: OTHER_RUN,
    runName: OTHER_NAME,
    path: "src/utils/date.ts",
    content: "export function formatDate(d: Date) {\n  return d.toISOString();\n}\n",
    reason: null,
  },
});

export function overlapAgents(open = 1): AgentsState {
  const base = agentsFixture();
  return {
    ...base,
    runs: [ownerRun(), otherRun()],
    queue: [],
    progress: [],
    host: { ...base.host, used: 2, hostSlots: 3 },
    overlaps: [
      { runId: OWNER_RUN, open },
      { runId: OTHER_RUN, open },
    ],
    overlapTotal: open,
  };
}
