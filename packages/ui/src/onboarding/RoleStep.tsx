import type { Role } from "@kibo/schema";
import { Badge } from "@kibo/sdk/ui/badge";
import { Button } from "@kibo/sdk/ui/button";
import { Label } from "@kibo/sdk/ui/label";
import { RadioGroup } from "@kibo/sdk/ui/radio-group";
import { Textarea } from "@kibo/sdk/ui/textarea";
import { ClipboardList, Code, Info, Palette, Sparkles } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { useAiAvailability } from "../ai/use-ai-availability";
import { ChoiceCard } from "../dialogs/ChoiceCard";
import { fr } from "../i18n/fr";
import { presetFor, ROLE_ORDER, type SelectedPage, toSelection } from "./presets";
import { StarterPagesList } from "./StarterPagesList";
import { type SuggestionState, useStarterSuggestion } from "./use-starter-suggestion";

const ICONS = { dev: Code, designer: Palette, pm: ClipboardList, other: Sparkles } as const;
const isRole = (v: string): v is Role => ROLE_ORDER.some((r) => r === v);

type Props = {
  available: ReadonlySet<string>;
  titles: Map<string, string>;
  selection: SelectedPage[];
  onSelection: (s: SelectedPage[]) => void;
  role?: Role;
  onRole?: (role: Role) => void;
};

export function RoleStep({ available, titles, selection, onSelection, ...controlled }: Props) {
  const id = useId();
  const [ownRole, setOwnRole] = useState<Role>(controlled.role ?? "dev");
  const role = controlled.role ?? ownRole;
  const [text, setText] = useState("");
  const { block } = useAiAvailability("assistant");
  const { state, suggest, cancel, reset } = useStarterSuggestion();
  const waiting = state.status === "waiting";
  const applied = useRef<SuggestionState>(state);

  useEffect(() => {
    if (applied.current === state) return;
    applied.current = state;
    if (state.status === "ready") onSelection(toSelection(state.plan));
    if (state.status === "unavailable") onSelection(toSelection(presetFor(role, available)));
  }, [state, role, available, onSelection]);

  const chooseRole = (value: string) => {
    if (!isRole(value)) return;
    setOwnRole(value);
    controlled.onRole?.(value);
    reset();
    onSelection(toSelection(presetFor(value, available)));
  };

  return (
    <div className="grid gap-4">
      <fieldset className="grid gap-2">
        <legend className="mb-2 text-sm font-medium">{fr.onboarding.role}</legend>
        <RadioGroup value={role} onValueChange={chooseRole} className="grid gap-2 sm:grid-cols-2">
          {ROLE_ORDER.map((r) => (
            <ChoiceCard
              key={r}
              value={r}
              icon={ICONS[r]}
              title={fr.onboarding.roles[r]}
              description={fr.onboarding.roleHelp[r]}
            />
          ))}
        </RadioGroup>
      </fieldset>
      {role === "other" && (
        <div className="grid gap-2">
          <div className="flex items-center justify-between">
            <Label htmlFor={`${id}-usage`}>{fr.onboarding.usage}</Label>
            <span className="text-xs text-muted-foreground">{fr.onboarding.optional}</span>
          </div>
          <Textarea
            id={`${id}-usage`}
            rows={2}
            maxLength={500}
            placeholder={fr.onboarding.usagePlaceholder}
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
          {text.trim().length > 0 &&
            (block ? (
              <p className="text-xs text-amber-600 dark:text-amber-400">{fr.ai.blocked[block]}</p>
            ) : (
              <div className="flex flex-wrap items-center gap-3">
                <Button
                  type="button"
                  variant="agent"
                  size="sm"
                  disabled={waiting}
                  onClick={() => suggest(role, text.trim())}
                >
                  <Sparkles aria-hidden /> {waiting ? fr.onboarding.suggesting : fr.onboarding.suggest}
                </Button>
                {waiting && state.queued && (
                  <span className="text-xs text-muted-foreground">{fr.onboarding.queued}</span>
                )}
                {waiting && (
                  <Button type="button" variant="ghost" size="sm" onClick={cancel}>
                    {fr.onboarding.cancelSuggestion}
                  </Button>
                )}
              </div>
            ))}
        </div>
      )}
      <div className="grid gap-2">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-medium">{fr.onboarding.pages}</h3>
          {state.status === "ready" && (
            <Badge variant="outline" className="border-brand/40 text-brand">
              <Sparkles aria-hidden /> {fr.onboarding.suggested}
            </Badge>
          )}
        </div>
        {state.status === "unavailable" && (
          <p className="flex items-center gap-2 rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">
            <Info aria-hidden className="size-3.5" /> {fr.onboarding.unavailable}
          </p>
        )}
        <StarterPagesList selection={selection} titles={titles} onChange={onSelection} />
        <p className="text-xs text-muted-foreground">{fr.onboarding.pagesHelp}</p>
      </div>
    </div>
  );
}
