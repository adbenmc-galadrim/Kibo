import { isAbsolute, relative } from "node:path";
import { KiboError, type ProjectSnapshot, type ProjectSummary } from "@kibo/schema";
import type { Parsed } from "../args";
import type { DaemonClient } from "../daemon-client";
import { fr, frTickets } from "../fr";
import { summarize, type TicketSummary } from "../tickets/ticket-view";
import { findProject, type SessionIo } from "./daemon-session";

export type TicketsContext = {
  client: DaemonClient;
  snapshot: ProjectSnapshot;
  flags: Parsed["flags"];
  io: SessionIo;
};

export function summaryOf(snapshot: ProjectSnapshot, id: string): TicketSummary {
  const found = summarize(snapshot).find((t) => t.id === id);
  if (!found) throw new KiboError("NOT_FOUND", `ticket ${id} vanished`);
  return found;
}

export function notFound(ident: string, io: SessionIo): number {
  io.err(frTickets.ticketNotFound(ident));
  return 1;
}

const holds = (folder: string, cwd: string): boolean => {
  const rel = relative(folder, cwd);
  return !rel.startsWith("..") && !isAbsolute(rel);
};

export function byFolder(projects: readonly ProjectSummary[], cwd: string): ProjectSummary[] {
  const depth = (p: ProjectSummary) => (p.folder !== null && holds(p.folder, cwd) ? p.folder.length : -1);
  return projects
    .map((p, index) => ({ p, index, depth: depth(p) }))
    .sort((a, b) => b.depth - a.depth || a.index - b.index)
    .map(({ p }) => p);
}

const inFolder = (projects: readonly ProjectSummary[], cwd: string): ProjectSummary | null =>
  byFolder(projects, cwd).find((p) => p.folder !== null && holds(p.folder, cwd)) ?? null;

const PREFIXED_KEY = /^([A-Za-z]{2,6})-\d+$/;
const FEATURE_KEY = /^F\d+$/i;

export type ProjectChoice = { project: ProjectSummary } | { problem: string; code: 1 | 2 };

export function chooseProject(
  projects: readonly ProjectSummary[],
  ident: string,
  wanted: string | undefined,
  cwd: string,
): ProjectChoice {
  if (wanted !== undefined) {
    const named = findProject(projects, wanted);
    return named ? { project: named } : { problem: frTickets.projectNotFound(wanted), code: 1 };
  }
  const prefix = PREFIXED_KEY.exec(ident.trim())?.[1]?.toUpperCase();
  const byKey = prefix === undefined ? null : projects.find((p) => p.key === prefix);
  const found = byKey ?? inFolder(projects, cwd);
  if (found) return { project: found };
  if (prefix !== undefined) return { problem: frTickets.projectNotFound(prefix), code: 1 };
  if (FEATURE_KEY.test(ident.trim()))
    return { problem: fr.error("INVALID_INPUT", frTickets.featureNeedsProject), code: 1 };
  return { problem: frTickets.usage, code: 2 };
}
