import {
  DEFAULT_RECIPIENTS,
  EMPTY_PROGRESS,
  type ProjectSnapshot,
  type Question,
  type TicketView,
} from "@kibo/schema";
import type { PhoneFixture } from "../../app-test-kit";
import { putBlob } from "../../fake-server-api";
import { sealJson } from "../../test-kit";

export const Q14 = "Un box réaffecté garde-t-il ses photos ?";
export const Q16 = "Quota par client : 2 Go ou 5 Go ?";

const ADAM = { kind: "human", ref: "adam" } as const;

const silTicket = (id: string, keyLabel: string, title: string): TicketView => ({
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
});

const question = (id: string, ticketId: string, title: string, over: Partial<Question> = {}): Question => ({
  kind: "question",
  images: [],
  id,
  ticketId,
  runId: null,
  title,
  context: "",
  options: [],
  provisional: null,
  blocking: false,
  createdBy: ADAM,
  createdAt: 1_760_000_000_000,
  number: null,
  importRef: null,
  answer: null,
  recipient: "client",
  sentAt: null,
  history: [],
  archivedAt: null,
  archivedBy: null,
  ...over,
});

const IMAGES = [
  { id: "img1", name: "box-avant.png", bytes: 4, width: null, height: null },
  { id: "img2", name: "box-apres.png", bytes: 4, width: null, height: null },
];

export const SILO_QUESTIONS: ProjectSnapshot = {
  meta: {
    id: "silo",
    key: "SILO",
    name: "Silo",
    color: "#14B8A6",
    folder: null,
    worktree: null,
    storybook: null,
    delivery: null,
    tracking: null,
    description: null,
    client: "Silo SA",
  },
  workflow: [],
  pages: [],
  tickets: [
    silTicket("t51", "SILO-51", "Photos des box"),
    silTicket("t34", "SILO-34", "Quotas"),
    silTicket("t81", "SILO-81", "Rapports"),
  ],
  links: [],
  questions: [
    question("q14", "t51", Q14, { blocking: true, number: 14, images: IMAGES }),
    question("q16", "t34", Q16, { number: 16, recipient: "product" }),
    question("q17", "t81", "Un rapport par chef de centre ou par client ?", { number: 17 }),
  ],
  questionRecipients: [...DEFAULT_RECIPIENTS],
  instances: [],
  rules: [],
  bindings: [],
  sprints: [],
  nextTicketKey: "SILO-82",
};

export async function sealQuestions({ api, keys }: Pick<PhoneFixture, "api" | "keys">): Promise<void> {
  const builtAt = 1_760_619_120_000;
  putBlob(api, await sealJson(keys, "silo", "project", SILO_QUESTIONS, { seq: 2, builtAt }));
  for (const image of IMAGES)
    putBlob(
      api,
      await sealJson(keys, "silo", `image:q14:${image.id}`, { mime: "image/png", bytes: btoa("png!") }),
    );
}
