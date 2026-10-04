import { expect, test } from "bun:test";
import { SdkProvider } from "@kibo/sdk";
import { runConformance } from "@kibo/sdk/conformance";
import { seedDemo } from "@kibo/sdk/fixtures";
import { createMockSdk, type MockSdkOptions } from "@kibo/sdk/mock";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { fr } from "./fr";
import { Component, manifest } from "./index";

runConformance({ manifest, Component }, seedDemo, { config: { frame: null, fit: "contain" } });

const FRAME = "https://www.figma.com/design/AbC123xyz/Kibo?node-id=12-34";
const PENPOT_FRAME =
  "https://design.penpot.app/#/view/33333333-3333-4333-8333-333333333333?page-id=44444444-4444-4444-8444-444444444444&board-id=55555555-5555-4555-8555-555555555555";

const mount = (frame: string | null, opts: Partial<MockSdkOptions> = {}) => {
  const m = createMockSdk(manifest, {
    config: { frame, fit: "contain" },
    frames: [{ url: FRAME, name: "Tickets", width: 1440, height: 900 }],
    seed: seedDemo,
    ...opts,
  });
  render(
    <SdkProvider sdk={m.sdk}>
      <Component />
    </SdkProvider>,
  );
  return m;
};

test("without a frame the widget asks for one", async () => {
  mount(null);
  expect(await screen.findByText(fr.empty)).toBeTruthy();
  cleanup();
});

test("a known frame renders its image, name and provider", async () => {
  const m = mount(FRAME);
  const img = await screen.findByRole("img", { name: "Tickets" });
  expect(img.getAttribute("src")?.startsWith("data:image/png")).toBe(true);
  expect(await screen.findByText("Figma")).toBeTruthy();
  expect(screen.getByRole("link", { name: fr.open("figma") }).getAttribute("href")).toBe(FRAME);
  expect(await screen.findByText(fr.noLinked)).toBeTruthy();
  expect(m.used).toContain("cap:design");
  expect(m.used).toContain("read:ticket");
  expect(m.violations).toEqual([]);
  cleanup();
});

test("stale and offline frames show their badges, refresh asks again", async () => {
  mount(FRAME, { frames: [{ url: FRAME, name: "Tickets", stale: true, reachable: false }] });
  expect(await screen.findByText(fr.stale)).toBeTruthy();
  expect(await screen.findByText(fr.offline)).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: fr.refresh }));
  expect(await screen.findByRole("img", { name: "Tickets" })).toBeTruthy();
  cleanup();
});

test("a frame from an unconnected provider explains what to do", async () => {
  mount(PENPOT_FRAME);
  expect(await screen.findByText(fr.notConnected)).toBeTruthy();
  cleanup();
});

test("an invalid frame url is reported as unavailable", async () => {
  mount("https://example.com/nope");
  expect((await screen.findByRole("alert")).textContent).toBe(fr.failed);
  cleanup();
});

test("tickets linked to the frame are listed and open the sheet", async () => {
  const m = mount(FRAME, {
    seed: (run) => {
      seedDemo(run);
      const t = run({ method: "createTicket", title: "Lié" }) as { id: string };
      run({
        method: "upsertExternalRef",
        ticketId: t.id,
        ref: { kind: "figma_node", fileKey: "AbC123xyz", nodeId: "12:34", url: FRAME, name: "Tickets" },
      });
    },
  });
  const chip = await screen.findByRole("button", { name: /KIB-\d+ · Lié/ });
  fireEvent.click(chip);
  expect(m.opened).toHaveLength(1);
  cleanup();
});
