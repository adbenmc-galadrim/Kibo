import { KiboError } from "@kibo/schema";
import { Button } from "@kibo/sdk/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@kibo/sdk/ui/card";
import { SquareTerminal } from "lucide-react";
import { useState } from "react";
import { client } from "../api";
import { fr } from "../i18n/fr";
import { abbreviateHome } from "../lib/home-path";

export function CliInstallCard() {
  const c = fr.cli;
  const [path, setPath] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const install = async () => {
    setFailed(false);
    try {
      setPath((await client.rpc({ method: "installCli" })).path);
    } catch (e) {
      if (!(e instanceof KiboError)) console.error(e);
      setFailed(true);
    }
  };
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <SquareTerminal aria-hidden className="size-4" />
          {c.title}
        </CardTitle>
        <CardDescription>{c.help}</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-2">
        <Button variant="outline" className="w-fit" onClick={() => void install()}>
          {c.install}
        </Button>
        {path && (
          <p className="font-mono text-xs text-muted-foreground">{c.installed(abbreviateHome(path))}</p>
        )}
        {failed && (
          <p role="alert" className="text-sm text-destructive">
            {c.failed}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
