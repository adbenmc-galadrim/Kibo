import type { GraphEdge, GraphTicket } from "./critical-path";
import type { WaveTicket } from "./waves";

const t = (key: string, statusId: GraphTicket["statusId"]): GraphTicket => ({ id: key, key, statusId });

export const DEMO_TICKETS: GraphTicket[] = [
  t("KIB-5", "done"),
  t("KIB-13", "done"),
  t("KIB-12", "in_progress"),
  t("KIB-15", "todo"),
  t("KIB-11", "in_review"),
  t("KIB-21", "blocked"),
  t("KIB-22", "backlog"),
  t("KIB-16", "in_progress"),
  t("KIB-14", "in_progress"),
  t("KIB-18", "todo"),
  t("KIB-9", "todo"),
];

const b = (from: string, to: string): GraphEdge => ({ from, to, type: "blocks" });

export const DEMO_EDGES: GraphEdge[] = [
  b("KIB-5", "KIB-12"),
  b("KIB-13", "KIB-12"),
  b("KIB-12", "KIB-15"),
  b("KIB-11", "KIB-21"),
  b("KIB-21", "KIB-22"),
  b("KIB-16", "KIB-22"),
  { from: "KIB-12", to: "KIB-16", type: "relates" },
];

const STARTABLE = new Set(["KIB-18", "KIB-9"]);

export const DEMO_LABELS: Readonly<Record<string, readonly string[]>> = {
  "KIB-5": ["chapitre:c1"],
  "KIB-13": ["chapitre:c1"],
  "KIB-12": ["chapitre:c1", "area:api"],
  "KIB-15": ["chapitre:c1"],
  "KIB-11": ["chapitre:c2"],
  "KIB-21": ["chapitre:c2"],
  "KIB-22": ["chapitre:c2"],
};

export const DEMO_WAVE_TICKETS: WaveTicket[] = DEMO_TICKETS.map((t) => ({
  ...t,
  startable: STARTABLE.has(t.id),
  live: false,
  labels: DEMO_LABELS[t.id] ?? [],
}));
