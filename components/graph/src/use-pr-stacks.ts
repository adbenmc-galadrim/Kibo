import { useEntities } from "@kibo/sdk";
import { useMemo } from "react";
import { type PrStacksModel, prStacks } from "./pr-stacks";

export function usePrStacks(): { model: PrStacksModel; loading: boolean; failed: boolean } {
  const tickets = useEntities("ticket");
  const model = useMemo(() => prStacks({ tickets: tickets.data }), [tickets.data]);
  return { model, loading: tickets.loading, failed: tickets.error !== null };
}
