import { NodeId, Screen, TabTarget } from "@kibo/schema";

const enc = encodeURIComponent;

const SCREEN_HASHES: Record<Screen, string> = {
  agents: "#/agents",
  queue: "#/agents/queue",
  skills: "#/agents/skills",
  general: "#/settings/general",
  domains: "#/settings/domains",
  components: "#/components",
  mine: "#/mine",
  inbox: "#/inbox",
  integrations: "#/settings/integrations",
  appearance: "#/settings/appearance",
  security: "#/settings/security",
  sources: "#/settings/components",
  sync: "#/settings/sync",
  shortcuts: "#/settings/shortcuts",
  workspace: "#/settings/workspace",
  creations: "#/creations",
};

export function targetToHash(target: TabTarget | null): string {
  if (!target) return "#/";
  if (target.kind === "screen")
    return `${SCREEN_HASHES[target.screen]}${target.projectId ? `?project=${enc(target.projectId)}` : ""}`;
  if (target.kind === "run") return `#/runs/${enc(target.runId)}`;
  if (target.kind === "skill") return `#/skills/${enc(target.skillId)}`;
  const base = `#/p/${enc(target.projectId)}`;
  switch (target.kind) {
    case "project":
      return `${base}/`;
    case "page":
      return `${base}/${enc(target.pageId)}${target.question ? `?question=${enc(target.question)}` : ""}`;
    case "ticket":
      return `${base}/t/${enc(target.ticketId)}`;
    case "sprint":
      return `${base}/s/${enc(target.sprintId)}`;
    case "changes":
      return target.worktree ? `${base}/changes?wt=${enc(target.worktree)}` : `${base}/changes`;
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
  if (rest === "changes") return { kind: "changes", projectId, worktree: q.get("wt") };
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
  const run = /^\/runs\/([^/]+)\/?$/.exec(path);
  if (run?.[1]) return { kind: "run", runId: decodeURIComponent(run[1]) };
  const skill = /^\/skills\/([^/]+)\/?$/.exec(path);
  if (skill?.[1]) return { kind: "skill", skillId: decodeURIComponent(skill[1]) };
  const m = /^\/p\/([^/]+)(?:\/(.*))?$/.exec(path);
  if (!m?.[1]) return null;
  return candidate(decodeURIComponent(m[1]), m[2] ?? "", new URLSearchParams(query));
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
