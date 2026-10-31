import type { T3Api } from "@kibo/sdk";
import { type T3Host, T3HostProvider } from "@kibo/sdk/t3";
import { type ReactNode, useMemo } from "react";
import { client } from "../api";
import { useOptionalHost } from "./Host";

const status = () => client.rpc({ method: "t3.status" });

const shellT3Api = (projectId: string): T3Api => ({
  status,
  preview: (ticketKey) => client.rpc({ method: "t3.preview", projectId, ticketKey }),
  launch: (ticketKey) => client.rpc({ method: "t3.launch", projectId, ticketKey }),
  threadOf: (ticketKey) => client.rpc({ method: "t3.threadOf", projectId, ticketKey }),
});

export function ShellT3Provider({ children }: { children: ReactNode }) {
  const shell = useOptionalHost();
  const host = useMemo<T3Host>(
    () => ({ api: shellT3Api, linkFolder: () => shell?.editProject?.({ field: "folder" }) }),
    [shell],
  );
  return <T3HostProvider host={host}>{children}</T3HostProvider>;
}
