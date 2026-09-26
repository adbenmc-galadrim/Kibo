import { expect, test } from "bun:test";
import { AI_RPC, KiboError, type RpcRequest } from "@kibo/schema";
import { AI_METHODS, createAiRpc, isAiRequest } from "./methods";

const draftId = "0b5c1f3e-7a51-4d2a-9c1e-2f0d6f1b8a11";

function setup(processing: ReadonlySet<string> = new Set()) {
  const seen: string[] = [];
  const mark = (name: string) => {
    seen.push(name);
    return null as never;
  };
  const port = createAiRpc({
    ai: { status: () => mark("status"), capabilities: () => null, refresh: async () => mark("refresh") },
    environment: async () => mark("environment"),
    starter: { suggest: () => mark("suggest") },
    lifecycle: {
      start: async () => mark("start"),
      retry: () => {
        throw new KiboError("INVALID_INPUT", "no");
      },
      revalidate: async () => mark("revalidate"),
      abandon: () => mark("abandon"),
      openFolder: async () => mark("openFolder"),
      list: () => mark("list"),
      recover: async () => {},
      idle: async () => {},
    },
    publisher: {
      details: async () => mark("details"),
      review: async () => mark("review"),
      finalize: async () => mark("finalize"),
      isProcessing: (id) => processing.has(id),
      idle: async () => {},
    },
  });
  return { port, seen };
}

test("every AI method is recognised, the others are not", () => {
  expect(AI_METHODS.size).toBe(AI_RPC.length);
  expect(isAiRequest({ method: "listProjects" })).toBe(false);
  expect(isAiRequest({ method: "getAgents" })).toBe(false);
  expect(isAiRequest({ method: "listComponentDrafts" })).toBe(true);
  expect(isAiRequest({ method: "getEnvironment" })).toBe(true);
});

test("routes every AI method to its module", async () => {
  const { port, seen } = setup();
  const requests: RpcRequest[] = [
    { method: "getAiStatus" },
    { method: "getEnvironment" },
    { method: "suggestStarter", role: "other", text: "x" },
    {
      method: "startComponentDraft",
      draft: { mode: "modify", id: "burndown", description: "Ajoute un titre" },
    },
    { method: "revalidateComponentDraft", draftId },
    { method: "getComponentDraft", draftId },
    { method: "listComponentDrafts" },
    { method: "reviewComponentDraft", draftId, version: "0.1.1", changes: [] },
    {
      method: "finalizeComponentDraft",
      draftId,
      version: "0.1.1",
      hash: "a".repeat(64),
      trust: "sandboxed",
      strategy: "update-all",
      target: null,
    },
    { method: "abandonComponentDraft", draftId },
    { method: "openComponentDraftFolder", draftId },
  ];
  for (const r of requests) if (isAiRequest(r)) await port.handle(r);
  expect(seen).toEqual([
    "status",
    "environment",
    "suggest",
    "start",
    "revalidate",
    "details",
    "list",
    "review",
    "finalize",
    "abandon",
    "openFolder",
  ]);
});

test("a synchronous KiboError becomes a rejection", async () => {
  const { port } = setup();
  await expect(port.handle({ method: "retryComponentDraft", draftId })).rejects.toThrow("INVALID_INPUT");
});

test("a draft being reviewed or published cannot be abandoned", async () => {
  const { port, seen } = setup(new Set([draftId]));
  const refusal = port.handle({ method: "abandonComponentDraft", draftId });
  await expect(refusal).rejects.toMatchObject({ code: "CONFLICT" });
  await expect(refusal).rejects.toThrow("being reviewed or published");
  expect(seen).toEqual([]);
});
