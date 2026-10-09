import { ShieldOff } from "lucide-react";
import { frSecurity } from "../i18n/fr-security";
import { sandboxProblem, sandboxStopped } from "../lib/sandbox-problem";
import { useRpcQuery } from "../state/use-rpc-query";

const t = frSecurity.isolation;

export function SandboxBanner() {
  const { data } = useRpcQuery({ method: "getSandboxStatus" }, ["sandbox.changed"]);
  if (!data || !sandboxStopped(data)) return null;
  return (
    <output className="flex gap-3 rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm">
      <ShieldOff aria-hidden className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400" />
      <div className="grid min-w-0 flex-1 gap-1.5">
        <p className="font-medium text-amber-700 dark:text-amber-400">{t.banner}</p>
        <p className="text-xs text-muted-foreground">{t.bannerDetail(sandboxProblem(data))}</p>
        {data.fix && (
          <pre className="overflow-x-auto rounded-md border bg-background px-3 py-2 font-mono text-xs">
            <code>{data.fix}</code>
          </pre>
        )}
      </div>
    </output>
  );
}
