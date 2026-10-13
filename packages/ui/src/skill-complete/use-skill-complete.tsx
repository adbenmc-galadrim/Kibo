import { type AgentRef, filterSkillSuggestions, type SkillSuggestion } from "@kibo/schema";
import {
  type ChangeEvent,
  type KeyboardEvent,
  type ReactNode,
  type SyntheticEvent,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { frSkillComplete as t } from "../i18n/fr-skill-complete";
import { optionId, SkillSuggestList } from "./SkillSuggestList";
import { insertSkill, skillTrigger } from "./skill-trigger";
import { useSkillSuggestions } from "./use-skill-suggestions";

type Field = HTMLInputElement | HTMLTextAreaElement;

export type SkillCompleteOptions = {
  agentRef: AgentRef | null;
  projectId: string | null;
  value: string;
  onValueChange(value: string): void;
  placement?: "above" | "below";
};

export type SkillComplete = {
  open: boolean;
  list: ReactNode;
  inputProps: {
    ref(el: Field | null): void;
    value: string;
    role: "combobox";
    "aria-autocomplete": "list";
    "aria-expanded": boolean;
    "aria-controls": string;
    "aria-activedescendant"?: string;
    onChange(e: ChangeEvent<Field>): void;
    onSelect(e: SyntheticEvent<Field>): void;
    onKeyDown(e: KeyboardEvent<Field>): void;
    onFocus(): void;
    onBlur(): void;
  };
};

const PICK_KEYS = new Set(["Enter", "Tab"]);
const plainKey = (e: KeyboardEvent<Field>) => !e.metaKey && !e.ctrlKey && !e.altKey && !e.shiftKey;

export function useSkillComplete(o: SkillCompleteOptions): SkillComplete {
  const listId = useId();
  const field = useRef<Field | null>(null);
  const pendingCaret = useRef<number | null>(null);
  const [caret, setCaret] = useState<number | null>(null);
  const [focused, setFocused] = useState(false);
  const [touched, setTouched] = useState(false);
  const [dismissed, setDismissed] = useState<number | null>(null);
  const [selection, setSelection] = useState<{ query: string | null; index: number }>({
    query: null,
    index: 0,
  });
  const suggestions = useSkillSuggestions(o.agentRef, o.projectId, touched);
  const trigger = caret === null ? null : skillTrigger(o.value, caret);
  const open = focused && trigger !== null && trigger.start !== dismissed && suggestions !== null;
  const items = open && suggestions ? filterSkillSuggestions(suggestions, trigger.query) : [];
  const query = trigger?.query ?? null;
  const active = selection.query === query ? selection.index : 0;
  const setActive = (index: number) => setSelection({ query, index });

  useEffect(() => {
    if (query !== null || dismissed === null) return;
    setDismissed(null);
  }, [query, dismissed]);
  useLayoutEffect(() => {
    const at = pendingCaret.current;
    if (at === null || !field.current) return;
    pendingCaret.current = null;
    field.current.setSelectionRange(at, at);
  });

  const pick = (skill: SkillSuggestion) => {
    if (!trigger) return;
    const next = insertSkill(o.value, trigger, skill.id);
    pendingCaret.current = next.caret;
    setCaret(next.caret);
    o.onValueChange(next.text);
  };

  const onKeyDown = (e: KeyboardEvent<Field>) => {
    if (!open || !trigger) return;
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      setDismissed(trigger.start);
      return;
    }
    if (items.length === 0) return;
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      const step = e.key === "ArrowDown" ? 1 : -1;
      setActive((active + step + items.length) % items.length);
      return;
    }
    const chosen = items[active];
    if (PICK_KEYS.has(e.key) && plainKey(e) && chosen) {
      e.preventDefault();
      pick(chosen);
    }
  };

  const empty = suggestions?.length === 0 ? t.noSkill : t.noMatch;
  return {
    open,
    list: open ? (
      <SkillSuggestList
        id={listId}
        items={items}
        active={active}
        empty={empty}
        placement={o.placement ?? "above"}
        onHover={setActive}
        onPick={pick}
      />
    ) : null,
    inputProps: {
      ref: (el) => {
        field.current = el;
      },
      value: o.value,
      role: "combobox",
      "aria-autocomplete": "list",
      "aria-expanded": open,
      "aria-controls": listId,
      ...(open && items.length > 0 && { "aria-activedescendant": optionId(listId, active) }),
      onChange: (e) => {
        setCaret(e.target.selectionStart);
        o.onValueChange(e.target.value);
      },
      onSelect: (e) => setCaret(e.currentTarget.selectionStart),
      onKeyDown,
      onFocus: () => {
        setFocused(true);
        setTouched(true);
      },
      onBlur: () => setFocused(false),
    },
  };
}

export function keepLayerOnSkillEscape(e: Pick<globalThis.KeyboardEvent, "target" | "preventDefault">): void {
  const target = e.target;
  if (target instanceof Element && target.matches('[role="combobox"][aria-expanded="true"]'))
    e.preventDefault();
}
