import { KiboError } from "@kibo/schema";
import { frShare } from "../i18n/fr-share";
import { syncErrorText } from "./sync-errors";

const t = frShare;
const USED = "; the invite is used: the project owner must remove this member, then invite again";
const DUPLICATE = /^duplicate project key (\S+)$/;
const ALREADY_HERE = /^project \S+ is already on this machine$/;

const codeOf = (e: unknown): string => (e instanceof KiboError ? e.code : "INTERNAL");

export function shareErrorText(e: unknown): string {
  if (e instanceof KiboError && e.code === "CONFLICT") {
    if (e.detail.includes("its sync is suspended")) return t.shareSuspended;
    if (e.detail.includes("already in use on the sync server")) return t.shareTaken;
  }
  return syncErrorText(t.shareErrors, codeOf(e));
}

export const manageErrorText = (e: unknown): string => syncErrorText(t.manageErrors, codeOf(e));

function joinReason(code: string, detail: string): string {
  const key = DUPLICATE.exec(detail)?.[1];
  if (key) return t.duplicateKey(key);
  if (ALREADY_HERE.test(detail)) return t.alreadyHere;
  return syncErrorText(t.joinErrors, code);
}

export function joinErrorText(e: unknown): string {
  if (!(e instanceof KiboError)) return t.joinErrors.fallback;
  if (!e.detail.endsWith(USED)) return joinReason(e.code, e.detail);
  const reason = joinReason(e.code, e.detail.slice(0, -USED.length));
  return `${reason.replace(/\.$/, "")}. ${t.inviteUsed}`;
}
