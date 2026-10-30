import { expect, test } from "bun:test";
import { EMBED_ATTRIBUTES, EmbedView } from "./embed";

test("no embed kind may navigate the top window, open popups or download", () => {
  for (const attributes of Object.values(EMBED_ATTRIBUTES)) {
    for (const flag of ["allow-top-navigation", "allow-popups", "allow-modals", "allow-downloads"]) {
      expect(attributes.sandbox).not.toContain(flag);
    }
    expect(attributes.allow).toContain("fullscreen 'none'");
  }
  expect(EMBED_ATTRIBUTES.storybook.sandbox).toBe("allow-scripts allow-same-origin allow-forms");
});

test("an embed view is parsed", () => {
  const view = {
    url: `http://127.0.0.1:4100/e/${"a".repeat(64)}`,
    kind: "storybook" as const,
    sandbox: EMBED_ATTRIBUTES.storybook.sandbox,
    allow: EMBED_ATTRIBUTES.storybook.allow,
    expiresAt: 900_000,
    target: "https://itch.io/embed-upload/1",
  };
  expect(EmbedView.parse(view)).toEqual(view);
  expect(EmbedView.safeParse({ ...view, kind: "video" }).success).toBe(false);
});
