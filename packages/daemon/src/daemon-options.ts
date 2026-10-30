import type { Toolchain } from "@kibo/devkit";
import { type HostLoad, KiboError, type Session } from "@kibo/schema";
import { type Clock, createClock, parseFixedNow } from "./clock";
import type { ComponentsDeps } from "./components/service";
import type { IntegrationFlags } from "./integrations/bootstrap";
import type { Redactor } from "./integrations/redact";
import type { LogBuffer } from "./log-buffer";
import type { AgentSource } from "./runs/neutral-agents";
import type { Notice } from "./runs/notifier";
import type { Probe } from "./single-instance";
import type { CodeTrackingOptions } from "./tracking/bootstrap";

export type DaemonOptions = {
  home: string;
  port: number;
  sandboxPort: number;
  uiDir: string | null;
  dev: boolean;
  toolchain: Toolchain;
  user: string;
  notifications?: Session["notifications"];
  notify?: (notice: Notice) => void;
  claudeBin?: string | null;
  sampler?: () => HostLoad;
  integrations?: IntegrationFlags;
  redactor?: Redactor;
  logBuffer?: LogBuffer;
  userHome?: string;
  agentEnv?: Record<string, string | undefined>;
  transcriptRoot?: string;
  assistantTimeoutMs?: number;
  marketAllowLoopback?: boolean;
  probe?: Probe;
  agentSource?: AgentSource;
  clock?: Clock;
  code?: CodeTrackingOptions;
  answerWakeGraceMs?: number;
} & Partial<
  Pick<ComponentsDeps, "build" | "validate" | "processCommand" | "net" | "installCli" | "cliStatus">
>;

export function clockFromEnv(env: Record<string, string | undefined>, log: (line: string) => void): Clock {
  const clock = createClock(parseFixedNow(env.KIBO_FIXED_NOW));
  if (clock.fixedNow !== null) log(`[kibo-daemon] clock fixed at ${clock.fixedNow}`);
  return clock;
}

export function answerWakeGraceFromArg(raw: string | undefined): number | undefined {
  if (raw === undefined) return undefined;
  if (!/^\d+$/.test(raw))
    throw new KiboError(
      "INVALID_INPUT",
      `--answer-wake-grace-ms must be a whole number of milliseconds, got ${raw}`,
    );
  return Number(raw);
}
