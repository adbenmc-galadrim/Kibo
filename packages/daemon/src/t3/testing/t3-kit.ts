import { chmodSync, copyFileSync, existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { EMPTY_FAKE_T3, type FakeT3State, readFakeT3State, writeFakeT3State } from "./fake-t3-state";

export type FakeT3 = {
  bin: string;
  calls(): string[][];
  state(): FakeT3State;
  set(patch: Partial<FakeT3State>): void;
  stop(): void;
};

function restoreEnv(name: string, value: string | undefined): void {
  if (value === undefined) delete process.env[name];
  else process.env[name] = value;
}

export function installFakeT3(): FakeT3 {
  const dir = mkdtempSync(join(tmpdir(), "kibo-t3-"));
  const bin = join(dir, "t3");
  const statePath = join(dir, "state.json");
  const logPath = join(dir, "log.jsonl");
  copyFileSync(join(import.meta.dir, "..", "fake-t3.ts"), bin);
  chmodSync(bin, 0o755);
  writeFakeT3State(statePath, EMPTY_FAKE_T3);
  const previous = { state: process.env.FAKE_T3_STATE, log: process.env.FAKE_T3_LOG };
  process.env.FAKE_T3_STATE = statePath;
  process.env.FAKE_T3_LOG = logPath;
  return {
    bin,
    calls: () =>
      existsSync(logPath)
        ? readFileSync(logPath, "utf8")
            .trim()
            .split("\n")
            .map((line) => JSON.parse(line))
        : [],
    state: () => readFakeT3State(statePath),
    set: (patch) => writeFakeT3State(statePath, { ...readFakeT3State(statePath), ...patch }),
    stop() {
      restoreEnv("FAKE_T3_STATE", previous.state);
      restoreEnv("FAKE_T3_LOG", previous.log);
      rmSync(dir, { recursive: true, force: true });
    },
  };
}
