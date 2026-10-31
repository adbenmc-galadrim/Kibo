import type { Question } from "@kibo/schema";
import { useSpotlight } from "@kibo/sdk";
import { useEffect, useRef } from "react";
import { filterQuestions, type Scope, scopeFor } from "./questions-logic";

type Filters = { scope: Scope; ticketId: string | null; recipient: string | null };

export function useSpotlightFilters(
  questions: readonly Question[],
  filters: Filters,
  open: (filters: Filters) => void,
): void {
  const target = useSpotlight();
  const handled = useRef(new Set<string>());
  const latest = useRef({ filters, open });
  latest.current = { filters, open };
  useEffect(() => {
    if (target?.kind !== "question" || handled.current.has(target.id)) return;
    const q = questions.find((x) => x.id === target.id);
    if (q === undefined) return;
    handled.current.add(target.id);
    const { filters: shown, open: show } = latest.current;
    if (filterQuestions([q], shown.scope, shown.ticketId, shown.recipient).length > 0) return;
    show({ scope: scopeFor(q), ticketId: null, recipient: null });
  }, [target, questions]);
}
