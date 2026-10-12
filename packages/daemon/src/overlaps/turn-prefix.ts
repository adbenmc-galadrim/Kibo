import { composeWorkSection, sectionFingerprint } from "@kibo/core/overlaps/section";
import type { ParallelWork, RunView } from "@kibo/schema";

export type TurnPrefixer = {
  briefSection(run: RunView): Promise<string | null>;
  changedSection(run: RunView): Promise<string | null>;
  prompt(run: RunView, pendingAnswer: string): Promise<string>;
  forget(runId: string): void;
};

export const withSection = (section: string | null, pendingAnswer: string): string =>
  section === null
    ? pendingAnswer
    : pendingAnswer === ""
      ? section
      : `${section}\n\n# Message\n\n${pendingAnswer}`;

type TurnPrefixDeps = {
  parallelWork(run: RunView): Promise<ParallelWork>;
  hash: (text: string) => string;
  now: () => number;
};

const UNCHANGED = Symbol("unchanged");

export function createTurnPrefixer(deps: TurnPrefixDeps): TurnPrefixer {
  const injected = new Map<string, string>();

  async function sectionOf(run: RunView, always: boolean): Promise<string | null | typeof UNCHANGED> {
    try {
      const section = composeWorkSection(await deps.parallelWork(run), deps.now());
      const print = sectionFingerprint(section, deps.hash);
      if (!always && injected.get(run.id) === print) return UNCHANGED;
      injected.set(run.id, print);
      return section;
    } catch (e) {
      console.error(`[kibo-daemon] work in progress of run ${run.id} could not be composed`, e);
      return UNCHANGED;
    }
  }

  async function changedSection(run: RunView): Promise<string | null> {
    const section = await sectionOf(run, false);
    return section === UNCHANGED ? null : section;
  }

  return {
    async briefSection(run) {
      const section = await sectionOf(run, true);
      return section === UNCHANGED ? null : section;
    },
    changedSection,
    async prompt(run, pendingAnswer) {
      return withSection(await changedSection(run), pendingAnswer);
    },
    forget(runId) {
      injected.delete(runId);
    },
  };
}
