import { describe, expect, test } from "bun:test";
import { EMBED_ATTRIBUTES } from "@kibo/schema";
import { createEmbedService } from "./embed-service";

const SANDBOX = "http://127.0.0.1:4318";
const TARGET = "https://itch.io/embed-upload/1?color=333";
const UI = ["http://127.0.0.1:4317", "http://localhost:4317"];

function service(opts: { aliases?: Map<string, URL>; sandbox?: string | null } = {}) {
  let now = 1_000;
  const s = createEmbedService({
    now: () => now,
    sandboxOrigin: () => (opts.sandbox === undefined ? SANDBOX : opts.sandbox),
    uiOrigins: () => UI,
    devOrigins: [],
    aliases: opts.aliases ?? new Map(),
  });
  const advance = (ms: number) => {
    now += ms;
  };
  return { s, advance };
}
const tokenOf = (url: string) => url.slice(`${SANDBOX}/e/`.length);

describe("embed service", () => {
  test("open mints a relay address on the sandbox port with the attributes of the kind", () => {
    const { s } = service();
    const view = s.open("w1", "game", TARGET, "itch.io");
    expect(view.url).toMatch(/^http:\/\/127\.0\.0\.1:4318\/e\/[0-9a-f]{64}$/);
    expect(view).toMatchObject({ kind: "game", target: TARGET, expiresAt: 1_000 + 900_000 });
    expect(view.sandbox).toBe(EMBED_ATTRIBUTES.game.sandbox);
    expect(view.allow).toBe(EMBED_ATTRIBUTES.game.allow);
    expect(s.open("w1", "storybook", "http://localhost:6006/iframe.html?id=a--b", "a").sandbox).toBe(
      EMBED_ATTRIBUTES.storybook.sandbox,
    );
  });

  test("the relay frames the real target without alias", () => {
    const { s } = service();
    const relay = s.relay(tokenOf(s.open("w1", "game", TARGET, "itch.io").url));
    expect(relay?.html).toContain('src="https://itch.io/embed-upload/1?color=333"');
    expect(relay?.headers["content-security-policy"]).toContain("frame-src https://itch.io;");
    expect(relay?.headers["content-security-policy"]).toContain(
      "frame-ancestors http://127.0.0.1:4317 http://localhost:4317 'self';",
    );
  });

  test("a test alias redirects the iframe and its csp to the fake server", () => {
    const { s } = service({ aliases: new Map([["itch.io", new URL("http://127.0.0.1:9999")]]) });
    const relay = s.relay(tokenOf(s.open("w1", "game", TARGET, "itch.io").url));
    expect(relay?.html).toContain('src="http://127.0.0.1:9999/embed-upload/1?color=333"');
    expect(relay?.headers["content-security-policy"]).toContain("frame-src http://127.0.0.1:9999;");
  });

  test("a token answers until it expires, then never again", () => {
    const { s, advance } = service();
    const token = tokenOf(s.open("w1", "game", TARGET, "itch.io").url);
    expect(s.relay(token)).not.toBeNull();
    expect(s.relay(token)).not.toBeNull();
    advance(899_999);
    expect(s.relay(token)).not.toBeNull();
    advance(1);
    expect(s.relay(token)).toBeNull();
    expect(s.relay("f".repeat(64))).toBeNull();
  });

  test("at most sixteen live tokens per instance, the oldest goes first", () => {
    const { s } = service();
    const first = tokenOf(s.open("w1", "game", TARGET, "itch.io").url);
    for (let i = 0; i < 15; i++) s.open("w1", "game", TARGET, "itch.io");
    expect(s.relay(first)).not.toBeNull();
    const other = tokenOf(s.open("w2", "game", TARGET, "itch.io").url);
    s.open("w1", "game", TARGET, "itch.io");
    expect(s.relay(first)).toBeNull();
    expect(s.relay(other)).not.toBeNull();
  });

  test("the shell keeps up to sixty-four tokens", () => {
    const { s } = service();
    const first = tokenOf(s.open("shell", "storybook", TARGET, "itch.io").url);
    for (let i = 0; i < 63; i++) s.open("shell", "storybook", TARGET, "itch.io");
    expect(s.relay(first)).not.toBeNull();
    s.open("shell", "storybook", TARGET, "itch.io");
    expect(s.relay(first)).toBeNull();
  });

  test("without a sandbox server nothing is minted", () => {
    const { s } = service({ sandbox: null });
    expect(() => s.open("w1", "game", TARGET, "itch.io")).toThrow("INTERNAL");
  });
});
