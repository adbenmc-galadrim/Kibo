import { type DenialItem, isTerminal, type Question, type RunState } from "@kibo/schema";

const HOME = /^(?:\/Users\/[^/]+|\/home\/[^/]+)(?=$|\/)/;

export const tilde = (path: string): string => path.replace(HOME, "~");

export const KIBO_AUTHOR = "kibo";

export const isDenialQuestion = (q: Question): boolean =>
  q.createdBy.kind === "agent" && q.createdBy.ref === KIBO_AUTHOR && q.runId !== null;

export const isAllowable = (item: DenialItem): boolean => item.rule !== null || item.addDir !== null;

export const itemKey = (item: DenialItem): string =>
  item.rule ?? (item.addDir !== null ? `dir:${item.addDir}` : `${item.tool}:${item.target}`);

export const canRelaunch = (state: RunState | null): boolean =>
  state !== null && (state === "waiting_input" || isTerminal(state));

export type Allowance = { rules: string[]; addDirs: string[]; left: DenialItem[] };

export function allowanceOf(items: readonly DenialItem[], checked: ReadonlySet<string>): Allowance {
  const kept = items.filter((i) => isAllowable(i) && checked.has(itemKey(i)));
  return {
    rules: kept.flatMap((i) => (i.rule === null ? [] : [i.rule])),
    addDirs: kept.flatMap((i) => (i.rule === null && i.addDir !== null ? [i.addDir] : [])),
    left: items.filter((i) => !kept.includes(i)),
  };
}
