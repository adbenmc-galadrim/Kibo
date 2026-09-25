import { KiboError } from "@kibo/schema";
import { Button } from "@kibo/sdk/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@kibo/sdk/ui/card";
import { Input } from "@kibo/sdk/ui/input";
import { Label } from "@kibo/sdk/ui/label";
import { type FormEvent, useId, useState } from "react";
import { client } from "../api";
import { fr } from "../i18n/fr";
import { KiboLogo } from "./KiboLogo";

export function PairingScreen({ onPaired }: { onPaired: () => void }) {
  const tokenId = useId();
  const [token, setToken] = useState("");
  const [error, setError] = useState(false);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    try {
      await client.pair(token.trim());
      onPaired();
    } catch (err) {
      if (!(err instanceof KiboError)) throw err;
      setError(true);
    }
  };
  return (
    <main className="grid min-h-svh place-items-center bg-background p-6">
      <div className="grid w-full max-w-md justify-items-center gap-6">
        <KiboLogo className="size-14" />
        <Card className="w-full">
          <CardHeader className="text-center">
            <CardTitle className="text-lg">{fr.pairing.title}</CardTitle>
            <CardDescription>{fr.pairing.help}</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={submit} className="grid gap-3">
              <Label htmlFor={tokenId}>{fr.pairing.token}</Label>
              <Input
                id={tokenId}
                value={token}
                onChange={(e) => setToken(e.target.value)}
                className="font-mono"
                autoFocus
              />
              {error && <p className="text-sm text-destructive">{fr.pairing.invalid}</p>}
              <Button type="submit" disabled={!token.trim()}>
                {fr.pairing.submit}
              </Button>
            </form>
          </CardContent>
          <CardFooter>
            <p className="text-xs text-muted-foreground">{fr.pairing.security}</p>
          </CardFooter>
        </Card>
      </div>
    </main>
  );
}
