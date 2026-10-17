import type { Role } from "@kibo/schema";
import { Alert, AlertTitle } from "@kibo/sdk/ui/alert";
import { Badge } from "@kibo/sdk/ui/badge";
import { Button } from "@kibo/sdk/ui/button";
import { Label } from "@kibo/sdk/ui/label";
import { RadioGroup } from "@kibo/sdk/ui/radio-group";
import { Textarea } from "@kibo/sdk/ui/textarea";
import { ClipboardList, Code, Info, Palette, Sparkles } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { useAiAvailability } from "../ai/use-ai-availability";
import { ChoiceCard } from "../dialogs/ChoiceCard";
import { frAi } from "../i18n/fr-ai";
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
        <legend className="mb-2 text-sm font-medium">{frAi.onboarding.role}</legend>
        <RadioGroup value={role} onValueChange={chooseRole} className="grid gap-2 sm:grid-cols-2">
          {ROLE_ORDER.map((r) => (
            <ChoiceCard
              key={r}
              value={r}
              icon={ICONS[r]}
              title={frAi.onboarding.roles[r]}
              description={frAi.onboarding.roleHelp[r]}
            />
          ))}
        </RadioGroup>
      </fieldset>
      {role === "other" && (
        <div className="grid gap-2">
          <div className="flex items-center justify-between">
            <Label htmlFor={`${id}-usage`}>{frAi.onboarding.usage}</Label>
            <span className="text-xs text-muted-foreground">{frAi.onboarding.optional}</span>
          </div>
          <Textarea
            id={`${id}-usage`}
            rows={2}
            maxLength={500}
            placeholder={frAi.onboarding.usagePlaceholder}
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
          {text.trim().length > 0 && (
            <div className="flex flex-wrap items-center gap-3">
              <Button
                type="button"
                variant="agent"
                size="sm"
                disabled={waiting || block !== null}
                onClick={() => suggest(role, text.trim())}
              >
                <Sparkles aria-hidden /> {waiting ? frAi.onboarding.suggesting : frAi.onboarding.suggest}
              </Button>
              {!waiting && (
                <span className="text-xs text-muted-foreground">
                  {block ? frAi.ai.blocked[block] : frAi.onboarding.viaSubscription}
                </span>
              )}
              {waiting && state.queued && (
                <span className="text-xs text-muted-foreground">{frAi.onboarding.queued}</span>
              )}
              {waiting && (
                <Button type="button" variant="ghost" size="sm" onClick={cancel}>
                  {frAi.onboarding.cancelSuggestion}
                </Button>
              )}
            </div>
          )}
        </div>
      )}
      {state.status === "unavailable" && (
        <Alert className="bg-muted/40">
          <Info aria-hidden />
          <AlertTitle>{frAi.onboarding.unavailable}</AlertTitle>
        </Alert>
      )}
      <div className="grid gap-2">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-medium">{frAi.onboarding.pages}</h3>
          {state.status === "ready" && (
            <Badge variant="outline" className="border-brand/40 text-brand">
              <Sparkles aria-hidden /> {frAi.onboarding.suggested}
            </Badge>
          )}
        </div>
        <StarterPagesList selection={selection} titles={titles} onChange={onSelection} />
        <p className="text-xs text-muted-foreground">{frAi.onboarding.pagesHelp}</p>
      </div>
    </div>
  );
}
