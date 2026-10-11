import { useOptionalHost } from "../shell/Host";

export function useOpenSignal(): ((signalId: string) => void) | undefined {
  const open = useOptionalHost()?.openProjectAgent;
  return open ? () => open({ tab: "signals" }) : undefined;
}
