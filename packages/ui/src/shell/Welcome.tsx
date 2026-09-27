import type { Environment, SandboxStatus } from "@kibo/schema";
import { Button } from "@kibo/sdk/ui/button";
import { Check, Folder, Plus, TriangleAlert } from "lucide-react";
import { type ReactNode, useEffect, useState } from "react";
import { client } from "../api";
import { fr } from "../i18n/fr";
import { abbreviateHome } from "../lib/home-path";
import { sandboxActive, sandboxProblem, sandboxStopped } from "../lib/sandbox-problem";
import { useRpcQuery } from "../state/use-rpc-query";
import { WorkspaceMark } from "./WorkspaceMark";

type CheckState = "ok" | "warn" | "optional";
type RowProps = {
  state: CheckState;
  title: string;
  detail: string;
  action?: ReactNode;
  children?: ReactNode;
};

const DOT: Record<CheckState, { Icon: typeof Check; tone: string }> = {
  ok: { Icon: Check, tone: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" },
  warn: { Icon: TriangleAlert, tone: "bg-amber-500/15 text-amber-600 dark:text-amber-400" },
  optional: { Icon: Plus, tone: "bg-muted text-foreground" },
};

function CheckRow({ state, title, detail, action, children }: RowProps) {
  const { Icon, tone } = DOT[state];
  const detailTone = state === "warn" ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground";
  return (
    <li className="grid">
      <div className="flex items-center gap-3 px-4 py-3">
        <span aria-hidden className={`grid size-6 shrink-0 place-items-center rounded-full ${tone}`}>
          <Icon className="size-3.5" strokeWidth={2.5} />
        </span>
        <div className="grid min-w-0 flex-1 gap-0.5">
          <span className="text-sm font-medium">{title}</span>
          <span className={`truncate text-xs ${detailTone}`}>{detail}</span>
        </div>
        {action}
      </div>
      {children}
    </li>
  );
}

function IsolationRow({ sandbox }: { sandbox: SandboxStatus }) {
  const t = fr.security;
  if (sandbox.available)
    return <CheckRow state="ok" title={t.welcome.title} detail={sandboxActive(sandbox)} />;
  const problem = sandboxProblem(sandbox);
  const detail = sandboxStopped(sandbox) ? t.welcome.stopped(problem) : t.isolation.unavailable(problem);
  return (
    <CheckRow state="warn" title={t.welcome.title} detail={detail}>
      {sandbox.fix && (
        <div className="grid gap-2 border-t px-4 py-3 pl-13 text-xs text-muted-foreground">
          <p>{t.welcome.fixHelp}</p>
          <pre className="overflow-x-auto rounded-md border bg-background px-3 py-2 font-mono text-foreground">
            <code>{sandbox.fix}</code>
          </pre>
        </div>
      )}
    </CheckRow>
  );
}

function claudeCheck(env: Environment): { state: CheckState; detail: string } {
  if (env.ai.available)
    return { state: "ok", detail: env.ai.loggedIn ? fr.welcome.claudeReady : fr.welcome.claudeUnverified };
  return {
    state: "warn",
    detail: env.ai.reason === "logged_out" ? fr.welcome.claudeLoggedOut : fr.welcome.claudeMissing,
  };
}

type ChecksProps = { env: Environment; sandbox: SandboxStatus | null; onConnectGithub: () => void };

function EnvironmentChecks({ env, sandbox, onConnectGithub }: ChecksProps) {
  const claude = claudeCheck(env);
  const { cores, ramGb, hostSlots } = env.capacity;
  return (
    <ul className="w-full divide-y rounded-xl border bg-card text-left">
      <CheckRow
        state="ok"
        title={fr.welcome.daemon}
        detail={fr.welcome.daemonDetail(env.daemon.address, abbreviateHome(env.daemon.home))}
      />
      <CheckRow state={claude.state} title={fr.welcome.claude} detail={claude.detail} />
      <CheckRow
        state={env.git ? "ok" : "warn"}
        title={fr.welcome.git}
        detail={fr.welcome.gitDetail(env.git, env.gh)}
      />
      <CheckRow
        state="ok"
        title={fr.welcome.capacity}
        detail={fr.welcome.capacityDetail(cores, ramGb, hostSlots)}
      />
      {sandbox && <IsolationRow sandbox={sandbox} />}
      <CheckRow
        state={env.github.connected ? "ok" : "optional"}
        title={fr.welcome.github}
        detail={env.github.connected ? fr.welcome.githubConnected : fr.welcome.githubDetail}
        action={
          env.github.connected ? null : (
            <Button size="sm" variant="outline" onClick={onConnectGithub}>
              {fr.welcome.githubConnect}
            </Button>
          )
        }
      />
    </ul>
  );
}

function useEnvironment(): { env: Environment | null; error: string | null } {
  const [env, setEnv] = useState<Environment | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    client.rpc({ method: "getEnvironment" }).then(
      (e) => alive && setEnv(e),
      (e: unknown) => alive && setError(e instanceof Error ? e.message : fr.common.error),
    );
    return () => {
      alive = false;
    };
  }, []);
  return { env, error };
}

type Props = { onCreate: () => void; onImport: () => void; onConnectGithub: () => void };

export function Welcome({ onCreate, onImport, onConnectGithub }: Props) {
  const { env, error } = useEnvironment();
  const { data: sandbox } = useRpcQuery({ method: "getSandboxStatus" }, ["sandbox.changed"]);
  const subtitle = sandbox && sandboxStopped(sandbox) ? fr.security.welcome.subtitle : fr.welcome.subtitle;
  return (
    <main className="grid min-h-full place-items-center bg-background p-6">
      <div className="grid w-full max-w-xl justify-items-center gap-6 text-center">
        <span className="grid size-14 place-items-center rounded-2xl border bg-card text-foreground">
          <WorkspaceMark className="size-7" />
        </span>
        <div className="grid gap-2">
          <h1 className="text-2xl font-semibold">{fr.welcome.title}</h1>
          <p className="text-sm text-muted-foreground">{subtitle}</p>
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        {env && <EnvironmentChecks env={env} sandbox={sandbox} onConnectGithub={onConnectGithub} />}
        <div className="flex flex-wrap justify-center gap-3">
          <Button variant="outline" onClick={onImport}>
            <Folder className="size-4" /> {fr.welcome.importFolder}
          </Button>
          <Button onClick={onCreate}>
            <Plus className="size-4" /> {fr.welcome.createFirst}
          </Button>
        </div>
      </div>
    </main>
  );
}
