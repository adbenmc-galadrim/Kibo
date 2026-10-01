import { Button } from "@kibo/sdk/ui/button";
import { Input } from "@kibo/sdk/ui/input";
import { Check, ChevronDown, ChevronUp, Copy, Search, X } from "lucide-react";
import { type KeyboardEvent, useState } from "react";
import { frFileTools as t } from "../i18n/fr-file-tools";
import { isMac, shortcutLabel } from "../lib/shortcut-label";
import { type FindState, parseGoTo } from "./find-in-file";
import { WrapSwitch } from "./WrapSwitch";

type Props = {
  path: string;
  wrap: boolean;
  onWrap(on: boolean): void;
  find: FindState | null;
  onFind(query: string): void;
  onStep(delta: 1 | -1): void;
  onCloseFind(): void;
  searchable?: boolean;
};

type CopyState = "idle" | "copied" | "failed";

function counter(find: FindState): string | null {
  if (find.query === "" || parseGoTo(find.query) !== null) return null;
  return t.count(find.matches.length === 0 ? 0 : find.index + 1, find.matches.length);
}

function FindBar({
  find,
  onFind,
  onStep,
  onCloseFind,
}: Pick<Props, "onFind" | "onStep" | "onCloseFind"> & { find: FindState }) {
  const count = counter(find);
  const canStep = find.matches.length > 1;
  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      onStep(e.shiftKey ? -1 : 1);
    } else if (e.key === "Escape") {
      e.preventDefault();
      onCloseFind();
    }
  };
  return (
    <div className="flex min-w-0 items-center gap-1">
      <Input
        type="search"
        autoFocus
        aria-label={t.find}
        placeholder={t.find}
        value={find.query}
        onChange={(e) => onFind(e.target.value)}
        onKeyDown={onKeyDown}
        className="h-7 w-56 min-w-0 text-xs"
      />
      {count !== null && (
        <span className="min-w-12 px-1 text-center font-mono text-xs text-muted-foreground tabular-nums">
          {count}
        </span>
      )}
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label={t.previous}
        disabled={!canStep}
        onClick={() => onStep(-1)}
      >
        <ChevronUp />
      </Button>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label={t.next}
        disabled={!canStep}
        onClick={() => onStep(1)}
      >
        <ChevronDown />
      </Button>
      <Button variant="ghost" size="icon-sm" aria-label={t.closeFind} onClick={onCloseFind}>
        <X />
      </Button>
    </div>
  );
}

export function FileToolbar({ path, wrap, onWrap, find, searchable = true, ...p }: Props) {
  const [copy, setCopy] = useState<CopyState>("idle");
  const copyPath = () => {
    Promise.resolve()
      .then(() => navigator.clipboard.writeText(path))
      .then(
        () => setCopy("copied"),
        () => setCopy("failed"),
      );
  };
  return (
    <div className="flex min-h-10 shrink-0 flex-wrap items-center gap-2 border-b px-4 py-1.5">
      {find ? (
        <FindBar find={find} {...p} />
      ) : (
        searchable && (
          <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => p.onFind("")}>
            <Search />
            {t.openFind(shortcutLabel(["F"], isMac()))}
          </Button>
        )
      )}
      <div className="ml-auto flex items-center gap-3">
        {copy === "failed" && (
          <span role="alert" className="text-xs text-destructive">
            {t.copyFailed}
          </span>
        )}
        {copy === "copied" && <output className="sr-only">{t.copied}</output>}
        <Button
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-xs"
          aria-label={t.copyPath}
          onClick={copyPath}
        >
          {copy === "copied" ? <Check /> : <Copy />}
          {t.copyPath}
        </Button>
        <WrapSwitch wrap={wrap} onWrap={onWrap} className="text-xs" />
      </div>
    </div>
  );
}
