import type { KiboSdk } from "./types";

type Recorder = <T>(permission: string, label: string, work: () => Promise<T>) => Promise<T>;
type AgentApis = Pick<KiboSdk, "questions" | "settings">;

export function recordedAgentApis(inner: AgentApis, record: Recorder): AgentApis {
  return {
    questions: {
      recipients: () => record("read:question", "read question", () => inner.questions.recipients()),
      imageUrl: inner.questions.imageUrl,
    },
    settings: {
      get: () => record("read:ticket", "read settings", () => inner.settings.get()),
      subscribe: inner.settings.subscribe,
    },
  };
}
