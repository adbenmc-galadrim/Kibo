import {
  type CiRun,
  DEFAULT_RECIPIENTS,
  DEFAULT_WORKFLOW,
  EMPTY_PROGRESS,
  type ProjectEvent,
  type ProjectSnapshot,
  type TicketView,
} from "@kibo/schema";
import type { PhoneFixture } from "../../app-test-kit";
import { putBlob } from "../../fake-server-api";
import { sealJson } from "../../test-kit";

export const siloTicket = (
  id: string,
  keyLabel: string,
  title: string,
  patch: Partial<TicketView> = {},
): TicketView => ({
  id,
  key: keyLabel,
  hold: null,
  keyLabel,
  title,
  description: "",
  statusId: "todo",
  parentId: null,
  assignee: null,
  domainId: null,
  blockedReason: null,
  labels: [],
  externalRefs: [],
  progress: { done: 0, total: 0 },
  waitingOn: [],
  openQuestions: 0,
  startable: false,
  startReason: null,
  onHold: null,
  agentProgress: EMPTY_PROGRESS,
  delivery: null,
  sprintId: null,
  optional: false,
  shortKey: null,
  effectiveSprintId: null,
  session: null,
  thread: null,
  updatedAt: null,
  feature: null,
  ...patch,
});

export const HOLD_REASON = "Règle de fusion à valider par le client";
export const THREAD_LINK = "t3-thread://thread/silo-45";

const SILO_45 = siloTicket("t45", "SILO-45", "Conflits de saisie", {
  parentId: "f4",
  statusId: "in_review",
  assignee: { kind: "human", ref: "adam" },
  sprintId: "s42",
  effectiveSprintId: "s42",
  domainId: "d-saisie",
  labels: ["hors-ligne"],
  description: "Deux saisies hors ligne du même constat : garder la plus récente. Voir src/sync/merge.ts",
  hold: { reason: HOLD_REASON, since: "2026-10-16" },
  onHold: { source: "own", key: "SILO-45", reason: HOLD_REASON, since: "2026-10-16" },
  externalRefs: [
    { kind: "git_branch", branch: "feat/silo-45", base: "dev" },
    {
      kind: "github_pr",
      url: "https://github.com/silo-labs/silo-location/pull/20",
      number: 20,
      state: "open",
      base: "dev",
      head: "feat/silo-45",
      review: "changes_requested",
      checks: "error",
    },
    {
      kind: "figma_node",
      fileKey: "SiloMaquettes",
      nodeId: "1:2",
      url: "https://www.figma.com/design/SiloMaquettes/maquettes?node-id=1-2",
      name: "Saisie",
    },
  ],
  thread: {
    threadId: "th-45",
    link: THREAD_LINK,
    title: "SILO-45",
    status: "waiting",
    startedAt: 1_760_610_000_000,
    checkedAt: 1_760_619_000_000,
  },
});

const SILO_46 = siloTicket("t46", "SILO-46", "Démo client", { parentId: "f4", optional: true });

export const SILO_TICKET_PROJECT: ProjectSnapshot = {
  meta: {
    id: "silo",
    key: "SILO",
    name: "Silo",
    color: "#14B8A6",
    folder: "/Users/adam/silo",
    worktree: null,
    storybook: null,
    delivery: null,
    tracking: null,
    description: null,
    client: "Silo SA",
  },
  workflow: DEFAULT_WORKFLOW,
  pages: [],
  tickets: [
    siloTicket("f4", "SILO-40", "Saisie hors ligne", {
      shortKey: "F4",
      progress: { done: 0, total: 2 },
      sprintId: "s42",
    }),
    SILO_45,
    SILO_46,
  ],
  links: [{ id: "l1", from: "t45", to: "t46", type: "blocks" }],
  questions: [
    {
      kind: "question",
      images: [],
      id: "q20",
      ticketId: "t45",
      runId: null,
      title: "La règle de fusion vaut-elle pour les photos ?",
      context: "",
      options: [],
      provisional: null,
      blocking: false,
      createdBy: { kind: "human", ref: "adam" },
      createdAt: 1_760_000_000_000,
      number: 20,
      importRef: null,
      answer: null,
      recipient: "client",
      sentAt: null,
      history: [],
      archivedAt: null,
      archivedBy: null,
    },
  ],
  questionRecipients: [...DEFAULT_RECIPIENTS],
  instances: [],
  rules: [],
  bindings: [],
  sprints: [
    {
      id: "s42",
      code: "S42",
      name: "Saisie hors ligne",
      start: "2026-10-12",
      end: "2026-10-16",
      state: "current",
      features: ["f4"],
      delivered: 0,
      total: 1,
      lingering: false,
    },
  ],
  domains: [{ id: "d-saisie", name: "Saisie terrain", owner: { scope: "workspace" }, color: "#0EA5E9" }],
  nextTicketKey: "SILO-47",
};

const HELD_EVENT: ProjectEvent = {
  id: 7,
  projectId: "silo",
  kind: "held",
  ticketId: "t45",
  featureId: "f4",
  source: "user",
  data: { reason: HOLD_REASON },
  at: 1_760_618_000_000,
};

const FAILED_CI: CiRun = {
  repo: "silo-labs/silo-location",
  runId: 9,
  prNumber: 20,
  ticketKey: "SILO-45",
  headSha: "abc",
  workflow: "CI",
  status: "completed",
  conclusion: "failure",
  url: "https://github.com/silo-labs/silo-location/actions/runs/9",
  startedAt: "2026-10-16T11:50:00Z",
  updatedAt: "2026-10-16T12:00:00Z",
  jobs: [
    {
      jobId: 31,
      name: "e2e",
      status: "completed",
      conclusion: "failure",
      startedAt: "2026-10-16T11:50:00Z",
      completedAt: "2026-10-16T12:00:00Z",
    },
  ],
};

export async function sealTicket({ api, keys }: Pick<PhoneFixture, "api" | "keys">): Promise<void> {
  const seal = (kind: string, value: unknown) => sealJson(keys, "silo", kind, value, { seq: 2 });
  putBlob(api, await seal("project", SILO_TICKET_PROJECT));
  putBlob(api, await seal("events", [HELD_EVENT]));
  putBlob(api, await seal("ci", [FAILED_CI]));
  putBlob(api, await seal("t3", { available: true, bin: "t3" }));
}
