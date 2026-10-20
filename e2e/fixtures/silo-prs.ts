import { SILO_PRS } from "../pixel-settings";
import type { PrChecksSpec, PrReviewSpec } from "./silo-maquettes";

export { SILO_PRS };

export type PrSeed = {
  n: number;
  number: number;
  state: "open" | "draft";
  review: PrReviewSpec;
  checks: PrChecksSpec;
  base: string;
  head: string;
};
export type BranchSeed = { n: number; branch: string; base: string };

export const SILO_PRS_REFS: readonly PrSeed[] = [
  { n: 32, number: 22, state: "open", review: "none", checks: "ok", base: "dev", head: "feat/silo-32" },
  {
    n: 45,
    number: 20,
    state: "open",
    review: "changes_requested",
    checks: "error",
    base: "dev",
    head: "feat/silo-45",
  },
  { n: 61, number: 23, state: "open", review: "none", checks: "running", base: "dev", head: "chore/expo-54" },
  {
    n: 33,
    number: 24,
    state: "draft",
    review: "none",
    checks: "running",
    base: "feat/silo-32",
    head: "feat/envoi-hors-ligne",
  },
  {
    n: 34,
    number: 25,
    state: "draft",
    review: "none",
    checks: "ok",
    base: "feat/envoi-hors-ligne",
    head: "feat/silo-34",
  },
];

export const SILO_PRS_BRANCHES: readonly BranchSeed[] = [
  { n: 33, branch: "feat/envoi-hors-ligne", base: "feat/silo-32" },
  { n: 34, branch: "feat/silo-34", base: "feat/envoi-hors-ligne" },
];

export const SILO_PRS_IN_PROGRESS: readonly number[] = [34];
export const SILO_PRS_COUNTER = "5 PR ouvertes · 3 piles · 2 en attente de review · 1 à corriger";
export const SILO_PRS_STACKS: readonly (readonly number[])[] = [[22, 24, 25], [20], [23]];
export const SILO_PRS_RAIL = "dev";
