import type { AgentSummary, MigrationNotice } from "@kibo/schema";
import { useCallback, useEffect, useRef, useState } from "react";
import { client } from "../api";

export type AgentList = {
  agents: AgentSummary[] | null;
  notices: MigrationNotice[];
  partialWatch: boolean;
  failed: boolean;
  retry(): void;
};

const sameNotice = (a: MigrationNotice, b: MigrationNotice) =>
  a.profileName === b.profileName && a.text === b.text;

export function useAgentList(projectId: string | null): AgentList {
  const [agents, setAgents] = useState<AgentSummary[] | null>(null);
  const [notices, setNotices] = useState<MigrationNotice[]>([]);
  const [partialWatch, setPartialWatch] = useState(false);
  const [failed, setFailed] = useState(false);
  const reload = useRef(() => {});

  useEffect(() => {
    let alive = true;
    const load = () =>
      client.rpc({ method: "agents.list", ...(projectId ? { projectId } : {}) }).then(
        (list) => {
          if (!alive) return;
          setAgents(list.agents);
          setPartialWatch(list.partialWatch);
          setFailed(false);
          setNotices((seen) => [...seen, ...list.notices.filter((n) => !seen.some((s) => sameNotice(s, n)))]);
        },
        () => alive && setFailed(true),
      );
    reload.current = () => void load();
    void load();
    const off = client.subscribeTopic("agent-files", () => void load());
    return () => {
      alive = false;
      off();
    };
  }, [projectId]);
  const retry = useCallback(() => reload.current(), []);
  return { agents, notices, partialWatch, failed, retry };
}
