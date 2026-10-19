import type { KiboSdk } from "./types";

type Recorder = <T>(permission: string, label: string, work: () => Promise<T>) => Promise<T>;
type AgentApis = Pick<KiboSdk, "questions" | "runs" | "settings">;

export function recordedAgentApis(inner: AgentApis, record: Recorder): AgentApis {
  return {
    questions: {
      recipients: () => record("read:question", "read question", () => inner.questions.recipients()),
      imageUrl: inner.questions.imageUrl,
    },
    runs: {
      peek: (runId) => record("read:run", "read run", () => inner.runs.peek(runId)),
      deliver: (ticketId, mode) => record("write:run", "write run", () => inner.runs.deliver(ticketId, mode)),
      denials: (runId) => record("read:run", "read run", () => inner.runs.denials(runId)),
      deliveryAgent: () => record("read:run", "read run", () => inner.runs.deliveryAgent()),
      allowAndResume: (input) => record("write:run", "write run", () => inner.runs.allowAndResume(input)),
    },
    settings: {
      get: () => record("read:ticket", "read settings", () => inner.settings.get()),
      subscribe: inner.settings.subscribe,
    },
  };
}
