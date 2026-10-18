import { Button } from "@kibo/sdk/ui/button";
import { SearchX } from "lucide-react";
import { frShell } from "../i18n/fr-shell";

type Props = { what: "project" | "ticket"; onHome(): void };

const t = frShell.notFound;

export function NotFound({ what, onHome }: Props) {
  return (
    <main className="grid h-full place-items-center p-6">
      <div className="grid max-w-sm justify-items-center gap-3 text-center">
        <SearchX aria-hidden className="size-8 text-muted-foreground" />
        <h1 className="text-lg font-semibold">{t.title}</h1>
        <p className="text-sm text-muted-foreground">{t[what]}</p>
        <Button variant="outline" onClick={onHome}>
          {t.home}
        </Button>
      </div>
    </main>
  );
}
