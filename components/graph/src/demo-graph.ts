import type { GraphEdge, GraphTicket } from "./critical-path";

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
