import type { FileVersion, FileVersionKind, VersionOrigin } from "@kibo/schema";
import type { FileHistory } from "./file-history";
import { contentHash, type GuardedWrite, writeGuarded } from "./guarded-write";

export type VersionedWriteInput = {
  history: FileHistory;
  kind: FileVersionKind;
  ref: string;
  file: string;
  path: string;
  content: string;
  baseHash: string | null;
  mode: number;
  origin: VersionOrigin;
  by: string | null;
  note?: string | null;
  expect?(hash: string): void;
};
export type VersionedWrite =
  | Exclude<GuardedWrite, { kind: "written" }>
  | { kind: "written"; version: FileVersion };

export async function versionedWrite(input: VersionedWriteInput): Promise<VersionedWrite> {
  const { history, kind, ref, file } = input;
  input.expect?.(contentHash(input.content));
  const result = await writeGuarded({
    path: input.path,
    content: input.content,
    baseHash: input.baseHash,
    lastSeen: history.latest(kind, ref, file)?.hash ?? null,
    mode: input.mode,
    onExternal: async (current) => {
      history.deposit({
        kind,
        ref,
        file,
        content: current.content,
        origin: "external",
        by: null,
        note: null,
      });
    },
  });
  if (result.kind !== "written") return result;
  const version = history.deposit({
    kind,
    ref,
    file,
    content: input.content,
    origin: input.origin,
    by: input.by,
    note: input.note ?? null,
  });
  return { kind: "written", version };
}
