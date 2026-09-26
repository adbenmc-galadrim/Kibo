import { createContext, type ReactNode, useCallback, useContext, useEffect, useState } from "react";

type Report = (approving: boolean) => void;
export type ApprovalScopeState = { hidden: boolean; report: Report };

const ApprovalContext = createContext<Report>(() => {});

export function useApprovalScope(): ApprovalScopeState {
  const parent = useContext(ApprovalContext);
  const [hidden, setHidden] = useState(false);
  const report = useCallback(
    (approving: boolean) => {
      setHidden(approving);
      parent(approving);
    },
    [parent],
  );
  return { hidden, report };
}

export function ApprovalScope({ scope, children }: { scope: ApprovalScopeState; children: ReactNode }) {
  return <ApprovalContext.Provider value={scope.report}>{children}</ApprovalContext.Provider>;
}

export function useReportApproval(approving: boolean): void {
  const report = useContext(ApprovalContext);
  useEffect(() => {
    if (!approving) return;
    report(true);
    return () => report(false);
  }, [approving, report]);
}
