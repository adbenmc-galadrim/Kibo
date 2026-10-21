import { useOptionalHost } from "../shell/Host";

export function useOpenSignal(projectId: string | null): ((signalId: string) => void) | undefined {
  const host = useOptionalHost();
  const open = host?.openProjectAgent;
  return open && projectId !== null && host.projectId === projectId ? () => open() : undefined;
}
