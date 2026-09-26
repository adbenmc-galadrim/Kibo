import { expect, test } from "bun:test";
import type { ProjectCommand } from "@kibo/schema";
import { SdkProvider } from "@kibo/sdk";
import { runConformance } from "@kibo/sdk/conformance";
import { createMockSdk } from "@kibo/sdk/mock";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { defaultMcpSourceConfig } from "./config";
import { Component, manifest } from "./index";

const items = {
  items: [
    { id: "a1", name: "Premier", detail: "Élément un", link: "https://example.com/a1" },
    { id: "a2", name: "Second", detail: "Élément deux", link: "javascript:alert(1)" },
  ],
};
const mcp = {
  "ctx/list_items": {
    content: [{ type: "text" as const, text: JSON.stringify(items) }],
    isError: false,
    truncated: false,
  },
};
const config = defaultMcpSourceConfig("ctx");
const seed = (_run: (cmd: ProjectCommand) => unknown) => undefined;

runConformance({ manifest, Component }, seed, { config, mcp });

const setup = (opts: Partial<Parameters<typeof createMockSdk>[1]> = {}) => {
  const m = createMockSdk(manifest, { config, mcp, ...opts });
  render(
    <SdkProvider sdk={m.sdk}>
      <Component />
    </SdkProvider>,
  );
  return m;
};

test("lists the items and creates a ticket once per item", async () => {
  const m = setup();
  expect(await screen.findByText("Premier")).toBeTruthy();
  expect(screen.getByRole("link", { name: "Premier" }).getAttribute("href")).toBe("https://example.com/a1");
  expect(screen.queryByRole("link", { name: "Second" })).toBeNull();
  const user = userEvent.setup();
  await user.click(screen.getAllByRole("button", { name: "Créer un ticket" })[0] as HTMLElement);
  expect(await screen.findByText("KIB-1")).toBeTruthy();
  expect(screen.getAllByRole("button", { name: "Créer un ticket" })).toHaveLength(1);
  expect(m.used).toEqual(expect.arrayContaining(["mcp:ctx/list_items", "mcp:ctx"]));
});

test("an unreachable server is stated, not thrown", async () => {
  setup({ mcp: {} });
  expect(await screen.findByRole("alert")).toBeTruthy();
});

test("a missing configuration asks to configure", async () => {
  setup({ config: {} });
  expect(await screen.findByText("Configure la source dans les réglages du composant.")).toBeTruthy();
});
