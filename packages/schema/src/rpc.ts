import { z } from "zod";
import { AGENT_RPC, type AgentRpcResult } from "./agent-rpc";
import type { AiEvent } from "./ai";
import { AI_RPC, type AiRpcResult } from "./ai-rpc";
import type { CodeEvent } from "./code";
import { DELIVERY_RPC, type DeliveryRpcResult } from "./delivery-rpc";
import type { KiboErrorCode } from "./errors";
import type { Instance } from "./instance";
import type { Binding, IntegrationEvent } from "./integrations";
import { INTEGRATION_RPC, type IntegrationRpcResult } from "./integrations-rpc";
import type { Link } from "./link";
import { MARKET_RPC_REQUESTS, type MarketRpcResult } from "./market-rpc";
import type { RunMomentsEvent } from "./moment";
import { OVERLAP_RPC, type OverlapRpcResult } from "./overlap-rpc";
import type { Page } from "./page";
import { PHASE14_RPC, type Phase14RpcResult } from "./phase14-rpc";
import type { ProjectMeta } from "./project";
import { PROJECT_AGENT_RPC, type ProjectAgentRpcResult } from "./project-agent-rpc";
import type { Question } from "./question";
import type { QuestionRecipient } from "./question-recipient";
import { CORE_RPC, type CoreRpcResult } from "./rpc-core";
import type { Rule } from "./rule";
import type { RunChanged } from "./run";
import type { ProjectSyncInfo } from "./sharing";
import { SIGNAL_RPC, type SignalRpcResult } from "./signal-rpc";
import { SKILL_RPC, type SkillRpcResult } from "./skill-rpc";
import type { Status, StatusId } from "./status";
import { SUBAGENT_RPC, type SubagentRpcResult } from "./subagent";
import type { Phase7Event } from "./sync";
import { SYNC_RPC_REQUESTS, type SyncRpcResult } from "./sync-rpc";
import type { Ticket } from "./ticket";
import { VISIBILITY_RPC, type VisibilityRpcResult } from "./visibility-rpc";
import type { Domain } from "./workspace-config";

export type TicketView = Ticket & {
  progress: { done: number; total: number };
  waitingOn: string[];
  keyLabel: string;
  openQuestions: number;
  startable: boolean;
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
};
export type ProjectSummary = ProjectMeta & {
  counts: Record<StatusId, number>;
  icon?: string | null;
  demo?: boolean;
};
export type Session = { user: string; notifications: "native" | "browser" };
export type Topic = "agents" | "config" | "agent-files" | "skills";
export type ChangeMessage =
  | { projectId: string | null }
  | { topic: Topic }
  | RunChanged
  | CodeEvent
  | IntegrationEvent
  | AiEvent
  | Phase7Event
  | RunMomentsEvent;

export const RpcRequest = z.discriminatedUnion("method", [
  ...CORE_RPC,
  ...INTEGRATION_RPC,
  ...AI_RPC,
  ...MARKET_RPC_REQUESTS,
  ...SYNC_RPC_REQUESTS,
  ...PHASE14_RPC,
  ...PROJECT_AGENT_RPC,
  ...VISIBILITY_RPC,
  ...SIGNAL_RPC,
  ...OVERLAP_RPC,
  ...AGENT_RPC,
  ...SKILL_RPC,
  ...DELIVERY_RPC,
  ...SUBAGENT_RPC,
]);
export type RpcRequest = z.infer<typeof RpcRequest>;

export type RpcResult = CoreRpcResult &
  IntegrationRpcResult &
  AiRpcResult &
  MarketRpcResult &
  SyncRpcResult &
  Phase14RpcResult &
  ProjectAgentRpcResult &
  VisibilityRpcResult &
  SignalRpcResult &
  OverlapRpcResult &
  AgentRpcResult &
  SkillRpcResult &
  DeliveryRpcResult &
  SubagentRpcResult;

export type RpcResponse =
  | { ok: true; result: unknown }
  | { ok: false; error: { code: KiboErrorCode; message: string } };
