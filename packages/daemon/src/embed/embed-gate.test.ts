import { describe, expect, test } from "bun:test";
import { ComponentManifest, type EmbedView, KiboError } from "@kibo/schema";
import { createEmbedGate } from "./embed-gate";
import type { EmbedChecker, EmbedService } from "./types";

const manifest = ComponentManifest.parse({
  id: "itch",
  version: "1.0.0",
  kind: "both",
  title: "Jeu itch.io",
  reads: [],
  writes: [],
  capabilities: ["embed"],
  embeds: ["itch.io"],
});
const ctx = { projectId: "p1", instanceId: "w1", manifest };

function kit(fail?: KiboError) {
  const checked: string[] = [];
  const opened: string[] = [];
  const checker: EmbedChecker = {
    async check(target, refresh) {
      checked.push(`${target} ${refresh}`);
      if (fail) throw fail;
    },
  };
  const service: Pick<EmbedService, "open"> = {
    open(instanceId, kind, target, title): EmbedView {
      opened.push(`${instanceId} ${kind} ${target} ${title}`);
      return { url: "http://127.0.0.1:1/e/x", kind, sandbox: "", allow: "", expiresAt: 0, target };
    },
  };
  return { gate: createEmbedGate({ service, checker }), checked, opened };
}

describe("embed gate", () => {
  test("checks the declared target, then mints a game frame titled by its host", async () => {
    const { gate, checked, opened } = kit();
    const view = await gate.open(ctx, "https://itch.io/embed-upload/1?color=333");
    expect(view.target).toBe("https://itch.io/embed-upload/1?color=333");
    expect(checked).toEqual(["https://itch.io/embed-upload/1?color=333 false"]);
    expect(opened).toEqual(["w1 game https://itch.io/embed-upload/1?color=333 itch.io"]);
    await gate.open(ctx, "https://itch.io/embed-upload/1?color=333", true);
    expect(checked.at(-1)).toBe("https://itch.io/embed-upload/1?color=333 true");
  });

  test.each([
    ["http://itch.io/embed-upload/1", "insecure"],
    ["https://user:pw@itch.io/embed-upload/1", "credentials"],
    ["https://itch.io:8443/embed-upload/1", "port"],
    ["https://www.itch.io/embed-upload/1", "host-not-declared"],
    ["https://itch.io.evil.example/embed-upload/1", "host-not-declared"],
    ["https://html.itch.zone/html/1/index.html", "host-not-declared"],
    ["not a url", "not-a-url"],
  ])("%s is refused (%s) before any request", async (url, cause) => {
    const { gate, checked, opened } = kit();
    const refusal = gate.open(ctx, url);
    await expect(refusal).rejects.toThrow("PERMISSION_DENIED");
    await expect(refusal).rejects.toThrow(`embed target refused (${cause})`);
    expect(checked).toEqual([]);
    expect(opened).toEqual([]);
  });

  test("an address longer than 2048 characters is invalid input", async () => {
    const { gate } = kit();
    const long = `https://itch.io/${"a".repeat(2049 - "https://itch.io/".length)}`;
    expect(long).toHaveLength(2049);
    await expect(gate.open(ctx, long)).rejects.toThrow("INVALID_INPUT");
  });

  test("a manifest without embeds declares nothing", async () => {
    const { gate } = kit();
    const bare = { ...ctx, manifest: { ...manifest, embeds: [] } };
    await expect(gate.open(bare, "https://itch.io/embed-upload/1")).rejects.toThrow("host-not-declared");
  });

  test("a refused integrability check mints nothing", async () => {
    const { gate, opened } = kit(new KiboError("EMBED_REFUSED", "refused"));
    await expect(gate.open(ctx, "https://itch.io/embed-upload/2")).rejects.toThrow("EMBED_REFUSED");
    expect(opened).toEqual([]);
  });
});
