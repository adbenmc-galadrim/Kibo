import type { AiStatus } from "@kibo/schema";
import { useEffect, useState } from "react";
import { client } from "../api";

export type AiBlock = "missing" | "logged_out" | "disabled" | "offline" | null;

export function aiBlock(status: AiStatus | null, online: boolean, use: "assistant" | "generateur"): AiBlock {
  if (!online) return "offline";
  if (status === null) return null;
  if (!status.available) return status.reason ?? "missing";
  return status.profiles[use] ? null : "disabled";
}

export function useAiAvailability(use: "assistant" | "generateur"): { ready: boolean; block: AiBlock } {
  const [status, setStatus] = useState<AiStatus | null>(null);
  const [failed, setFailed] = useState(false);
  const [online, setOnline] = useState(navigator.onLine);
  useEffect(() => {
    let alive = true;
    client.rpc({ method: "getAiStatus" }).then(
      (s) => alive && setStatus(s),
      () => alive && setFailed(true),
    );
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      alive = false;
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);
  return {
    ready: status !== null || failed || !online,
    block: failed ? "missing" : aiBlock(status, online, use),
  };
}
