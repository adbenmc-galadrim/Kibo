import { readFileSync, writeFileSync } from "node:fs";

export type FakeT3Thread = { threadId: string; title: string; status: string; link: string; project: string };
export type FakeT3State = { mode: "ok" | "missing" | "server-down"; threads: FakeT3Thread[]; nextId: string };

export const EMPTY_FAKE_T3: FakeT3State = { mode: "ok", threads: [], nextId: "thr_1" };

export const writeFakeT3State = (path: string, state: FakeT3State): void =>
  writeFileSync(path, JSON.stringify(state));

export const readFakeT3State = (path: string): FakeT3State => JSON.parse(readFileSync(path, "utf8"));
