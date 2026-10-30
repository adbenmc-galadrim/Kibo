import type { KeyForecast } from "@kibo/schema";
import type { LoroDoc } from "loro-crdt";
import { peekTicketKey } from "./project";
import { freeFeatureSeq, MAX_FEATURE_SEQ, usedShortKeys } from "./short-key";

const seqOf = (shortKey: string): number => Number(shortKey.replace(/^\D+/, ""));
const byNumber = (a: string, b: string): number => seqOf(a) - seqOf(b) || (a < b ? -1 : Number(a > b));

function nextFeatureSeq(doc: LoroDoc): number | null {
  const seq = freeFeatureSeq(doc, null);
  return seq > MAX_FEATURE_SEQ ? null : seq;
}

export function keyForecast(doc: LoroDoc): KeyForecast {
  return {
    nextTicketKey: peekTicketKey(doc),
    nextFeatureSeq: nextFeatureSeq(doc),
    usedShortKeys: [...usedShortKeys(doc, null)].sort(byNumber),
  };
}
