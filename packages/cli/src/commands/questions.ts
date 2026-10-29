import { findRecipient, KiboError, type ProjectCommand, Question, type TicketView } from "@kibo/schema";
import { flagList, type Parsed } from "../args";
import { frQuestions } from "../fr-questions";
import { answerInputOf } from "../questions/answer-input";
import { questionLabel, questionLines } from "../questions/question-text";
import { findQuestion, summarizeQuestions } from "../questions/question-view";
import { readTextArg } from "../text-source";
import { lookupTicket } from "../tickets/ticket-view";
import { cliActor } from "./actor";
import { type Connect, printJson, type SessionIo, withClient } from "./daemon-session";
import { chooseProject, notFound, type TicketsContext } from "./tickets-context";

type Flags = Parsed["flags"];
type Args = { sub: string; ident: string; text: string };

const SUBCOMMANDS = new Set(["list", "add", "answer"]);
const VALUE_FLAGS = ["project", "context", "recipient", "provisional"];

function optionsOrNull(flags: Flags): string[] | null {
  try {
    return flagList(flags, "option");
  } catch (e) {
    if (e instanceof KiboError && e.code === "INVALID_INPUT") return null;
    throw e;
  }
}

function isUsage({ sub, ident, text }: Args, flags: Flags): boolean {
  if (!SUBCOMMANDS.has(sub) || ident === "") return true;
  if (VALUE_FLAGS.some((name) => flags[name] !== undefined && typeof flags[name] !== "string")) return true;
  if (sub === "list") return false;
  if (text === "") return true;
  if (sub === "answer") return typeof flags.project !== "string";
  return (optionsOrNull(flags) ?? []).length === 0;
}

async function send(ctx: TicketsContext, command: ProjectCommand): Promise<unknown> {
  return ctx.client.rpc({ method: "command", projectId: ctx.snapshot.meta.id, command });
}

function listCommand(ticket: TicketView, { snapshot, flags, io }: TicketsContext): number {
  const questions = summarizeQuestions(snapshot, ticket.id, flags.all === true);
  if (flags.json === true) printJson(io, questions);
  else if (questions.length === 0) io.out(frQuestions.none(ticket.keyLabel));
  else for (const line of questionLines(questions)) io.out(line);
  return 0;
}

function recipientIdOf(raw: string | null, ctx: TicketsContext): string | null | undefined {
  if (raw === null) return undefined;
  const recipients = ctx.snapshot.questionRecipients;
  const found = findRecipient(recipients, raw.trim());
  if (found) return found.id;
  ctx.io.err(
    frQuestions.unknownRecipient(
      raw,
      recipients.map((r) => r.name),
    ),
  );
  return null;
}

async function addCommand(ticket: TicketView, title: string, ctx: TicketsContext): Promise<number> {
  const { flags, io, snapshot, cwd } = ctx;
  const options = flagList(flags, "option");
  const provisional = typeof flags.provisional === "string" ? flags.provisional : undefined;
  if (provisional !== undefined && !options.includes(provisional)) {
    io.err(frQuestions.provisionalOutside);
    return 1;
  }
  const recipient = recipientIdOf(typeof flags.recipient === "string" ? flags.recipient : null, ctx);
  if (recipient === null) return 1;
  const context = typeof flags.context === "string" ? readTextArg(flags.context, cwd) : undefined;
  const result = await send(ctx, {
    method: "createQuestion",
    ticketId: ticket.id,
    title,
    ...(context === undefined ? {} : { context }),
    options,
    ...(provisional === undefined ? {} : { provisional }),
    blocking: flags.blocking === true,
    ...(recipient === undefined ? {} : { recipient }),
    createdBy: cliActor(snapshot),
    runId: null,
  });
  const question = Question.parse(result);
  if (flags.json === true) printJson(io, question);
  else io.out(frQuestions.added(questionLabel(question), ticket.keyLabel));
  return 0;
}

async function answerCommand(ident: string, text: string, ctx: TicketsContext): Promise<number> {
  const question = findQuestion(ctx.snapshot.questions, ident);
  if (!question) {
    ctx.io.err(frQuestions.notFound(ident));
    return 1;
  }
  const result = await send(ctx, {
    method: "answerQuestion",
    questionId: question.id,
    answer: answerInputOf(question, text),
    by: cliActor(ctx.snapshot),
  });
  if (ctx.flags.json === true) printJson(ctx.io, Question.parse(result));
  else ctx.io.out(frQuestions.answered(questionLabel(question), text));
  return 0;
}

function onTicket({ sub, ident, text }: Args, ctx: TicketsContext): Promise<number> | number {
  if (sub === "answer") return answerCommand(ident, text, ctx);
  const ticket = lookupTicket(ctx.snapshot.tickets, ident);
  if (!ticket) return notFound(ident, ctx.io);
  return sub === "add" ? addCommand(ticket, text, ctx) : listCommand(ticket, ctx);
}

export async function questionsCommand(
  positional: readonly string[],
  flags: Flags,
  io: SessionIo,
  connect?: Connect,
  cwd: string = process.cwd(),
): Promise<number> {
  const args: Args = { sub: positional[0] ?? "", ident: positional[1] ?? "", text: positional[2] ?? "" };
  if (isUsage(args, flags)) {
    io.err(frQuestions.usage);
    return 2;
  }
  const project = typeof flags.project === "string" ? flags.project : undefined;
  return withClient(
    io,
    async (client) => {
      const projects = await client.rpc({ method: "listProjects" });
      const choice = chooseProject(projects, args.sub === "answer" ? "" : args.ident, project, cwd);
      if ("problem" in choice) {
        io.err(choice.problem);
        return choice.code;
      }
      const snapshot = await client.rpc({ method: "getProject", projectId: choice.project.id });
      return onTicket(args, { client, snapshot, flags, io, cwd });
    },
    connect,
  );
}
