import type { Toolchain } from "@kibo/devkit";
import type { HostLoad, Session } from "@kibo/schema";
import type { TicketExecution } from "./agents/execution-removed";
import type { AgentSource } from "./agents/neutral-agents";
import type { Notice } from "./agents/notifier";
import { type Clock, createClock, parseFixedNow } from "./clock";
import type { ComponentsDeps } from "./components/service";
import type { IntegrationFlags } from "./integrations/bootstrap";
import type { Redactor } from "./integrations/redact";
import type { LogBuffer } from "./log-buffer";
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
  ticketExecution?: TicketExecution;
  answerWakeGraceMs?: number;
} & Partial<
  Pick<ComponentsDeps, "build" | "validate" | "processCommand" | "net" | "installCli" | "cliStatus">
>;

export function clockFromEnv(env: Record<string, string | undefined>, log: (line: string) => void): Clock {
  const clock = createClock(parseFixedNow(env.KIBO_FIXED_NOW));
  if (clock.fixedNow !== null) log(`[kibo-daemon] clock fixed at ${clock.fixedNow}`);
  return clock;
}
