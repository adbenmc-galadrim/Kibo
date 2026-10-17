import { readProject } from "@kibo/core";
import {
  FINAL_STATUSES,
  featureSteps,
  type ProjectSnapshot,
  type SprintEndFeature,
  type SprintView,
  sprintEndDigest,
} from "@kibo/schema";
import type { Docs } from "../docs";
import { projectWritable } from "../signals/bootstrap";
import type { SprintEndStore } from "./sprint-end-store";

export const SPRINT_END_HISTORY_DAYS = 7;

export type SprintEndDeps = {
  docs: Pick<Docs, "projectIds" | "project" | "assertWritable">;
  store: SprintEndStore;
  agent: () => { send(projectId: string, text: string): void };
  today: () => string;
  log: (what: string) => (e: unknown) => void;
};

export type SprintEndWatch = { pass(): void; markOld(): void };

function daysBefore(day: string, days: number): string {
  const date = new Date(`${day}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() - days);
  return date.toISOString().slice(0, 10);
}

function featuresOf(snapshot: ProjectSnapshot, sprint: SprintView): SprintEndFeature[] {
  return snapshot.tickets.flatMap((t) => {
    if (t.feature === null || t.sprintId !== sprint.id) return [];
    const steps = featureSteps({ feature: t.id, tickets: snapshot.tickets, links: snapshot.links });
    const remainingKeys = steps
      .filter((s) => !s.optional && !FINAL_STATUSES.includes(s.statusId))
      .map((s) => s.key);
    return [{ shortKey: t.shortKey ?? t.keyLabel, title: t.title, state: t.feature, remainingKeys }];
  });
}

export function startSprintEndWatch(deps: SprintEndDeps): SprintEndWatch {
  const writable = projectWritable(deps.docs);

  const endedSprints = (projectId: string, today: string) => {
    const snapshot = readProject(deps.docs.project(projectId), today);
    const ended = snapshot.sprints.filter((s) => s.end < today && !deps.store.has(s.id));
    return { snapshot, ended };
  };

  const markOldOf = (projectId: string, today: string): void => {
    const cutoff = daysBefore(today, SPRINT_END_HISTORY_DAYS);
    for (const sprint of endedSprints(projectId, today).ended)
      if (sprint.end < cutoff) deps.store.mark(projectId, sprint.id);
  };

  const wake = (projectId: string, today: string): void => {
    markOldOf(projectId, today);
    if (!writable(projectId)) return;
    const { snapshot, ended } = endedSprints(projectId, today);
    for (const sprint of ended) {
      const digest = sprintEndDigest(sprint, featuresOf(snapshot, sprint));
      if (digest !== null) deps.agent().send(projectId, digest);
      deps.store.mark(projectId, sprint.id);
    }
  };

  const eachProject = (what: string, action: (projectId: string, today: string) => void) => {
    const today = deps.today();
    for (const projectId of deps.docs.projectIds()) {
      try {
        action(projectId, today);
      } catch (e) {
        deps.log(`${what} of ${projectId}`)(e);
      }
    }
  };

  return {
    pass: () => eachProject("the sprint end wake-up", wake),
    markOld: () => eachProject("marking the old sprint ends", markOldOf),
  };
}
