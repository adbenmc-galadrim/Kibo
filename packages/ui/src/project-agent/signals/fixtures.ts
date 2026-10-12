import { type Signal, type SignalsView, signalRef } from "@kibo/schema";
import { NOW } from "../../agents/fixtures";

const MIN = 60_000;

export function signalFixture(p: Partial<Signal> & Pick<Signal, "seq">): Signal {
  return {
    id: `s${p.seq}`,
    projectId: "kibo",
    runId: "r42",
    runLabel: "opus-dev-2",
    profileName: "opus",
    originTicketId: "t14",
    originTicketKey: "KIB-14",
    ticketId: "t14",
    ticketKey: "KIB-14",
    kind: "ticket",
    title: "Tests du récepteur de hooks",
    body: "",
    createdAt: NOW - 20 * MIN,
    ref: signalRef(p.seq),
    status: "new",
    readAt: null,
    readRunId: null,
    decidedAt: null,
    batchId: null,
    actionId: null,
    decidedBy: null,
    ...p,
  };
}

export const OPEN_SIGNALS: Signal[] = [
  signalFixture({
    seq: 1,
    kind: "ticket",
    title: "Tests du récepteur de hooks",
    body: "Le récepteur n'a aucun test d'intégration.",
    createdAt: NOW - 19 * MIN,
  }),
  signalFixture({
    seq: 2,
    kind: "blocker",
    runId: "r43",
    runLabel: "opus-dev-3",
    originTicketId: "t16",
    originTicketKey: "KIB-16",
    ticketId: "t16",
    ticketKey: "KIB-16",
    title: "Attend le schéma Loro de KIB-12",
    createdAt: NOW - 17 * MIN,
    status: "read",
    readAt: NOW - 14 * MIN,
    readRunId: "pa1",
  }),
  signalFixture({
    seq: 3,
    kind: "context",
    runId: "r41",
    runLabel: "opus-dev-1",
    originTicketId: "t12",
    originTicketKey: "KIB-12",
    ticketId: "t12",
    ticketKey: "KIB-12",
    title: "Le reparentage garde l'ordre des enfants",
    createdAt: NOW - 13 * MIN,
  }),
];

export const CLOSED_SIGNAL = signalFixture({
  seq: 4,
  kind: "question",
  title: "Garder deux tons de zinc pour les bordures ?",
  createdAt: NOW - 60 * MIN,
  status: "handled",
  decidedAt: NOW - 50 * MIN,
  batchId: "b2",
  actionId: 1,
});

export const signalsView = (p: Partial<SignalsView> = {}): SignalsView => ({
  signals: [...OPEN_SIGNALS, CLOSED_SIGNAL],
  wakeup: { projectId: "kibo", lastAt: NOW - 14 * MIN, dueAt: NOW - 4 * MIN },
  ...p,
});

export const emptySignals = (): SignalsView => ({
  signals: [],
  wakeup: { projectId: "kibo", lastAt: null, dueAt: null },
});
