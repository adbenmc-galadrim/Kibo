import type { ReactNode } from "react";
import { useExecutionShown } from "../../state/use-app-settings";

export function ExecutionGate({ children, fallback = null }: { children: ReactNode; fallback?: ReactNode }) {
  return useExecutionShown() ? children : fallback;
}
