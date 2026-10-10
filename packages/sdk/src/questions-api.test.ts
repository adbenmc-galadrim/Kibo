import { expect, test } from "bun:test";
import {
  type ComponentCall,
  ComponentManifest,
  DEFAULT_RECIPIENTS,
  type ProjectSnapshot,
  type QuestionRecipient,
} from "@kibo/schema";
import { createMockSdk } from "./mock";
import { createSdk } from "./sdk";
import type { ProjectBackend, SdkContext } from "./types";

const manifest = ComponentManifest.parse({
  id: "probe",
  version: "1.0.0",
  kind: "view",
  title: "Probe",
  reads: ["ticket"],
  writes: [],
});
const reader = { ...manifest, reads: [...manifest.reads, "question" as const] };
const ctx: SdkContext = {
  instanceId: "i1",
  config: {},
  viewer: "adam",
  surface: "view",
  format: "medium",
  openTicket: () => undefined,
  openNewTicket: () => undefined,
  openFile: () => undefined,
  openView: () => undefined,
};
const DESIGN: QuestionRecipient[] = [...DEFAULT_RECIPIENTS, { id: "design", name: "Design" }];

const backendOf = (calls: ComponentCall[]): ProjectBackend => ({
  snapshot: async () => ({ questionRecipients: DESIGN }) as unknown as ProjectSnapshot,
  run: async () => null,
  call: async (c) => {
    calls.push(c);
    return DESIGN;
  },
  subscribe: () => () => undefined,
  runs: async () => [],
  subscribeRuns: () => () => undefined,
});

test("the recipients need read:question, from the snapshot for a built-in component", async () => {
  const calls: ComponentCall[] = [];
  await expect(createSdk(backendOf(calls), manifest, ctx).questions.recipients()).rejects.toThrow(
    "PERMISSION_DENIED",
  );
  expect(await createSdk(backendOf(calls), reader, ctx).questions.recipients()).toEqual(DESIGN);
  expect(calls).toEqual([]);
});

test("a gated component asks the daemon for the recipients", async () => {
  const calls: ComponentCall[] = [];
  await expect(createSdk(backendOf(calls), manifest, ctx, "gated").questions.recipients()).rejects.toThrow(
    "PERMISSION_DENIED",
  );
  expect(await createSdk(backendOf(calls), reader, ctx, "gated").questions.recipients()).toEqual(DESIGN);
  expect(calls).toEqual([{ kind: "questions.recipients" }]);
});

test("the mock serves the recipients of its project and records the read", async () => {
  const m = createMockSdk({ ...reader, writes: ["question"] });
  expect(await m.sdk.questions.recipients()).toEqual([...DEFAULT_RECIPIENTS]);
  await m.sdk.run({ method: "addQuestionRecipient", name: "Juridique" });
  expect((await m.sdk.questions.recipients()).map((r) => r.name)).toEqual([
    "Moi (technique)",
    "Produit",
    "Client",
    "Juridique",
  ]);
  expect(m.used).toContain("read:question");
  const without = createMockSdk(manifest);
  await expect(without.sdk.questions.recipients()).rejects.toThrow("PERMISSION_DENIED");
  expect(without.violations).toEqual(["read question"]);
});
