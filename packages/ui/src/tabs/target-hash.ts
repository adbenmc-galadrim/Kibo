import { featureLabel, isFeature, NodeId, Screen, TabTarget, type TicketView } from "@kibo/schema";

const enc = encodeURIComponent;

const ticketKeys = new Map<string, string>();
const keySlot = (projectId: string, ticketId: string) => `${projectId}\n${ticketId}`;

export function rememberTicketKey(projectId: string, ticketId: string, key: string): void {
  ticketKeys.set(keySlot(projectId, ticketId), key);
}

type Addressable = Pick<TicketView, "id" | "key" | "shortKey">;

export const findTicket = <T extends Addressable>(tickets: readonly T[], ref: string): T | undefined =>
  tickets.find((t) => t.id === ref) ?? tickets.find((t) => t.key === ref || t.shortKey === ref);

export const ticketAddressKey = (
  t: Pick<TicketView, "key" | "shortKey" | "parentId" | "progress">,
): string | null => (isFeature(t) ? featureLabel(t) : t.key) || null;

const ticketAddress = (projectId: string, ticketId: string): string =>
  ticketKeys.get(keySlot(projectId, ticketId)) ?? ticketId;

const SCREEN_HASHES: Record<Screen, string> = {
  general: "#/settings/general",
  domains: "#/settings/domains",
  components: "#/components",
  mine: "#/mine",
  inbox: "#/inbox",
  integrations: "#/settings/integrations",
  appearance: "#/settings/appearance",
  sources: "#/settings/components",
  shortcuts: "#/settings/shortcuts",
  workspace: "#/settings/workspace",
};

export function targetToHash(target: TabTarget | null): string {
  if (!target) return "#/";
  if (target.kind === "screen")
    return `${SCREEN_HASHES[target.screen]}${target.projectId ? `?project=${enc(target.projectId)}` : ""}`;
  const base = `#/p/${enc(target.projectId)}`;
  switch (target.kind) {
    case "project":
      return `${base}/`;
    case "page":
      return `${base}/${enc(target.pageId)}${target.question ? `?question=${enc(target.question)}` : ""}`;
    case "ticket":
      return `${base}/t/${enc(ticketAddress(target.projectId, target.ticketId))}`;
    case "sprint":
      return `${base}/s/${enc(target.sprintId)}`;
    case "file": {
      const q = new URLSearchParams({ path: target.path });
      if (target.worktree) q.set("wt", target.worktree);
      if (target.line !== null) q.set("line", String(target.line));
      return `${base}/file?${q.toString()}`;
    }
  }
}

function candidate(projectId: string, rest: string, q: URLSearchParams): unknown {
  if (rest === "") return { kind: "project", projectId };
  if (rest === "file") {
    const line = q.get("line");
    return {
      kind: "file",
      projectId,
      worktree: q.get("wt"),
      path: q.get("path") ?? "",
      line: line ? Number(line) : null,
    };
  }
  if (rest.startsWith("t/"))
    return { kind: "ticket", projectId, ticketId: decodeURIComponent(rest.slice(2)) };
  if (rest.startsWith("s/"))
    return { kind: "sprint", projectId, sprintId: decodeURIComponent(rest.slice(2)) };
  const question = q.get("question");
  return {
    kind: "page",
    projectId,
    pageId: decodeURIComponent(rest),
    ...(NodeId.safeParse(question).success && { question }),
  };
}

function screenTarget(hash: string): TabTarget | null {
  const [path = "", query = ""] = hash.split("?");
  const bare = path.replace(/\/$/, "");
  const screen = Screen.options.find((s) => SCREEN_HASHES[s] === bare);
  if (!screen) return null;
  const projectId = new URLSearchParams(query).get("project");
  return projectId ? { kind: "screen", screen, projectId } : { kind: "screen", screen };
}

function pathCandidate(path: string, query: string): unknown {
  const m = /^\/p\/([^/]+)(?:\/(.*))?$/.exec(path);
  if (!m?.[1]) return null;
  return candidate(decodeURIComponent(m[1]), m[2] ?? "", new URLSearchParams(query));
}

type ProjectRef = { id: string; key: string };

export function resolveProjectKey(
  target: TabTarget | null,
  projects: readonly ProjectRef[],
): TabTarget | null {
  if (target === null || !("projectId" in target) || typeof target.projectId !== "string") return target;
  const projectId = target.projectId;
  if (projects.some((p) => p.id === projectId)) return target;
  const byKey = projects.find((p) => p.key === projectId);
  return byKey ? { ...target, projectId: byKey.id } : target;
}

export function hashToTarget(hash: string): TabTarget | null {
  const screen = screenTarget(hash);
  if (screen) return screen;
  const [path = "", query = ""] = hash.replace(/^#/, "").split("?");
  try {
    const parsed = TabTarget.safeParse(pathCandidate(path, query));
    return parsed.success ? parsed.data : null;
  } catch (e) {
    if (e instanceof URIError) return null;
    throw e;
  }
}
