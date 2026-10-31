import { KiboError, type T3Launch, type T3Preview, type T3Status, type T3Thread } from "@kibo/schema";

export type MockT3 = {
  status: T3Status;
  thread?: T3Thread | null;
  folder?: string;
  warning?: string | null;
  previewError?: KiboError;
  launchError?: KiboError;
  launches?: string[];
};

const MISSING: T3Status = { available: false, reason: "missing", bin: "t3" };
const NO_T3: MockT3 = { status: MISSING };

const commandOf = (folder: string, key: string): string =>
  `t3 thread start ${folder} "/full-delivery ${key}"`;

function previewOf(t3: MockT3, key: string): T3Preview {
  if (t3.previewError) throw t3.previewError;
  const folder = t3.folder ?? "~/Documents/silo";
  const argv = ["t3", "thread", "start", folder, `/full-delivery ${key}`];
  return { argv, command: commandOf(folder, key), folder, warning: t3.warning ?? null };
}

function launchOf(t3: MockT3, key: string): T3Launch {
  if (t3.launchError) throw t3.launchError;
  t3.launches?.push(key);
  const thread: T3Thread = {
    threadId: `thr_${key}`,
    link: `t3-thread://mock/${key}`,
    title: key,
    status: "running",
    startedAt: 0,
    checkedAt: 0,
  };
  return { thread, command: previewOf(t3, key).command };
}

export function mockT3Call(options: MockT3 | undefined, call: { kind: `t3.${string}`; ticketKey?: string }) {
  const t3 = options ?? NO_T3;
  const key = call.ticketKey ?? "";
  switch (call.kind) {
    case "t3.status":
      return t3.status;
    case "t3.threadOf":
      return t3.thread ?? null;
    case "t3.refresh":
      return t3.thread ? [t3.thread] : [];
    case "t3.preview":
    case "t3.launch":
      if (options === undefined)
        throw new KiboError("NOT_CONNECTED", "t3 is not available in the simulated SDK");
      return call.kind === "t3.preview" ? previewOf(t3, key) : launchOf(t3, key);
    default:
      throw new KiboError("INVALID_INPUT", `unknown call ${call.kind}`);
  }
}
