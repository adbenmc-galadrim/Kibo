import { KiboError } from "@kibo/schema";
import { Button } from "@kibo/sdk/ui/button";
import { frStartup } from "../i18n/fr-startup";
import { errorMessage } from "../lib/error-message";
import { KiboLogo } from "./KiboLogo";

type Props = { error: unknown; inApp: boolean; nextRetryInMs: number; onRetry(): void };

const t = frStartup.unreachable;

export function DaemonUnreachable({ error, inApp, nextRetryInMs, onRetry }: Props) {
  const fromDaemon = error instanceof KiboError;
  return (
    <main className="grid min-h-svh place-items-center bg-background p-6">
      <div className="grid w-full max-w-md justify-items-center gap-4 text-center">
        <KiboLogo className="size-14" />
        <h1 className="text-lg font-semibold">{fromDaemon ? t.failed : t.title}</h1>
        {fromDaemon ? (
          <p className="text-sm text-muted-foreground">{errorMessage(error)}</p>
        ) : (
          <div className="grid gap-1 text-sm">
            <p className="text-muted-foreground">{t.explain}</p>
            <p>{inApp ? t.inApp : t.inBrowser}</p>
          </div>
        )}
        <Button onClick={onRetry}>{t.retry}</Button>
        {nextRetryInMs > 0 && (
          <p className="text-xs text-muted-foreground">{t.nextRetry(Math.ceil(nextRetryInMs / 1000))}</p>
        )}
      </div>
    </main>
  );
}
