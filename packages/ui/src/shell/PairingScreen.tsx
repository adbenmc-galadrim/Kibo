import { KiboError } from "@kibo/schema";
import { Button } from "@kibo/sdk/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@kibo/sdk/ui/card";
import { Input } from "@kibo/sdk/ui/input";
import { type ClipboardEvent, type FormEvent, type KeyboardEvent, useId, useRef, useState } from "react";
import { client } from "../api";
import { fr } from "../i18n/fr";
import { KiboLogo } from "./KiboLogo";

const ALLOWED = /[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]/;
const SLOTS = [0, 1, 2, 3, 4, 5] as const;
const LAST = SLOTS.length - 1;
const EMPTY = SLOTS.map(() => "");

const clean = (text: string) =>
  text
    .toUpperCase()
    .split("")
    .filter((c) => ALLOWED.test(c));

function refusal(e: KiboError): string {
  return e.code === "RATE_LIMITED" ? fr.pairing.rateLimited : fr.pairing.invalid;
}

export function PairingScreen({ onPaired }: { onPaired: () => void }) {
  const groupId = useId();
  const [chars, setChars] = useState<string[]>(EMPTY);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const refs = useRef<(HTMLInputElement | null)[]>([]);

  const fill = (from: number, typed: string[]) => {
    const next = [...chars];
    let i = from;
    for (const c of typed) {
      if (i > LAST) break;
      next[i] = c;
      i += 1;
    }
    setChars(next);
    setError(null);
    refs.current[Math.min(i, LAST)]?.focus();
  };
  const onKeyDown = (i: number) => (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== "Backspace" || chars[i]) return;
    e.preventDefault();
    const next = [...chars];
    if (i > 0) next[i - 1] = "";
    setChars(next);
    refs.current[Math.max(0, i - 1)]?.focus();
  };
  const onPaste = (i: number) => (e: ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    fill(i, clean(e.clipboardData.getData("text")));
  };
  const code = chars.join("");
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await client.pairWithCode(code);
      onPaired();
    } catch (err) {
      if (!(err instanceof KiboError)) throw err;
      setError(refusal(err));
    } finally {
      setBusy(false);
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
            <form onSubmit={submit} className="grid justify-items-center gap-4">
              <fieldset aria-labelledby={groupId} className="flex items-center gap-2">
                <legend id={groupId} className="sr-only">
                  {fr.pairing.code}
                </legend>
                {SLOTS.map((i) => (
                  <span key={i} className="flex items-center gap-2">
                    {i === 3 && (
                      <span aria-hidden className="text-muted-foreground">
                        –
                      </span>
                    )}
                    <Input
                      ref={(el) => {
                        refs.current[i] = el;
                      }}
                      aria-label={fr.pairing.digit(i + 1)}
                      value={chars[i]}
                      onChange={(e) => fill(i, clean(e.target.value).slice(-1))}
                      onKeyDown={onKeyDown(i)}
                      onPaste={onPaste(i)}
                      inputMode="text"
                      autoComplete="one-time-code"
                      autoCapitalize="characters"
                      spellCheck={false}
                      autoFocus={i === 0}
                      className="size-11 px-0 text-center font-mono text-lg uppercase"
                    />
                  </span>
                ))}
              </fieldset>
              <p className="text-xs text-muted-foreground">{fr.pairing.validity}</p>
              {error && (
                <p role="alert" className="text-sm text-destructive">
                  {error}
                </p>
              )}
              <Button type="submit" className="w-full" disabled={code.length !== SLOTS.length || busy}>
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
