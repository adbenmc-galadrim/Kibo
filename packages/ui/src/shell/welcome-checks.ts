import type { Environment, SandboxStatus } from "@kibo/schema";
import { fr } from "../i18n/fr";
import { frSecurity } from "../i18n/fr-security";
import { abbreviateHome } from "../lib/home-path";
import { sandboxActive, sandboxProblem, sandboxStopped } from "../lib/sandbox-problem";

export type CheckId = "daemon" | "claude" | "git" | "gh" | "capacity" | "isolation" | "github";
export type CheckState = "ok" | "warn" | "optional";
export type CheckHelp = { text: string; commands: string[] };
export type CheckView = {
  id: CheckId;
  state: CheckState;
  title: string;
  detail: string;
  help?: CheckHelp;
  retry: boolean;
};

const t = fr.welcome;
const CLAUDE_INSTALL = ["npm install -g @anthropic-ai/claude-code", "claude"];

const ok = (id: CheckId, title: string, detail: string): CheckView => ({
  id,
  state: "ok",
  title,
  detail,
  retry: false,
});

const failing = (id: CheckId, title: string, detail: string, help?: CheckHelp): CheckView => ({
  id,
  state: "warn",
  title,
  detail,
  retry: true,
  ...(help ? { help } : {}),
});

function claudeCheck(env: Environment): CheckView {
  if (env.ai.available) return ok("claude", t.claude, env.ai.loggedIn ? t.claudeReady : t.claudeUnverified);
  if (env.ai.reason === "logged_out")
    return failing("claude", t.claude, t.claudeLoggedOut, { text: t.claudeLoginHelp, commands: ["claude"] });
  return failing("claude", t.claude, t.claudeMissing, {
    text: t.claudeInstallHelp,
    commands: CLAUDE_INSTALL,
  });
}

function isolationCheck(sandbox: SandboxStatus): CheckView {
  const s = frSecurity;
  if (sandbox.available) return ok("isolation", s.welcome.title, sandboxActive(sandbox));
  const problem = sandboxProblem(sandbox);
  const detail = sandboxStopped(sandbox) ? s.welcome.stopped(problem) : s.isolation.unavailable(problem);
  const help = sandbox.fix ? { text: s.welcome.fixHelp, commands: [sandbox.fix] } : undefined;
  return failing("isolation", s.welcome.title, detail, help);
}

export function welcomeChecks(env: Environment, sandbox: SandboxStatus | null): CheckView[] {
  const { cores, ramGb, hostSlots } = env.capacity;
  const rows: CheckView[] = [
    ok("daemon", t.daemon, t.daemonDetail(env.daemon.address, abbreviateHome(env.daemon.home))),
    claudeCheck(env),
    env.git ? ok("git", t.git, t.gitDetail(env.git)) : failing("git", t.git, t.gitDetail(null)),
    env.gh
      ? ok("gh", t.gh, t.ghDetail(env.gh))
      : { id: "gh", state: "optional", title: t.gh, detail: t.ghDetail(null), retry: false },
    ok("capacity", t.capacity, t.capacityDetail(cores, ramGb, hostSlots)),
  ];
  if (sandbox) rows.push(isolationCheck(sandbox));
  rows.push({
    id: "github",
    state: env.github.connected ? "ok" : "optional",
    title: t.github,
    detail: env.github.connected ? t.githubConnected : t.githubDetail,
    retry: false,
  });
  return rows;
}

export const agentsBlocked = (rows: CheckView[]): boolean =>
  rows.some((r) => (r.id === "claude" || r.id === "git") && r.state === "warn");
