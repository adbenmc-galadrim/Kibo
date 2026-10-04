import { expect, test } from "bun:test";
import { SdkProvider } from "@kibo/sdk";
import { runConformance } from "@kibo/sdk/conformance";
import { seedDemo } from "@kibo/sdk/fixtures";
import { createMockSdk, type MockFrame, type MockSdk, type MockSdkOptions } from "@kibo/sdk/mock";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
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

const spyFrames = (m: MockSdk) => {
  const asked: { url: string; refresh: boolean | undefined }[] = [];
  const frame = m.sdk.design.frame;
  m.sdk.design.frame = (url, opts) => {
    asked.push({ url, refresh: opts?.refresh });
    return frame(url, opts);
  };
  return asked;
};

const mountSpied = (frame: string, frames: MockFrame[]) => {
  const m = createMockSdk(manifest, { config: { frame, fit: "contain" }, frames, seed: seedDemo });
  const asked = spyFrames(m);
  const view = () => (
    <SdkProvider sdk={m.sdk}>
      <Component />
    </SdkProvider>
  );
  const { rerender } = render(view());
  return { m, asked, rerender: () => rerender(view()) };
};

test("stale and offline frames show their badges, refresh asks the daemon again", async () => {
  const { asked } = mountSpied(FRAME, [{ url: FRAME, name: "Tickets", stale: true, reachable: false }]);
  expect(await screen.findByText(fr.stale)).toBeTruthy();
  expect(await screen.findByText(fr.offline)).toBeTruthy();
  expect(asked).toEqual([{ url: FRAME, refresh: false }]);
  fireEvent.click(screen.getByRole("button", { name: fr.refresh }));
  await waitFor(() => expect(asked.at(-1)).toEqual({ url: FRAME, refresh: true }));
  expect(await screen.findByRole("img", { name: "Tickets" })).toBeTruthy();
  cleanup();
});

test("another frame after a refresh loads afresh without refresh", async () => {
  const OTHER = "https://www.figma.com/design/AbC123xyz/Kibo?node-id=56-78";
  const { m, asked, rerender } = mountSpied(FRAME, [
    { url: FRAME, name: "Tickets" },
    { url: OTHER, name: "Réglages" },
  ]);
  await screen.findByRole("img", { name: "Tickets" });
  fireEvent.click(screen.getByRole("button", { name: fr.refresh }));
  await waitFor(() => expect(asked.at(-1)?.refresh).toBe(true));
  m.sdk.config.frame = OTHER;
  rerender();
  expect(screen.queryByRole("img", { name: "Tickets" })).toBeNull();
  expect(screen.getByText(fr.loading)).toBeTruthy();
  expect(await screen.findByRole("img", { name: "Réglages" })).toBeTruthy();
  expect(asked.at(-1)).toEqual({ url: OTHER, refresh: false });
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
