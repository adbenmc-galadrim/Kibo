import { cn } from "@kibo/sdk/lib/utils";
import { Button } from "@kibo/sdk/ui/button";
import { Input } from "@kibo/sdk/ui/input";
import { CircleAlert, CircleCheck } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { frAppearance as t } from "../i18n/fr-appearance";
import { isHex } from "./color-math";
import { fixIssues, type PaletteIssue, paletteIssues } from "./palette-issues";
import { ROLE_GROUPS, type Role } from "./palette-roles";
import { editRole, editRoles } from "./palette-state";
import { usePalette } from "./use-palette";

const formatRatio = (ratio: number): string => ratio.toFixed(2).replace(".", ",");

function ColorRow({
  role,
  selected,
  onSelect,
}: {
  role: Role;
  selected: boolean;
  onSelect: (r: Role) => void;
}) {
  const { active, palette, scheme, commit } = usePalette();
  const value = active.roles[role];
  const [text, setText] = useState(value);
  const input = useRef<HTMLInputElement>(null);
  const label = t.roles[role];
  useEffect(() => setText(value), [value]);
  useEffect(() => {
    if (selected) input.current?.scrollIntoView?.({ block: "nearest" });
  }, [selected]);
  const change = (next: string) => {
    setText(next);
    if (isHex(next)) commit(editRole(palette, scheme, role, next.toUpperCase()));
  };
  return (
    <div
      data-selected={selected ? "true" : undefined}
      className={cn("flex items-center gap-2 rounded-md p-1", selected && "bg-muted")}
    >
      <input
        ref={input}
        type="color"
        aria-label={t.pickColor(label)}
        value={value.toLowerCase()}
        onFocus={() => onSelect(role)}
        onChange={(e) => change(e.target.value)}
        className="size-7 shrink-0 cursor-pointer rounded-md border border-input bg-transparent p-0.5"
      />
      <span className="min-w-0 flex-1 text-xs leading-tight">{label}</span>
      <Input
        aria-label={t.hexOf(label)}
        aria-invalid={!isHex(text)}
        value={text}
        spellCheck={false}
        onFocus={() => onSelect(role)}
        onChange={(e) => change(e.target.value)}
        className="h-7 w-[82px] shrink-0 px-2 font-mono text-xs"
      />
    </div>
  );
}

const issueText = (issue: PaletteIssue): string =>
  t.issue(
    t.roles[issue.role],
    issue.on === "soft" ? t.softSurface : t.roles[issue.on],
    formatRatio(issue.ratio),
    String(issue.min).replace(".", ","),
  );

function ReadabilityNotice() {
  const { active, palette, scheme, commit } = usePalette();
  const issues = paletteIssues(active.roles);
  if (issues.length === 0)
    return (
      <p className="flex items-center gap-2 rounded-md bg-muted p-2 text-xs">
        <CircleCheck className="size-3.5 shrink-0" aria-hidden />
        {t.readable}
      </p>
    );
  return (
    <div className="flex items-start gap-2 rounded-md bg-muted p-2 text-xs">
      <CircleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden />
      <ul className="flex-1 space-y-0.5">
        {issues.map((issue) => (
          <li key={issue.role}>{issueText(issue)}</li>
        ))}
      </ul>
      <Button
        size="sm"
        variant="outline"
        onClick={() => commit(editRoles(palette, scheme, fixIssues(active.roles)))}
      >
        {t.fix}
      </Button>
    </div>
  );
}

export function ColorEditor({ selected, onSelect }: { selected: Role | null; onSelect: (r: Role) => void }) {
  return (
    <div className="flex flex-col gap-3">
      {ROLE_GROUPS.map((group) => (
        <section key={group.id} aria-label={t.groups[group.id]} className="flex flex-col gap-1">
          <h3 className="text-xs font-semibold">{t.groups[group.id]}</h3>
          <div className="grid grid-cols-1 gap-x-3 xl:grid-cols-2">
            {group.roles.map((role) => (
              <ColorRow key={role} role={role} selected={selected === role} onSelect={onSelect} />
            ))}
          </div>
        </section>
      ))}
      <ReadabilityNotice />
    </div>
  );
}
