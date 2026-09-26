import { Badge } from "@kibo/sdk/ui/badge";
import { Button } from "@kibo/sdk/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@kibo/sdk/ui/dialog";
import { Label } from "@kibo/sdk/ui/label";
import { Textarea } from "@kibo/sdk/ui/textarea";
import { Bot, Copy, Sparkles, SquareTerminal } from "lucide-react";
import { useId, useState } from "react";
import { fr } from "../i18n/fr";

const COMMANDS = [
  "kibo component new burndown",
  "kibo component test burndown",
  "kibo component dev burndown",
];

function AiColumn() {
  const t = fr.createComponent;
  const describeId = useId();
  return (
    <section aria-disabled className="grid content-start gap-3 rounded-lg border p-4">
      <h3 className="flex items-center gap-2 font-semibold">
        <Sparkles aria-hidden className="size-4" />
        {t.ai}
        <Badge variant="secondary">{t.soon}</Badge>
      </h3>
      <Label htmlFor={describeId}>{t.aiLabel}</Label>
      <Textarea id={describeId} disabled placeholder={t.aiPlaceholder} />
      <p className="text-xs text-muted-foreground">{t.aiHelp}</p>
      <Button disabled className="w-fit bg-orange-600 text-white hover:bg-orange-600/90 dark:bg-orange-500">
        <Bot aria-hidden />
        {t.aiSubmit}
      </Button>
    </section>
  );
}

function CodeColumn() {
  const t = fr.createComponent;
  const [copied, setCopied] = useState(false);
  const [failed, setFailed] = useState(false);
  const copy = async () => {
    setFailed(false);
    try {
      await navigator.clipboard.writeText(COMMANDS.join("\n"));
      setCopied(true);
    } catch (e) {
      console.error(e);
      setFailed(true);
    }
  };
  return (
    <section className="grid content-start gap-3 rounded-lg border p-4">
      <h3 className="flex items-center gap-2 font-semibold">
        <SquareTerminal aria-hidden className="size-4" />
        {t.code}
      </h3>
      <p className="text-sm text-muted-foreground">{t.codeHelp}</p>
      <div className="relative rounded-md border bg-muted/40 p-3 pr-10 font-mono text-xs">
        {COMMANDS.map((c) => (
          <div key={c}>$ {c}</div>
        ))}
        <Button
          size="icon"
          variant="ghost"
          aria-label={t.copy}
          className="absolute top-1.5 right-1.5 size-7"
          onClick={() => void copy()}
        >
          <Copy aria-hidden />
        </Button>
      </div>
      {copied && <p className="text-xs text-muted-foreground">{t.copied}</p>}
      {failed && (
        <p role="alert" className="text-xs text-destructive">
          {fr.common.error}
        </p>
      )}
      <p className="text-sm text-muted-foreground">{t.codeFooter}</p>
    </section>
  );
}

export function CreateComponentDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const t = fr.createComponent;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{t.title}</DialogTitle>
          <DialogDescription>{t.subtitle}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          <AiColumn />
          <CodeColumn />
        </div>
        <ol className="flex flex-wrap gap-2">
          {t.steps.map((s, i) => (
            <li
              key={s}
              className={`rounded-md border px-2 py-1 text-xs ${i === 0 ? "bg-accent" : "text-muted-foreground"}`}
            >
              {s}
            </li>
          ))}
        </ol>
      </DialogContent>
    </Dialog>
  );
}
