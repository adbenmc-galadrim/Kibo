import { describe, expect, test } from "bun:test";
import { EMBED_ATTRIBUTES } from "@kibo/schema";
import { relayAncestors, relayHeaders, relayHtml } from "./relay";

const TARGET = "https://itch.io/embed-upload/1?color=333&x=1";

describe("relay page", () => {
  test("holds exactly one iframe with the attributes of its kind and no script", () => {
    for (const kind of ["game", "storybook"] as const) {
      const html = relayHtml({ target: TARGET, kind, title: "itch.io" });
      expect(html.match(/<iframe/g)).toHaveLength(1);
      expect(html).toStartWith("<!doctype html>");
      expect(html).toContain('<meta charset="utf-8">');
      expect(html).toContain(`sandbox="${EMBED_ATTRIBUTES[kind].sandbox}"`);
      expect(html).toContain(`allow="${EMBED_ATTRIBUTES[kind].allow.replaceAll("'", "&#39;")}"`);
      expect(html).toContain('referrerpolicy="no-referrer"');
      expect(html).toContain('src="https://itch.io/embed-upload/1?color=333&amp;x=1"');
      expect(html.toLowerCase()).not.toContain("<script");
    }
  });

  test("escapes the title and the target so they cannot leave their attribute", () => {
    const html = relayHtml({
      target: 'https://itch.io/embed-upload/1?a="><script>',
      kind: "game",
      title: '"><script>alert(1)</script>',
    });
    expect(html.toLowerCase()).not.toContain("<script");
    expect(html).toContain('title="&quot;&gt;&lt;script&gt;alert(1)&lt;/script&gt;"');
    expect(html.match(/<iframe/g)).toHaveLength(1);
  });
});

describe("relay headers", () => {
  test("the csp frames only the target origin and is framed by the interface", () => {
    const ancestors = relayAncestors(
      ["http://127.0.0.1:4317", "http://localhost:4317"],
      ["http://localhost:5173"],
    );
    expect(ancestors).toEqual([
      "http://127.0.0.1:4317",
      "http://localhost:4317",
      "'self'",
      "http://localhost:5173",
    ]);
    const headers = relayHeaders({ targetOrigin: "https://itch.io", ancestors, kind: "game" });
    expect(headers["content-security-policy"]).toBe(
      "default-src 'none'; style-src 'unsafe-inline'; frame-src https://itch.io; " +
        "frame-ancestors http://127.0.0.1:4317 http://localhost:4317 'self' http://localhost:5173; " +
        "base-uri 'none'; form-action 'none'",
    );
    expect(headers).toMatchObject({
      "x-content-type-options": "nosniff",
      "referrer-policy": "no-referrer",
      "cross-origin-resource-policy": "same-site",
      "cache-control": "no-store",
    });
  });

  test("the permissions policy follows the allow attribute of the kind", () => {
    const game = relayHeaders({ targetOrigin: "https://itch.io", ancestors: [], kind: "game" });
    expect(game["permissions-policy"]).toBe(
      'gamepad=(self "https://itch.io"), autoplay=(self "https://itch.io"), pointer-lock=(self "https://itch.io"), ' +
        "fullscreen=(), camera=(), microphone=(), geolocation=()",
    );
    const story = relayHeaders({ targetOrigin: "http://localhost:6006", ancestors: [], kind: "storybook" });
    expect(story["permissions-policy"]).toBe(
      "fullscreen=(), camera=(), microphone=(), geolocation=(), gamepad=(), autoplay=()",
    );
  });
});
