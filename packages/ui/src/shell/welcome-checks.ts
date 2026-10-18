import type { Environment } from "@kibo/schema";
import { frAi } from "../i18n/fr-ai";

export type CheckId = "git" | "gh" | "claude" | "github";
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

const t = frAi.welcome;
const GH_INSTALL = ["brew install gh", "gh auth login"];
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

const optional = (id: CheckId, title: string, detail: string, help: CheckHelp): CheckView => ({
  id,
  state: "optional",
  title,
  detail,
  retry: true,
  help,
});

function claudeCheck(env: Environment): CheckView {
  if (env.ai.available) return ok("claude", t.claude, env.ai.loggedIn ? t.claudeReady : t.claudeUnverified);
  if (env.ai.reason === "logged_out")
    return optional("claude", t.claude, t.claudeLoggedOut, { text: t.claudeLoginHelp, commands: ["claude"] });
  return optional("claude", t.claude, t.claudeMissing, {
    text: t.claudeInstallHelp,
    commands: CLAUDE_INSTALL,
  });
}

export function welcomeChecks(env: Environment): CheckView[] {
  return [
    env.git ? ok("git", t.git, t.gitDetail(env.git)) : failing("git", t.git, t.gitDetail(null)),
    env.gh
      ? ok("gh", t.gh, t.ghDetail(env.gh))
      : failing("gh", t.gh, t.ghDetail(null), { text: t.ghInstallHelp, commands: GH_INSTALL }),
    claudeCheck(env),
    {
      id: "github",
      state: env.github.connected ? "ok" : "optional",
      title: t.github,
      detail: env.github.connected ? t.githubConnected : t.githubDetail,
      retry: false,
    },
  ];
}
