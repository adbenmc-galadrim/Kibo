const escapeRegExp = (text: string): string => text.replace(/[.*+?^${}()|[\]-]/g, "\\$&");

const namesKey = (branch: string, key: string): boolean =>
  new RegExp(`(^|[^A-Za-z0-9])${escapeRegExp(key)}([^0-9]|$)`, "i").test(branch);

export function matchBranchToTicket(
  branch: string,
  tickets: readonly { id: string; key: string | null }[],
): string | null {
  const candidates = tickets.filter((t) => t.key !== null && namesKey(branch, t.key));
  return candidates.length === 1 ? (candidates[0]?.id ?? null) : null;
}

const REMOTE_REF = /^refs\/remotes\/[^/]+\//;
const DEFAULT_REMOTE = "origin/";

export const stripRemote = (ref: string): string => {
  if (ref.startsWith("refs/heads/")) return ref.slice("refs/heads/".length);
  if (REMOTE_REF.test(ref)) return ref.replace(REMOTE_REF, "");
  return ref.startsWith(DEFAULT_REMOTE) ? ref.slice(DEFAULT_REMOTE.length) : ref;
};
