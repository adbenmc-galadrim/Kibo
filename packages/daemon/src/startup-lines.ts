import { KiboError } from "@kibo/schema";
import type { RunningDaemon } from "./single-instance";

export const REUSED_EXIT_CODE = 3;

const oneLine = (text: string) => text.replace(/\s+/g, " ").trim();

export function reuseLines(running: RunningDaemon, token: string): string {
  const { port, sandboxPort } = running.info;
  return `KIBO_REUSED\nKIBO_READY http://127.0.0.1:${port}/#pair=${token}\nKIBO_SANDBOX http://127.0.0.1:${sandboxPort}\n`;
}

export function fatalLine(e: unknown): string {
  const code = e instanceof KiboError ? e.code : "INTERNAL";
  const detail = e instanceof KiboError ? e.detail : e instanceof Error ? e.message : String(e);
  return `KIBO_FATAL ${code} ${oneLine(detail)}\n`;
}
