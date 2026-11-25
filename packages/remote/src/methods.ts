import { type ComponentCall, KiboError, type ProjectCommand, type RpcRequest } from "@kibo/schema";

export const REMOTE_METHODS = [
  "getSession",
  "listProjects",
  "getProject",
  "command",
  "fileTicket",
  "listProjectEvents",
  "listCiRuns",
  "getCiLog",
  "componentCall",
  "getProjectAgent",
  "getRunLog",
  "sendProjectAgentMessage",
  "decideBatch",
  "t3.status",
  "t3.preview",
  "t3.launch",
  "t3.threadOf",
  "t3.refresh",
] as const satisfies readonly RpcRequest["method"][];

export const REMOTE_COMMAND_KINDS = [
  "createTicket",
  "updateTicket",
  "setStatus",
  "moveTicket",
  "deleteTicket",
  "addLink",
  "removeLink",
  "upsertExternalRef",
  "removeExternalRef",
  "setInstanceConfig",
  "setInstanceData",
  "createQuestion",
  "answerQuestion",
  "removeQuestion",
  "markAnswersDelivered",
  "setTicketProgress",
  "setTicketDelivery",
  "addQuestionRecipient",
  "renameQuestionRecipient",
  "removeQuestionRecipient",
  "setQuestionRecipient",
  "markQuestionSent",
  "updateQuestion",
  "updateAnswer",
  "reopenQuestion",
  "archiveQuestion",
  "restoreQuestion",
  "remindQuestion",
  "markQuestionsExported",
  "unmarkQuestionsExported",
  "createSprint",
  "updateSprint",
  "deleteSprint",
  "setTicketSprint",
  "setTicketOptional",
  "setHold",
] as const satisfies readonly ProjectCommand["method"][];

export const REMOTE_CALL_KINDS = [
  "list",
  "run",
  "settings.get",
  "project.get",
  "config.set",
  "questions.recipients",
  "t3.status",
  "t3.preview",
  "t3.launch",
  "t3.threadOf",
] as const satisfies readonly ComponentCall["kind"][];

const METHODS: ReadonlySet<string> = new Set(REMOTE_METHODS);
const COMMAND_KINDS: ReadonlySet<string> = new Set(REMOTE_COMMAND_KINDS);
const CALL_KINDS: ReadonlySet<string> = new Set(REMOTE_CALL_KINDS);

const forbidden = (what: string) => new KiboError("FORBIDDEN", `${what} is not allowed from a phone`);

function assertCommandAllowed(command: ProjectCommand): void {
  if (!COMMAND_KINDS.has(command.method)) throw forbidden(`command ${command.method}`);
}

function assertCallAllowed(call: ComponentCall): void {
  if (!CALL_KINDS.has(call.kind)) throw forbidden(`componentCall ${call.kind}`);
  if (call.kind === "run") assertCommandAllowed(call.command);
}

export function assertRemoteAllowed(req: RpcRequest): void {
  if (!METHODS.has(req.method)) throw forbidden(req.method);
  if (req.method === "command") assertCommandAllowed(req.command);
  if (req.method === "componentCall") assertCallAllowed(req.call);
}
