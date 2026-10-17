import type { ReactNode } from "react";
import { useExecutionShown } from "../../state/use-app-settings";

export function ExecutionGate({ children }: { children: ReactNode }) {
  return useExecutionShown() ? children : null;
}
