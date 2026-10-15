import type { Database } from "bun:sqlite";
import { getTicket } from "@kibo/core";
import type { AgentSettings, AgentSettingsPatch, AgentsState, MachineLock, RpcRequest } from "@kibo/schema";
import { createDenialQuestion, type DenialQuestionDeps } from "../agents/denial-question";
import { denialStore } from "../agents/denial-store";
import type { Notice } from "../agents/notifier";
import type { Orchestrator } from "../agents/orchestrator-types";
import { processAlive, readSlotsDir, slotsDirOf } from "../locks/slots-reader";
import type { TraceService } from "../moments/trace-service";
import { questionImageFiles } from "../questions/question-images-port";
import type { RpcExtension, RpcHandler } from "../rpc-extensions";
import type { Service } from "../service";
import { ready } from "../service-ports";
import { openRunsDatabase } from "../skills/runs-db";
import { type ComponentDelivery, componentDelivery } from "./component-calls";
import { deliverRpc } from "./deliver-rpc";
import { createDeliveryOps } from "./delivery-ops";
import { deliveryImportRpc, deliveryRunsRpc, localAllowFromComponents } from "./delivery-rpc";
import { denialNotice, type TurnEnd, withDenialQuestions } from "./denial-turn";
import { withDeliverySteps } from "./run-steps";
import { deliveryStepRpc } from "./step-rpc";

export type DeliveryInput = {
  home: string;
  userHome: string;
  env: Record<string, string | undefined>;
  notify(notice: Notice): void;
  service(): Pick<Service, "docs" | "agentData">;
  notesDir(projectId: string): string | null;
  moments(): Pick<TraceService, "page">;
  agentSettings(): { settings(ref: string, patch: AgentSettingsPatch): AgentSettings };
  orchestrator(): Pick<Orchestrator, "state" | "assign" | "answer"> | null;
  db?: Database;
  alive?(pid: number): boolean;
};

export type Delivery = {
  rpc: RpcExtension[];
  handlers: RpcHandler[];
  questionImages: ReturnType<typeof questionImageFiles>;
  components: ComponentDelivery;
  lifecycle<L extends TurnEnd>(base: L): L;
  agents<P extends { state(): AgentsState }>(port: P): P;
  locks(): MachineLock[];
  close(): void;
};

const log = (line: string) => console.error(`[kibo-daemon] ${line}`);

const lazy = (methods: readonly RpcRequest["method"][], make: () => RpcExtension): RpcExtension => ({
  methods,
  handle: (req, ctx) => make().handle(req, ctx),
});

export function startDelivery(input: DeliveryInput): Delivery {
  const db = input.db ?? openRunsDatabase(input.home, "denial");
  const denials = denialStore(db);
  const docs = () => input.service().docs;
  const agentData = () => input.service().agentData;
  const orchestrator = () => ready(input.orchestrator(), "INTERNAL", "agents are not ready");
  const ops = createDeliveryOps({
    home: input.userHome,
    docs,
    agentData,
    agentSettings: input.agentSettings,
    orchestrator,
    denials,
  });
  const denialDeps = (): DenialQuestionDeps => ({
    store: denials,
    moments: (runId, since) => input.moments().page(runId, since).moments,
    agentOf: (ref) => agentData().agentOf(ref),
    project: (projectId) => docs().projectMeta(projectId).delivery,
    data: agentData(),
    home: input.userHome,
    now: Date.now,
    log,
    onQuestion: (run, _question, count) => input.notify(denialNotice(run, count)),
  });
  const slots = slotsDirOf(input.env, input.userHome);
  return {
    rpc: [
      lazy(["deliver"], () =>
        deliverRpc(ops.deliverDeps(), { assertWritable: (id) => docs().assertWritable(id) }),
      ),
      lazy(["setDeliveryStep"], () =>
        deliveryStepRpc({ docs: docs(), runs: () => orchestrator().state().runs, now: Date.now }),
      ),
      deliveryRunsRpc(ops),
      deliveryImportRpc(
        () => ({ home: input.userHome, env: input.env, docs: docs() }),
        (projectId) => docs().assertWritable(projectId),
      ),
    ],
    handlers: [localAllowFromComponents],
    questionImages: questionImageFiles(input.home, input.notesDir),
    components: componentDelivery(ops),
    lifecycle: (base) => withDenialQuestions(base, (run) => createDenialQuestion(denialDeps(), run), log),
    agents: (port) =>
      withDeliverySteps(
        port,
        (projectId, ticketId) => getTicket(docs().project(projectId), ticketId).delivery,
      ),
    locks: () => readSlotsDir(slots, { alive: input.alive ?? processAlive }),
    close: () => {
      if (!input.db) db.close();
    },
  };
}
