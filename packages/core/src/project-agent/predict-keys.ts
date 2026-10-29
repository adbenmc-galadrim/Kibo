import { formatTicketKey, type KeyForecast, type ProposedAction } from "@kibo/schema";
import { MAX_FEATURE_SEQ } from "../short-key";

type NextKey = () => string | null;

const TICKET_KEY = /^([A-Z]{2,6})-(\d+)$/;
const FEATURE_PREFIX = "F";

function stepKeys(nextTicketKey: string | null): NextKey {
  const match = nextTicketKey === null ? null : TICKET_KEY.exec(nextTicketKey);
  if (!match) return () => null;
  const prefix = match[1] ?? "";
  let seq = Number(match[2]);
  return () => formatTicketKey(prefix, seq++);
}

function featureKeys(forecast: KeyForecast): NextKey {
  const taken = new Set(forecast.usedShortKeys);
  let seq = forecast.nextFeatureSeq;
  return () => {
    if (seq === null) return null;
    while (taken.has(`${FEATURE_PREFIX}${seq}`)) seq += 1;
    if (seq > MAX_FEATURE_SEQ) return null;
    return `${FEATURE_PREFIX}${seq++}`;
  };
}

export function predictKeys(
  actions: readonly ProposedAction[],
  forecast: KeyForecast,
): Record<string, string | null> {
  const nextStep = stepKeys(forecast.nextTicketKey);
  const nextFeature = featureKeys(forecast);
  const plainRoots = new Set<string>();
  const adopt = (parent: string | null | undefined) => {
    if (typeof parent === "string" && plainRoots.delete(parent)) nextFeature();
  };
  const keys: Record<string, string | null> = {};
  for (const action of actions) {
    if (action.type === "updateTicket" && typeof action.parent === "string") {
      adopt(action.parent);
      plainRoots.delete(action.ticket);
    }
    if (action.type !== "createTicket") continue;
    if (action.feature === true) {
      keys[action.ref] = nextFeature();
      continue;
    }
    adopt(action.parent);
    keys[action.ref] = nextStep();
    if (action.parent === undefined) plainRoots.add(action.ref);
  }
  return keys;
}
