import { listInstances } from "@kibo/core";
import { type BackendDescription, isBuiltinId, splitRef } from "@kibo/schema";
import type { Backends } from "./backends";
import type { JobTarget } from "./jobs";
import type { ProjectRef } from "./registry-listing";

export type UsageTracker = {
  describe(ref: string): Promise<BackendDescription>;
  stop(ref: string): void;
  prune(): void;
};

const isThirdParty = (ref: string) => !isBuiltinId(splitRef(ref).id);

export function usedRefs(projects: ProjectRef[]): Set<string> {
  return new Set(projects.flatMap((p) => listInstances(p.doc).map((i) => i.component)));
}

export function jobTargets(projects: ProjectRef[], approved: (ref: string) => boolean): JobTarget[] {
  return projects.flatMap((p) =>
    listInstances(p.doc).flatMap((i): JobTarget[] =>
      isThirdParty(i.component) && approved(i.component)
        ? [{ projectId: p.id, instanceId: i.id, ref: i.component, config: i.config }]
        : [],
    ),
  );
}

export function createUsageTracker(deps: { projects(): ProjectRef[]; backends: Backends }): UsageTracker {
  const described = new Map<string, Promise<BackendDescription>>();
  const stop = (ref: string) => {
    described.delete(ref);
    deps.backends.stop(ref);
  };
  return {
    describe(ref) {
      const cached = described.get(ref);
      if (cached) return cached;
      const next = deps.backends.describe(ref);
      described.set(ref, next);
      next.catch(() => described.delete(ref));
      return next;
    },
    stop,
    prune() {
      const used = usedRefs(deps.projects());
      for (const ref of deps.backends.running()) if (!used.has(ref)) stop(ref);
    },
  };
}
