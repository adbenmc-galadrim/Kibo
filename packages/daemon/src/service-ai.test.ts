import { afterEach, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { AiRpcRequest } from "@kibo/schema";
import { createService } from "./service";
import { openStore } from "./store";

const dirs: string[] = [];
afterEach(() => {
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});

function setup() {
  const home = mkdtempSync(join(tmpdir(), "kibo-svc-ai-"));
  dirs.push(home);
  const store = openStore(home);
  return { store, service: createService(store, { user: "adam" }) };
}

test("AI methods are AI_UNAVAILABLE until the AI is attached, then reach it", async () => {
  const { store, service } = setup();
  try {
    expect(() => service.handle({ method: "getEnvironment" })).toThrow("AI_UNAVAILABLE");
    expect(() => service.handle({ method: "getAiStatus" })).toThrow("AI_UNAVAILABLE");
    const seen: AiRpcRequest[] = [];
    const detach = service.attachAi({
      handle: async (req) => {
        seen.push(req);
        return "ok";
      },
    });
    expect(await service.handle({ method: "getEnvironment" })).toBe("ok");
    expect(await service.handle({ method: "listComponentDrafts" })).toBe("ok");
    expect(seen.map((r) => r.method)).toEqual(["getEnvironment", "listComponentDrafts"]);
    detach();
    expect(() => service.handle({ method: "getAiStatus" })).toThrow("AI_UNAVAILABLE");
  } finally {
    store.close();
  }
});
