import { restrictGlobals } from "@kibo/devkit";
import { BackendCode, type BackendToDaemon, DaemonToBackend, KiboError } from "@kibo/schema";
import type { FileSink } from "bun";
import { BACKEND_MESSAGE_LIMIT, readLines } from "./components/line-channel";
import { createRuntime } from "./components/runtime-core";

const INPUT_FD = 3;
const OUTPUT_FD = 4;

function lineWriter(sink: FileSink): (m: BackendToDaemon) => void {
  const encoder = new TextEncoder();
  const tooLarge = (what: string) => `${what} larger than ${BACKEND_MESSAGE_LIMIT} bytes`;
  const send = (m: BackendToDaemon): void => {
    const line = JSON.stringify(m);
    if (encoder.encode(line).byteLength <= BACKEND_MESSAGE_LIMIT) {
      sink.write(`${line}\n`);
      sink.flush();
      return;
    }
    if (m.type !== "result") throw new KiboError("TOO_LARGE", tooLarge(m.type));
    send({ type: "result", id: m.id, ok: false, error: { code: "TOO_LARGE", message: tooLarge("result") } });
  };
  return send;
}

export async function startComponentRuntime(): Promise<void> {
  const input = Bun.file(INPUT_FD).stream();
  const send = lineWriter(Bun.file(OUTPUT_FD).writer());
  restrictGlobals({ freeze: true });
  let runtime: { handle(m: DaemonToBackend): void } | null = null;
  await readLines(input, Number.POSITIVE_INFINITY, {
    line(text) {
      const raw: unknown = JSON.parse(text);
      if (!runtime) {
        runtime = createRuntime(send, BackendCode.parse(raw));
        return;
      }
      const parsed = DaemonToBackend.safeParse(raw);
      if (!parsed.success) return console.error(`[kibo-runtime] invalid message: ${parsed.error.message}`);
      runtime.handle(parsed.data);
    },
    overflow: () => undefined,
  });
  process.exit(0);
}

if (import.meta.main) await startComponentRuntime();
