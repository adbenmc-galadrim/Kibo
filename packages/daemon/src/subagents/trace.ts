import { readdirSync, readFileSync, realpathSync } from "node:fs";
import { dirname, join, sep } from "node:path";
import { KiboError } from "@kibo/schema";
import { z } from "zod";
import { readLongLine, readTranscriptSlice, type TranscriptSlice } from "../moments/transcript-reader";
import type { SubagentMeta } from "./tracker";

export type SubagentFile = { transcriptPath: string; sessionId: string; agentId: string };

const AGENT_ID = /^[A-Za-z0-9_-]{1,200}$/;
const META_FILE = /^agent-([A-Za-z0-9_-]{1,200})\.meta\.json$/;
const META_MAX_BYTES = 64 * 1024;
const LONG_LINE_SCAN = 64 * 1024 * 1024;

export const isAgentId = (id: string): boolean => AGENT_ID.test(id);

export function subagentDir(transcriptPath: string, sessionId: string): string {
  if (!isAgentId(sessionId))
    throw new KiboError("PATH_OUTSIDE_PROJECT", `session ${sessionId} is not a folder name`);
  return join(dirname(transcriptPath), sessionId, "subagents");
}

function subagentFile(file: SubagentFile, suffix: string): string {
  if (!isAgentId(file.agentId))
    throw new KiboError("PATH_OUTSIDE_PROJECT", `agent ${file.agentId} is not a file name`);
  return join(subagentDir(file.transcriptPath, file.sessionId), `agent-${file.agentId}${suffix}`);
}

export const subagentTracePath = (file: SubagentFile): string => subagentFile(file, ".jsonl");
export const subagentMetaPath = (file: SubagentFile): string => subagentFile(file, ".meta.json");

const isMissing = (e: unknown): boolean =>
  e instanceof Error && "code" in e && (e.code === "ENOENT" || e.code === "ENOTDIR");

function guarded(root: string, path: string): string | null {
  let real: string;
  try {
    real = realpathSync(path);
  } catch (e) {
    if (isMissing(e)) return null;
    throw e;
  }
  if (!real.startsWith(realpathSync(root) + sep))
    throw new KiboError("PATH_OUTSIDE_PROJECT", `${path} is outside the transcripts folder`);
  return real;
}

export function readSubagentSlice(
  root: string,
  path: string,
  offset: number,
  maxBytes: number,
): TranscriptSlice {
  const real = guarded(root, path);
  if (real === null) return { lines: [], offset, more: false };
  return readTranscriptSlice(real, offset, maxBytes);
}

export function skipLongSubagentLine(root: string, path: string, offset: number): number | null {
  const real = guarded(root, path);
  if (real === null) return null;
  const line = readLongLine(real, { offset, scanFrom: offset, headBytes: 0, maxScan: LONG_LINE_SCAN });
  return line.kind === "end" ? line.offset : null;
}

export function listSubagentMetas(root: string, dir: string): string[] {
  const real = guarded(root, dir);
  if (real === null) return [];
  return readdirSync(real).flatMap((name) => {
    const match = META_FILE.exec(name);
    return match?.[1] === undefined ? [] : [match[1]];
  });
}

const text = z.string().nullish().catch(null);
const MetaFile = z.object({
  agentType: text,
  description: text,
  toolUseId: text,
  spawnDepth: z.number().int().nonnegative().nullish().catch(null),
  model: text,
});

function jsonOf(path: string): unknown {
  try {
    return JSON.parse(readFileSync(path, "utf8").slice(0, META_MAX_BYTES));
  } catch {
    return null;
  }
}

export function readSubagentMeta(root: string, path: string, agentId: string): SubagentMeta | null {
  const real = guarded(root, path);
  if (real === null) return null;
  const parsed = MetaFile.safeParse(jsonOf(real));
  if (!parsed.success) return null;
  const meta = parsed.data;
  return {
    agentId,
    agentType: meta.agentType ?? null,
    description: meta.description ?? null,
    toolUseId: meta.toolUseId ?? null,
    spawnDepth: meta.spawnDepth ?? null,
    model: meta.model ?? null,
  };
}
