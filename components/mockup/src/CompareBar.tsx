import { Button } from "@kibo/sdk/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@kibo/sdk/ui/dropdown-menu";
import { ToggleGroup, ToggleGroupItem } from "@kibo/sdk/ui/toggle-group";
import { ArrowLeftRight, ChevronDown, X } from "lucide-react";
import type { CompareAction, CompareMode, CompareState } from "./compare";
import { fr } from "./fr";

export type ReferenceOption = { index: number; label: string };
type Props = {
  state: CompareState;
  references: readonly ReferenceOption[];
  dispatch(a: CompareAction): void;
};

const isMode = (value: string): value is CompareMode => value === "side" || value === "overlay";

function ReferenceMenu({ state, references, dispatch }: Props) {
  const current = references.find((r) => r.index === state.reference);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="xs" className="max-w-48 gap-1">
          <span className="truncate">{fr.compare.reference(current?.label ?? "")}</span>
          <ChevronDown aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="max-h-80 overflow-y-auto">
        <DropdownMenuRadioGroup
          value={String(state.reference)}
          onValueChange={(v) => dispatch({ kind: "reference", index: Number(v) })}
        >
          {references.map((r) => (
            <DropdownMenuRadioItem key={r.index} value={String(r.index)} className="text-xs">
              {r.label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function Range({
  label,
  text,
  value,
  onChange,
}: {
  label: string;
  text: string;
  value: number;
  onChange(v: number): void;
}) {
  return (
    <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
      <input
        type="range"
        min={0}
        max={100}
        step={1}
        value={value}
        aria-label={label}
        className="w-20 accent-foreground"
        onChange={(e) => onChange(e.currentTarget.valueAsNumber)}
      />
      <span aria-hidden className="min-w-20 tabular-nums">
        {text}
      </span>
    </span>
  );
}

export function CompareBar({ state, references, dispatch }: Props) {
  const top = fr.compare.top(state.swapped);
  return (
    <fieldset
      aria-label={fr.compare.bar}
      className="m-0 flex min-w-0 flex-wrap items-center gap-2 border-0 px-3 pb-1"
    >
      <ReferenceMenu state={state} references={references} dispatch={dispatch} />
      <ToggleGroup
        type="single"
        variant="outline"
        size="sm"
        aria-label={fr.compare.mode}
        value={state.mode}
        onValueChange={(v) => {
          if (isMode(v)) dispatch({ kind: "mode", mode: v });
        }}
      >
        <ToggleGroupItem value="side" className="px-2.5 text-xs">
          {fr.compare.side}
        </ToggleGroupItem>
        <ToggleGroupItem value="overlay" className="px-2.5 text-xs">
          {fr.compare.overlay}
        </ToggleGroupItem>
      </ToggleGroup>
      {state.mode === "overlay" && (
        <>
          <Range
            label={top}
            text={fr.compare.opacity(top, state.opacity)}
            value={state.opacity}
            onChange={(value) => dispatch({ kind: "opacity", value })}
          />
          <Range
            label={fr.compare.wipe}
            text={fr.compare.wipeValue(state.wipe)}
            value={state.wipe}
            onChange={(value) => dispatch({ kind: "wipe", value })}
          />
        </>
      )}
      <Button variant="ghost" size="xs" onClick={() => dispatch({ kind: "swap" })}>
        <ArrowLeftRight aria-hidden />
        {fr.compare.swap}
      </Button>
      <Button
        variant="ghost"
        size="icon-xs"
        aria-label={fr.compare.close}
        title={fr.compare.close}
        className="ml-auto"
        onClick={() => dispatch({ kind: "reset" })}
      >
        <X />
      </Button>
    </fieldset>
  );
}
