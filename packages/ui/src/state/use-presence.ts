import type { PresencePeer } from "@kibo/schema";
import { useEffect, useState } from "react";
import { client } from "../api";

export function usePresencePeers(projectId: string | null): PresencePeer[] {
  const [peers, setPeers] = useState<PresencePeer[]>([]);
  useEffect(() => {
    setPeers([]);
    if (!projectId) return;
    let alive = true;
    const load = () =>
      client.rpc({ method: "getPresence", projectId }).then(
        (p) => alive && setPeers(p),
        (e: unknown) => console.error(`[kibo-ui] cannot read presence of ${projectId}`, e),
      );
    void load();
    const off = client.subscribeEvents((m) => {
      if (m.type === "presence.changed" && m.projectId === projectId) void load();
    });
    return () => {
      alive = false;
      off();
    };
  }, [projectId]);
  return peers;
}

export type PresenceReport = {
  projectId: string | null;
  pageId: string | null;
  ticketId: string | null;
  shared: boolean;
};

export function usePresenceReporter({ projectId, pageId, ticketId, shared }: PresenceReport): void {
  useEffect(() => {
    if (!projectId || !shared) return;
    client
      .rpc({ method: "setPresence", projectId, pageId, ticketId })
      .catch((e: unknown) => console.error(`[kibo-ui] cannot report presence in ${projectId}`, e));
  }, [projectId, pageId, ticketId, shared]);
}
