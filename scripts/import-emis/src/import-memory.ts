import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { GitBranchRef, KiboError, StatusId } from "@kibo/schema";
import { z } from "zod";

export const MEMORY_FILE = ".import-emis-tickets.json";

export const TicketMemory = z.object({
  title: z.string(),
  description: z.string(),
  labels: z.array(z.string()),
  parent: z.string().nullable(),
  status: z.object({ statusId: StatusId, blockedReason: z.string().nullable() }),
  branch: GitBranchRef.nullable(),
});
export type TicketMemory = z.infer<typeof TicketMemory>;
export const ImportMemory = z.record(z.string(), TicketMemory);
export type ImportMemory = z.infer<typeof ImportMemory>;
const MemoryFile = z.object({ version: z.literal(1), tickets: ImportMemory });

export function loadMemory(dir: string): ImportMemory {
  const file = join(dir, MEMORY_FILE);
  if (!existsSync(file)) return {};
  const parsed = MemoryFile.safeParse(JSON.parse(readFileSync(file, "utf8")));
  if (!parsed.success) throw new KiboError("INVALID_INPUT", `${file} is not an import memory`);
  return parsed.data.tickets;
}

export function saveMemory(dir: string, tickets: ImportMemory): void {
  mkdirSync(dir, { recursive: true });
  const sorted = Object.fromEntries(Object.entries(tickets).sort(([a], [b]) => (a < b ? -1 : 1)));
  writeFileSync(join(dir, MEMORY_FILE), `${JSON.stringify({ version: 1, tickets: sorted }, null, 2)}\n`);
}
