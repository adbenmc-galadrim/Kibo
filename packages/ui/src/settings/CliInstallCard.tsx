import { KiboError } from "@kibo/schema";
import { Alert, AlertDescription, AlertTitle } from "@kibo/sdk/ui/alert";
import { Button } from "@kibo/sdk/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@kibo/sdk/ui/card";
import { CircleX, Terminal } from "lucide-react";
import { useEffect, useState } from "react";
import { client } from "../api";
import { fr } from "../i18n/fr";
import { abbreviateHome } from "../lib/home-path";

type Status = { path: string; installed: boolean };

function causeOf(e: unknown): string {
  const causes = fr.cli.cause;
  if (!(e instanceof KiboError)) {
    console.error(e);
    return causes.other;
  }
  if (e.code === "PERMISSION_DENIED" || e.code === "CONFLICT" || e.code === "INVALID_INPUT")
    return causes[e.code];
  return causes.other;
}

function StatusLine({ status }: { status: Status | null }) {
  if (!status) return null;
  if (!status.installed) return <span className="text-sm text-muted-foreground">{fr.cli.notInstalled}</span>;
  return (
    <span className="flex items-center gap-2 text-sm text-muted-foreground">
      <span aria-hidden className="size-1.5 rounded-full bg-emerald-500" />
      {fr.cli.installed(abbreviateHome(status.path))}
    </span>
  );
}

export function CliInstallCard() {
  const c = fr.cli;
  const [status, setStatus] = useState<Status | null>(null);
  const [cause, setCause] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    client.rpc({ method: "cliStatus" }).then(
      (s) => {
        if (live) setStatus(s);
      },
      (e: unknown) => console.error(e),
    );
    return () => {
      live = false;
    };
  }, []);
  const install = async () => {
    setCause(null);
    try {
      const { path } = await client.rpc({ method: "installCli" });
      setStatus({ path, installed: true });
    } catch (e) {
      setCause(causeOf(e));
    }
  };
  return (
    <Card className="gap-4">
      <CardHeader>
        <CardTitle>{c.title}</CardTitle>
        <CardDescription>{c.help}</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="outline" size="sm" onClick={() => void install()}>
            <Terminal aria-hidden />
            {c.install}
          </Button>
          <StatusLine status={status} />
        </div>
        {cause && (
          <Alert variant="destructive" className="border-destructive/50 bg-destructive/10">
            <CircleX aria-hidden />
            <AlertTitle>{c.failed}</AlertTitle>
            <AlertDescription className="text-foreground/80!">{cause}</AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}
