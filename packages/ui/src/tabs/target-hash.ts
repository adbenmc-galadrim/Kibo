import { Screen, TabTarget } from "@kibo/schema";

const enc = encodeURIComponent;

const SCREEN_HASHES: Record<Screen, string> = {
  agents: "#/agents",
  queue: "#/agents/queue",
  domains: "#/settings/domains",
};

export function targetToHash(target: TabTarget | null): string {
  if (!target) return "#/";
  if (target.kind === "screen") return SCREEN_HASHES[target.screen];
  const base = `#/p/${enc(target.projectId)}`;
  switch (target.kind) {
    case "project":
      return `${base}/`;
    case "page":
      return `${base}/${enc(target.pageId)}`;
    case "ticket":
      return `${base}/t/${enc(target.ticketId)}`;
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
  return { kind: "page", projectId, pageId: decodeURIComponent(rest) };
}

function screenTarget(hash: string): TabTarget | null {
  const bare = hash.replace(/\/$/, "");
  const screen = Screen.options.find((s) => SCREEN_HASHES[s] === bare);
  return screen ? { kind: "screen", screen } : null;
}

export function hashToTarget(hash: string): TabTarget | null {
  const screen = screenTarget(hash);
  if (screen) return screen;
  const [path = "", query = ""] = hash.replace(/^#/, "").split("?");
  const m = /^\/p\/([^/]+)(?:\/(.*))?$/.exec(path);
  if (!m?.[1]) return null;
  try {
    const parsed = TabTarget.safeParse(
      candidate(decodeURIComponent(m[1]), m[2] ?? "", new URLSearchParams(query)),
    );
    return parsed.success ? parsed.data : null;
  } catch (e) {
    if (e instanceof URIError) return null;
    throw e;
  }
}
