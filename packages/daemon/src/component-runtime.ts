import { restrictGlobals } from "@kibo/devkit";
import { BackendCode, DaemonToBackend } from "@kibo/schema";
import { createRuntime } from "./components/runtime-core";

const CODE_FD = 3;

async function readCode(): Promise<BackendCode> {
  return BackendCode.parse(JSON.parse(await Bun.file(CODE_FD).text()));
}

export async function startComponentRuntime(): Promise<void> {
  const code = await readCode();
  const send = process.send?.bind(process);
  if (!send) throw new Error("component runtime needs an IPC channel");
  restrictGlobals({ freeze: true });
  const runtime = createRuntime((m) => send(m), code);
  process.on("message", (raw) => {
    const parsed = DaemonToBackend.safeParse(raw);
    if (!parsed.success) {
      console.error(`[kibo-runtime] invalid message: ${parsed.error.message}`);
      return;
    }
    runtime.handle(parsed.data);
  });
  process.on("disconnect", () => process.exit(0));
}

if (import.meta.main) await startComponentRuntime();
