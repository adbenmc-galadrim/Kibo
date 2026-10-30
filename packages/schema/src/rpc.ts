import { z } from "zod";
import { APP_RPC, type AppRpcResult } from "./app-rpc";
import type { CodeEvent } from "./code";
import type { KiboErrorCode } from "./errors";
import type { FeatureState } from "./feature-state";
import type { Instance } from "./instance";
import type { Binding, IntegrationEvent } from "./integrations";
import { INTEGRATION_RPC, type IntegrationRpcResult } from "./integrations-rpc";
import type { Link } from "./link";
import type { OnHold } from "./on-hold";
import type { Page } from "./page";
import { PLAN_RPC, type PlanRpcResult } from "./plan-rpc";
import type { ProjectMeta } from "./project";
import { PROJECT_AGENT_RPC, type ProjectAgentRpcResult } from "./project-agent-rpc";
import type { Question } from "./question";
import type { QuestionRecipient } from "./question-recipient";
import { CORE_RPC, type CoreRpcResult } from "./rpc-core";
import type { Rule } from "./rule";
import type { RunChanged } from "./run";
import { SESSION_RPC, type SessionRpcResult } from "./session-rpc";
import type { ProjectSyncInfo } from "./sharing";
import type { SprintView } from "./sprint";
import type { StartReason } from "./startability";
import type { Status, StatusId } from "./status";
import type { Phase7Event } from "./sync";
import { SYNC_RPC_REQUESTS, type SyncRpcResult } from "./sync-rpc";
import type { Ticket } from "./ticket";
import type { TicketSession } from "./ticket-session";
import { TRACKING_RPC, type TrackingRpcResult } from "./tracking-rpc";
import type { Domain } from "./workspace-config";

export type TicketView = Ticket & {
  progress: { done: number; total: number };
  waitingOn: string[];
  keyLabel: string;
  openQuestions: number;
  startable: boolean;
  startReason: StartReason | null;
  effectiveSprintId: string | null;
  feature: FeatureState | null;
  session: TicketSession | null;
  updatedAt: number | null;
  onHold: OnHold | null;
};
export type ProjectSnapshot = {
  meta: ProjectMeta;
  workflow: Status[];
  pages: Page[];
  tickets: TicketView[];
  links: Link[];
  questions: Question[];
  questionRecipients: QuestionRecipient[];
  instances: Instance[];
  rules: Rule[];
  bindings: Binding[];
  nextTicketKey: string | null;
  sync: ProjectSyncInfo;
  domains?: Domain[];
  viewer?: string;
  icon?: string | null;
  sprints: SprintView[];
};
export type ProjectSummary = ProjectMeta & {
  counts: Record<StatusId, number>;
  icon?: string | null;
};
export type Session = { user: string; notifications: "native" | "browser" };
export type Topic = "agents" | "config";
export type ChangeMessage =
  | { projectId: string | null }
  | { topic: Topic }
  | RunChanged
  | CodeEvent
  | IntegrationEvent
  | Phase7Event;

export const RpcRequest = z.discriminatedUnion("method", [
  ...CORE_RPC,
  ...INTEGRATION_RPC,
  ...SESSION_RPC,
  ...SYNC_RPC_REQUESTS,
  ...APP_RPC,
  ...PROJECT_AGENT_RPC,
  ...TRACKING_RPC,
  ...PLAN_RPC,
]);
export type RpcRequest = z.infer<typeof RpcRequest>;

export type RpcResult = CoreRpcResult &
  IntegrationRpcResult &
  SessionRpcResult &
  SyncRpcResult &
  AppRpcResult &
  ProjectAgentRpcResult &
  TrackingRpcResult &
  PlanRpcResult;

export type RpcResponse =
  | { ok: true; result: unknown }
  | { ok: false; error: { code: KiboErrorCode; message: string } };
