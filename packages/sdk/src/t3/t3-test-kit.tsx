import type { ReactNode } from "react";
import { createMockSdk, type MockSdk, type MockT3 } from "../mock";
import { SdkProvider } from "../react";

export const ACTIVE_THREAD = {
  threadId: "thr_1",
  link: "t3-thread://v2/env/thr_1",
  title: "SILO-45 · Conflits",
  status: "running",
  startedAt: 1_000,
  checkedAt: 1_000,
} as const;

export function mockWithT3(t3: MockT3): { mock: MockSdk; wrap(node: ReactNode): ReactNode } {
  const mock = createMockSdk(
    { id: "t3-test", version: "0.1.0", kind: "widget", title: "T3", reads: [], writes: [] },
    { t3 },
  );
  return { mock, wrap: (node) => <SdkProvider sdk={mock.sdk}>{node}</SdkProvider> };
}
