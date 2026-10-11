import { closeSync, fstatSync, openSync, readSync } from "node:fs";
import { KiboError, TRANSCRIPT_PASS_MAX_BYTES } from "@kibo/schema";

export type TranscriptSlice = { lines: string[]; offset: number; more: boolean };
export type LongLineScan = { offset: number; scanFrom: number; headBytes: number; maxScan: number };
export type LongLine =
  | { kind: "end"; head: string; offset: number }
  | { kind: "scanning"; scannedTo: number; more: boolean };

const NEWLINE = 0x0a;
const SCAN_CHUNK = 1024 * 1024;

function openTranscript(path: string): number {
  try {
    return openSync(path, "r");
  } catch (e) {
    if (e instanceof Error && "code" in e && e.code === "ENOENT")
      throw new KiboError("NOT_FOUND", `transcript ${path} does not exist`);
    throw e;
  }
}

function withFile<T>(path: string, read: (fd: number, size: number) => T): T {
  const fd = openTranscript(path);
  try {
    return read(fd, fstatSync(fd).size);
  } finally {
    closeSync(fd);
  }
}

function readAt(fd: number, offset: number, length: number): Buffer {
  const buffer = Buffer.alloc(length);
  const read = readSync(fd, buffer, 0, length, offset);
  return buffer.subarray(0, read);
}

export function readTranscriptSlice(
  path: string,
  offset: number,
  maxBytes: number = TRANSCRIPT_PASS_MAX_BYTES,
): TranscriptSlice {
  return withFile(path, (fd, size) => {
    const length = Math.max(0, Math.min(maxBytes, size - offset));
    const chunk = readAt(fd, offset, length);
    const more = offset + chunk.length < size;
    const end = chunk.lastIndexOf(NEWLINE);
    if (end < 0) return { lines: [], offset, more };
    const lines = chunk.subarray(0, end).toString("utf8").split("\n");
    return { lines, offset: offset + end + 1, more };
  });
}

export function readLongLine(path: string, scan: LongLineScan): LongLine {
  return withFile(path, (fd, size) => {
    const end = Math.min(size, scan.scanFrom + scan.maxScan);
    for (let at = scan.scanFrom; at < end; at += SCAN_CHUNK) {
      const index = readAt(fd, at, Math.min(SCAN_CHUNK, end - at)).indexOf(NEWLINE);
      if (index >= 0) {
        const length = Math.min(scan.headBytes, at + index - scan.offset);
        const head = readAt(fd, scan.offset, length).toString("utf8");
        return { kind: "end", head, offset: at + index + 1 };
      }
    }
    return { kind: "scanning", scannedTo: end, more: end < size };
  });
}
