import { z } from "zod";
import { KiboError } from "./errors";

export const LABEL_MAX = 20;
export const LabelName = z.string().regex(/^[a-z0-9][a-z0-9:_./-]{0,39}$/);
export const Labels = z.array(LabelName).max(LABEL_MAX);
export type Labels = z.infer<typeof Labels>;

export function normalizeLabels(labels: readonly string[]): string[] {
  const seen = new Set<string>();
  for (const raw of labels) {
    const label = raw.trim();
    if (!LabelName.safeParse(label).success)
      throw new KiboError("INVALID_INPUT", `invalid label ${JSON.stringify(raw)}`);
    seen.add(label);
  }
  if (seen.size > LABEL_MAX) throw new KiboError("INVALID_INPUT", `at most ${LABEL_MAX} labels`);
  return [...seen].sort();
}

export function labelPrefix(label: string): string | null {
  const at = label.indexOf(":");
  return at > 0 ? label.slice(0, at) : null;
}

export function groupLabels(labels: readonly string[]): { prefix: string | null; labels: string[] }[] {
  const sorted = normalizeLabels(labels);
  const free = sorted.filter((l) => labelPrefix(l) === null);
  const prefixes = [...new Set(sorted.map(labelPrefix).filter((p): p is string => p !== null))].sort();
  const groups = prefixes.map((prefix) => ({
    prefix,
    labels: sorted.filter((l) => labelPrefix(l) === prefix),
  }));
  return free.length > 0 ? [{ prefix: null, labels: free }, ...groups] : groups;
}
