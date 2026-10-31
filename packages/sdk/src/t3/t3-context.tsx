import { createContext, type ReactNode, useContext, useMemo } from "react";
import { useOptionalSdk } from "../react";
import type { T3Api } from "../types";

export type T3Host = { api(projectId: string): T3Api; linkFolder(): void };
export type T3Access = { api: T3Api; linkFolder(): void };

const T3HostContext = createContext<T3Host | null>(null);

export function T3HostProvider({ host, children }: { host: T3Host; children: ReactNode }) {
  return <T3HostContext.Provider value={host}>{children}</T3HostContext.Provider>;
}

export function useT3(projectId: string): T3Access {
  const host = useContext(T3HostContext);
  const sdk = useOptionalSdk();
  return useMemo(() => {
    if (host) return { api: host.api(projectId), linkFolder: host.linkFolder };
    if (sdk) return { api: sdk.t3, linkFolder: () => sdk.project.edit({ field: "folder" }) };
    throw new Error("useT3 needs a T3HostProvider or an SdkProvider");
  }, [host, sdk, projectId]);
}
