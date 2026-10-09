import type { Environment, SandboxStatus } from "@kibo/schema";
import { Button } from "@kibo/sdk/ui/button";
import { Check, Folder, GraduationCap, Plus, RotateCw, TriangleAlert } from "lucide-react";
import { type ReactNode, useCallback, useEffect, useState } from "react";
import { client } from "../api";
import { fr } from "../i18n/fr";
import { frSecurity } from "../i18n/fr-security";
import { sandboxStopped } from "../lib/sandbox-problem";
import { useRpcQuery } from "../state/use-rpc-query";
import { WorkspaceMark } from "./WorkspaceMark";
import { agentsBlocked, type CheckState, type CheckView, welcomeChecks } from "./welcome-checks";

type RowProps = { check: CheckView; action?: ReactNode; onRetry: () => void };

const DOT: Record<CheckState, { Icon: typeof Check; tone: string }> = {
  ok: { Icon: Check, tone: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" },
  warn: { Icon: TriangleAlert, tone: "bg-amber-500/15 text-amber-600 dark:text-amber-400" },
  optional: { Icon: Plus, tone: "bg-muted text-foreground" },
};

function CheckHelpBlock({ help }: { help: NonNullable<CheckView["help"]> }) {
  return (
    <details className="group border-t px-4 py-3 pl-13 text-xs text-muted-foreground">
      <summary className="cursor-pointer select-none text-foreground">{fr.welcome.showHelp}</summary>
      <div className="mt-2 grid gap-2">
        <p>{help.text}</p>
        <pre className="overflow-x-auto rounded-md border bg-background px-3 py-2 font-mono text-foreground">
          {help.commands.map((command) => (
            <code key={command} className="block">
              {command}
            </code>
          ))}
        </pre>
      </div>
    </details>
  );
}

function CheckRow({ check, action, onRetry }: RowProps) {
  const { Icon, tone } = DOT[check.state];
  const detailTone = check.state === "warn" ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground";
  return (
    <li className="grid">
      <div className="flex items-center gap-3 px-4 py-3">
        <span aria-hidden className={`grid size-6 shrink-0 place-items-center rounded-full ${tone}`}>
          <Icon className="size-3.5" strokeWidth={2.5} />
        </span>
        <div className="grid min-w-0 flex-1 gap-0.5">
          <span className="text-sm font-medium">{check.title}</span>
          <span className={`truncate text-xs ${detailTone}`}>{check.detail}</span>
        </div>
        {check.retry && (
          <Button size="sm" variant="outline" onClick={onRetry}>
            <RotateCw className="size-3.5" /> {fr.welcome.retry}
          </Button>
        )}
        {action}
      </div>
      {check.help && <CheckHelpBlock help={check.help} />}
    </li>
  );
}

type ChecksProps = { checks: CheckView[]; onRetry: () => void; onConnectGithub: () => void };

function EnvironmentChecks({ checks, onRetry, onConnectGithub }: ChecksProps) {
  return (
    <ul className="w-full divide-y rounded-xl border bg-card text-left">
      {checks.map((check) => (
        <CheckRow
          key={check.id}
          check={check}
          onRetry={onRetry}
          action={
            check.id === "github" && check.state !== "ok" ? (
              <Button size="sm" variant="outline" onClick={onConnectGithub}>
                {fr.welcome.githubConnect}
              </Button>
            ) : null
          }
        />
      ))}
    </ul>
  );
}

type EnvironmentQuery = { env: Environment | null; error: string | null; reload: () => void };

function useEnvironment(): EnvironmentQuery {
  const [env, setEnv] = useState<Environment | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let alive = true;
    void attempt;
    client.rpc({ method: "getEnvironment" }).then(
      (e) => {
        if (!alive) return;
        setEnv(e);
        setError(null);
      },
      (e: unknown) => alive && setError(e instanceof Error ? e.message : fr.common.error),
    );
    return () => {
      alive = false;
    };
  }, [attempt]);
  const reload = useCallback(() => setAttempt((n) => n + 1), []);
  return { env, error, reload };
}

function subtitleOf(checks: CheckView[], sandbox: SandboxStatus | null): string {
  if (agentsBlocked(checks)) return fr.welcome.failed;
  if (sandbox && sandboxStopped(sandbox)) return frSecurity.welcome.subtitle;
  return fr.welcome.subtitle;
}

type Props = {
  onCreate: () => void;
  onImport: () => void;
  onConnectGithub: () => void;
  onTutorial: () => void;
};

export function Welcome({ onCreate, onImport, onConnectGithub, onTutorial }: Props) {
  const { env, error, reload } = useEnvironment();
  const sandboxQuery = useRpcQuery({ method: "getSandboxStatus" }, ["sandbox.changed"]);
  const sandbox = sandboxQuery.data;
  const checks = env ? welcomeChecks(env, sandbox) : [];
  const retry = () => {
    reload();
    sandboxQuery.reload();
  };
  return (
    <main className="grid min-h-full place-items-center bg-background p-6">
      <div className="grid w-full max-w-2xl justify-items-center gap-6 text-center">
        <span className="grid size-14 place-items-center rounded-2xl border bg-card text-foreground">
          <WorkspaceMark className="size-7" />
        </span>
        <div className="grid gap-2">
          <h1 className="text-2xl font-semibold">{fr.welcome.title}</h1>
          <p className="text-sm text-muted-foreground">{subtitleOf(checks, sandbox)}</p>
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        {env && <EnvironmentChecks checks={checks} onRetry={retry} onConnectGithub={onConnectGithub} />}
        <div className="flex flex-wrap justify-center gap-3">
          <Button variant="secondary" onClick={onTutorial}>
            <GraduationCap className="size-4" /> {fr.welcome.tutorial}
          </Button>
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
