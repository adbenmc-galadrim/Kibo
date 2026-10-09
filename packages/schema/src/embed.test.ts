import { expect, test } from "bun:test";
import fc from "fast-check";
import { EMBED_ATTRIBUTES, EMBED_URL_MAX, EmbedView, embedTargetProblem } from "./embed";

const ITCH = ["itch.io"];

test("no embed kind may navigate the top window, open popups or download", () => {
  for (const attributes of Object.values(EMBED_ATTRIBUTES)) {
    for (const flag of ["allow-top-navigation", "allow-popups", "allow-modals", "allow-downloads"]) {
      expect(attributes.sandbox).not.toContain(flag);
    }
    expect(attributes.allow).toContain("fullscreen 'none'");
  }
  expect(EMBED_ATTRIBUTES.game.sandbox).toBe("allow-scripts allow-same-origin allow-pointer-lock");
  expect(EMBED_ATTRIBUTES.storybook.sandbox).toBe("allow-scripts allow-same-origin allow-forms");
});

test("an embed target is https, on a declared host, without credentials nor port", () => {
  expect(embedTargetProblem("https://itch.io/embed-upload/1?color=333", ITCH)).toBeNull();
  expect(embedTargetProblem("http://itch.io/embed-upload/1", ITCH)).toBe("insecure");
  expect(embedTargetProblem("https://user:pw@itch.io/embed-upload/1", ITCH)).toBe("credentials");
  expect(embedTargetProblem("https://itch.io:8443/embed-upload/1", ITCH)).toBe("port");
  expect(embedTargetProblem("https://www.itch.io/embed-upload/1", ITCH)).toBe("host-not-declared");
  expect(embedTargetProblem("https://itch.io.evil.example/x", ITCH)).toBe("host-not-declared");
  expect(embedTargetProblem("https://html.itch.zone/html/1/index.html", ITCH)).toBe("host-not-declared");
  expect(embedTargetProblem("https://itch.io/x", [])).toBe("host-not-declared");
  expect(embedTargetProblem("pas une url", ITCH)).toBe("not-a-url");
  expect(embedTargetProblem(`https://itch.io/${"a".repeat(EMBED_URL_MAX)}`, ITCH)).toBe("not-a-url");
});

test("an embed view is parsed", () => {
  const view = {
    url: `http://127.0.0.1:4100/e/${"a".repeat(64)}`,
    kind: "game" as const,
    sandbox: EMBED_ATTRIBUTES.game.sandbox,
    allow: EMBED_ATTRIBUTES.game.allow,
    expiresAt: 900_000,
    target: "https://itch.io/embed-upload/1",
  };
  expect(EmbedView.parse(view)).toEqual(view);
  expect(EmbedView.safeParse({ ...view, kind: "video" }).success).toBe(false);
});

test("a declared host passes, any subdomain of it does not (property)", () => {
  fc.assert(
    fc.property(fc.domain(), fc.webPath(), (host, path) => {
      expect(embedTargetProblem(`https://${host}/${path.replace(/^\//, "")}`, [host])).toBeNull();
      expect(embedTargetProblem(`https://x.${host}/${path.replace(/^\//, "")}`, [host])).toBe(
        "host-not-declared",
      );
    }),
  );
});
