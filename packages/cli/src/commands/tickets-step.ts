import { DeliveryStepNumber, deliveryStepLabel, TicketKey } from "@kibo/schema";
import type { Parsed } from "../args";
import type { DaemonClient } from "../daemon-client";
import { frTickets } from "../fr";
import { type Connect, findProject, printJson, type SessionIo, withClient } from "./daemon-session";

type StepRequest = { ticketKey: string; step: number; note: string | null; update: boolean };

function parseStep(raw: string): number | null {
  if (!/^\d+$/.test(raw)) return null;
  const parsed = DeliveryStepNumber.safeParse(Number(raw));
  return parsed.success ? parsed.data : null;
}

async function sendStep(client: DaemonClient, req: StepRequest, flags: Parsed["flags"], io: SessionIo) {
  const wanted = typeof flags.project === "string" ? flags.project : (req.ticketKey.split("-")[0] ?? "");
  const project = findProject(await client.rpc({ method: "listProjects" }), wanted);
  if (!project) {
    io.err(frTickets.projectNotFound(wanted));
    return 1;
  }
  const view = await client.rpc({
    method: "setDeliveryStep",
    projectId: project.id,
    ticketKey: req.ticketKey,
    step: req.step,
    ...(req.note === null ? {} : { note: req.note }),
    ...(req.update ? { kind: "update" as const } : {}),
  });
  const done = req.update ? frTickets.touchUpDone : frTickets.stepDone;
  if (flags.json === true) printJson(io, view);
  else io.out(done(req.ticketKey, deliveryStepLabel(req.step)));
  return 0;
}

export async function ticketsStep(
  args: readonly string[],
  flags: Parsed["flags"],
  io: SessionIo,
  connect?: Connect,
): Promise<number> {
  const [rawKey, rawStep, ...words] = args;
  const key = TicketKey.safeParse(rawKey?.trim().toUpperCase());
  if (!key.success || rawStep === undefined) {
    io.err(frTickets.usage);
    return 2;
  }
  const step = parseStep(rawStep);
  if (step === null) {
    io.err(frTickets.stepOutOfRange(rawStep));
    return 1;
  }
  const note = words.join(" ").trim();
  const req = { ticketKey: key.data, step, note: note === "" ? null : note, update: flags.update === true };
  return withClient(io, (client) => sendStep(client, req, flags, io), connect);
}
