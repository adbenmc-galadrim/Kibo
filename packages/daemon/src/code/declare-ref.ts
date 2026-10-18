import {
  branchRefOf,
  type DeclareTicketRefInput,
  type DeclareTicketRefResult,
  type ExternalRef,
  type GitBranchRef,
  type GithubPrRef,
  KiboError,
  type TicketView,
} from "@kibo/schema";
import { USER_COMMAND } from "../docs";
import { type RpcExtension, requireLocal } from "../rpc-extensions";
import { call, type Service } from "../service";
import { applyPr, triggerRules } from "./pr-rules";

const isPr = (ref: ExternalRef): ref is GithubPrRef => ref.kind === "github_pr";

function ticketOf(service: Service, projectId: string, key: string): TicketView {
  const tickets = call(service, { method: "getProject", projectId }).tickets;
  const ticket = tickets.find((t) => t.key === key) ?? tickets.find((t) => t.shortKey === key);
  if (!ticket) throw new KiboError("NOT_FOUND", `ticket ${key} not found`);
  return ticket;
}

function upsert(service: Service, projectId: string, ticketId: string, ref: ExternalRef): void {
  service.docs.run(projectId, { method: "upsertExternalRef", ticketId, ref }, USER_COMMAND);
}

function declareBranch(service: Service, projectId: string, ticket: TicketView, ref: GitBranchRef): void {
  const current = branchRefOf(ticket.externalRefs);
  if (current?.branch === ref.branch && current.base === ref.base) return;
  upsert(service, projectId, ticket.id, ref);
  triggerRules(service, projectId, { kind: "branch_created", ticketId: ticket.id });
}

const keepKnown = (declared: GithubPrRef, previous: GithubPrRef | null): GithubPrRef =>
  previous === null
    ? declared
    : {
        ...previous,
        state: declared.state,
        base: declared.base ?? previous.base,
        head: declared.head ?? previous.head,
      };

function declarePr(service: Service, projectId: string, ticket: TicketView, declared: GithubPrRef): void {
  const previous = ticket.externalRefs.filter(isPr).find((r) => r.url === declared.url) ?? null;
  const ref = keepKnown(declared, previous);
  applyPr(service, { projectId, ticketId: ticket.id, previous, ref }, (next) =>
    upsert(service, projectId, ticket.id, next),
  );
}

export function declareTicketRef(service: Service, input: DeclareTicketRefInput): DeclareTicketRefResult {
  const { projectId, ticketKey, ref } = input;
  const before = ticketOf(service, projectId, ticketKey);
  if (ref.kind === "git_branch") declareBranch(service, projectId, before, ref);
  else declarePr(service, projectId, before, ref);
  const ticket = ticketOf(service, projectId, ticketKey);
  return { ticket, statusChanged: ticket.statusId !== before.statusId };
}

export function declareRefRpc(service: Service): RpcExtension {
  return {
    methods: ["declareTicketRef"],
    async handle(req, ctx) {
      if (req.method !== "declareTicketRef")
        throw new KiboError("INTERNAL", `${req.method} is not a reference declaration`);
      requireLocal(ctx);
      const { method: _method, ...input } = req;
      return declareTicketRef(service, input);
    },
  };
}
