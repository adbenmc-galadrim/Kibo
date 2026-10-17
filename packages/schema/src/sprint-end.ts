import type { FeatureState } from "./feature-state";
import type { SprintView } from "./sprint";

export type SprintEndFeature = {
  shortKey: string;
  title: string;
  state: FeatureState;
  remainingKeys: string[];
};

const stepsLeft = (n: number): string => (n === 1 ? "1 étape restante" : `${n} étapes restantes`);
const remainingOf = (f: SprintEndFeature): string =>
  `${f.shortKey} a ${stepsLeft(f.remainingKeys.length)} (${f.remainingKeys.join(", ")})`;

function deliveredOf(keys: readonly string[]): string {
  if (keys.length === 0) return "";
  if (keys.length === 1) return ` ${keys[0]} est livrée.`;
  return ` ${keys.slice(0, -1).join(", ")} et ${keys.at(-1)} sont livrées.`;
}

export function sprintEndDigest(sprint: SprintView, features: readonly SprintEndFeature[]): string | null {
  const left = features.filter((f) => f.state.status !== "delivered");
  if (left.length === 0) return null;
  const delivered = features.filter((f) => f.state.status === "delivered").map((f) => f.shortKey);
  return `${sprint.code} est terminé : ${left.map(remainingOf).join(" ; ")}.${deliveredOf(delivered)} Propose un report ou un retrait du planning.`;
}
