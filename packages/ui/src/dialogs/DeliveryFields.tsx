import {
  type AgentRef,
  type AgentSummary,
  type DeliveryPublication,
  FULL_DELIVERY_AGENT,
  type ProjectDelivery,
} from "@kibo/schema";
import { Input } from "@kibo/sdk/ui/input";
import { Label } from "@kibo/sdk/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@kibo/sdk/ui/select";
import { useId, useState } from "react";
import { AllowRulesField } from "../agents/AllowRulesField";
import { assignableAgents } from "../agents/assignable";
import { AddDirsField } from "../agents/sheet/AddDirsField";
import { frDeliverySettings } from "../i18n/fr-delivery-settings";
import {
  choicesOf,
  type DeliveryChoices,
  type DeliveryDraft,
  deliveryDraftOf,
  deliveryOf,
  hasGlobalDeliveryAgent,
  type PathField,
} from "./delivery-draft";

type Props = {
  value: ProjectDelivery | null;
  home: string;
  agents: readonly AgentSummary[];
  disabled: boolean;
  onChange(next: ProjectDelivery | null): void;
  onProblem(problem: string | null): void;
};
type Problems = { fields: string | null; allow: string | null; dirs: string | null };

const t = frDeliverySettings.section;
const DEFAULT = "default";
const NONE = "none";
const PUBLICATIONS: readonly DeliveryPublication[] = ["draft", "local"];
const PAIRS: readonly [PathField, PathField][] = [
  ["root", "profile"],
  ["memory", "briefs"],
  ["reports", "todo"],
];
const MONO = "font-mono text-xs md:text-xs";

const publicationOf = (v: string): DeliveryPublication | null => PUBLICATIONS.find((p) => p === v) ?? null;

function agentChoices(agents: readonly AgentSummary[], chosen: AgentRef | null): AgentSummary[] {
  const list = assignableAgents([...agents], false);
  const missing = agents.find((a) => a.ref === chosen && !list.includes(a));
  return missing ? [...list, missing] : list;
}

export function DeliveryFields({ value, home, agents, disabled, onChange, onProblem }: Props) {
  const id = useId();
  const [draft, setDraft] = useState(() => deliveryDraftOf(value, home));
  const [choices, setChoices] = useState(() => choicesOf(value));
  const [problems, setProblems] = useState<Problems>({ fields: null, allow: null, dirs: null });
  const update = (next: {
    draft?: DeliveryDraft;
    choices?: DeliveryChoices;
    problems?: Partial<Problems>;
  }) => {
    const nextDraft = next.draft ?? draft;
    const nextChoices = next.choices ?? choices;
    const result = deliveryOf(nextDraft, nextChoices, home);
    const nextProblems = { ...problems, ...next.problems, fields: result.problem };
    setDraft(nextDraft);
    setChoices(nextChoices);
    setProblems(nextProblems);
    onProblem(nextProblems.fields ?? nextProblems.allow ?? nextProblems.dirs);
    if (result.problem === null) onChange(result.value);
  };
  const report = (partial: Partial<Problems>) => {
    const next = { ...problems, ...partial };
    setProblems(next);
    onProblem(next.fields ?? next.allow ?? next.dirs);
  };
  const text = (field: keyof DeliveryDraft, label: string) => (
    <div className="grid content-start gap-1.5">
      <Label htmlFor={`${id}-${field}`} className="text-xs">
        {label}
      </Label>
      <Input
        id={`${id}-${field}`}
        value={draft[field]}
        disabled={disabled}
        spellCheck={false}
        className={MONO}
        onChange={(e) => update({ draft: { ...draft, [field]: e.target.value } })}
      />
    </div>
  );
  const global = hasGlobalDeliveryAgent(agents);
  return (
    <>
      <div className="grid gap-1.5">
        <Label htmlFor={`${id}-agent`} className="text-xs">
          {t.agent}
        </Label>
        <Select
          value={choices.agent ?? DEFAULT}
          disabled={disabled}
          onValueChange={(v) => update({ choices: { ...choices, agent: v === DEFAULT ? null : v } })}
        >
          <SelectTrigger id={`${id}-agent`} className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={DEFAULT}>{global ? t.byDefault(FULL_DELIVERY_AGENT) : t.none}</SelectItem>
            {agentChoices(agents, choices.agent).map((a) => (
              <SelectItem key={a.ref} value={a.ref}>
                {a.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {PAIRS.map(([left, right]) => (
        <div key={left} className="grid gap-3 sm:grid-cols-2">
          {text(left, t[left])}
          {text(right, t[right])}
        </div>
      ))}
      <div className="grid gap-3 sm:grid-cols-2">
        {text("idPattern", t.idPattern)}
        <div className="grid content-start gap-1.5">
          <Label htmlFor={`${id}-publication`} className="text-xs">
            {t.publication}
          </Label>
          <Select
            value={choices.publication ?? NONE}
            disabled={disabled}
            onValueChange={(v) => update({ choices: { ...choices, publication: publicationOf(v) } })}
          >
            <SelectTrigger id={`${id}-publication`} className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>{t.publications.none}</SelectItem>
              {PUBLICATIONS.map((p) => (
                <SelectItem key={p} value={p}>
                  {t.publications[p]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      {problems.fields !== null && <p className="text-xs text-destructive">{problems.fields}</p>}
      <AllowRulesField
        value={choices.allow}
        disabled={disabled}
        label={t.allow}
        help={t.allowHelp}
        onProblem={(allow) => report({ allow })}
        onChange={(allow) => update({ choices: { ...choices, allow }, problems: { allow: null } })}
      />
      <AddDirsField
        value={choices.addDirs}
        home={home}
        disabled={disabled}
        onProblem={(dirs) => report({ dirs })}
        onChange={(addDirs) => update({ choices: { ...choices, addDirs }, problems: { dirs: null } })}
      />
    </>
  );
}
