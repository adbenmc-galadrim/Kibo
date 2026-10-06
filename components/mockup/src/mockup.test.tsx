import { expect, test } from "bun:test";
import { SdkProvider } from "@kibo/sdk";
import { runConformance } from "@kibo/sdk/conformance";
import { seedDemo } from "@kibo/sdk/fixtures";
import { createMockSdk, type MockFrame, type MockSdk, type MockSdkOptions } from "@kibo/sdk/mock";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { fr } from "./fr";
import { frProblems } from "./fr-problems";
import { Component, manifest } from "./index";

runConformance({ manifest, Component }, seedDemo, { config: { frame: [], fit: "contain" } });

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
  expect(img.getAttribute("crossorigin")).toBe("anonymous");
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

const problemText = (role: "status" | "alert") =>
  waitFor(() => {
    const text = screen.getByRole(role).querySelector("p")?.textContent;
    if (text === undefined) throw new Error("no problem shown yet");
    return text;
  });

const OTHER = "https://www.figma.com/design/AbC123xyz/Kibo?node-id=56-78";
const TWO: MockFrame[] = [
  { url: FRAME, name: "Tickets" },
  { url: OTHER, name: "Réglages" },
];
const mountList = (frames: unknown, mocks: MockFrame[] = TWO) => {
  const m = createMockSdk(manifest, {
    config: { frame: frames, fit: "contain" },
    frames: mocks,
    seed: seedDemo,
  });
  render(
    <SdkProvider sdk={m.sdk}>
      <Component />
    </SdkProvider>,
  );
  return m;
};

test("several frames: buttons and arrow keys navigate, the counter follows", async () => {
  const m = mountList([FRAME, OTHER]);
  await screen.findByRole("img", { name: "Tickets" });
  expect(screen.getByText("1 / 2")).toBeTruthy();
  expect(screen.getByRole("button", { name: "Cadre précédent" }).hasAttribute("disabled")).toBe(true);
  fireEvent.click(screen.getByRole("button", { name: "Cadre suivant" }));
  expect(await screen.findByRole("img", { name: "Réglages" })).toBeTruthy();
  expect(screen.getByText("2 / 2")).toBeTruthy();
  fireEvent.keyDown(screen.getByRole("group", { name: /Aperçu de Réglages/ }), { key: "ArrowLeft" });
  expect(await screen.findByRole("img", { name: "Tickets" })).toBeTruthy();
  expect(m.used).toContain("cap:fullscreen");
  expect(screen.queryByRole("button", { name: /plein écran/i })).toBeNull();
  expect(m.violations).toEqual([]);
  cleanup();
});

test("a legacy single string still shows and has no navigation", async () => {
  mountList(FRAME);
  await screen.findByRole("img", { name: "Tickets" });
  expect(screen.queryByRole("group", { name: "Cadres" })).toBeNull();
  cleanup();
});

test("a degraded list still shows its valid frames and skips a bad one", async () => {
  mountList([FRAME, "", "https://example.com/nope", 42]);
  await screen.findByRole("img", { name: "Tickets" });
  expect(screen.getByText("1 / 2")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Cadre suivant" }));
  expect(await problemText("alert")).toBe("Maquette indisponible (INVALID_INPUT).");
  expect(screen.getByRole("button", { name: "Réessayer" })).toBeTruthy();
  cleanup();
});

test("zoom buttons, keys and double click change the scale, a new frame resets it", async () => {
  mountList([FRAME, OTHER]);
  await screen.findByRole("img", { name: "Tickets" });
  expect(screen.getByText("100 %")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Zoom avant" }));
  expect(screen.getByText("125 %")).toBeTruthy();
  const viewer = screen.getByRole("group", { name: /Aperçu de Tickets/ });
  fireEvent.keyDown(viewer, { key: "+" });
  expect(screen.getByText("156 %")).toBeTruthy();
  fireEvent.doubleClick(viewer);
  expect(screen.getByText("100 %")).toBeTruthy();
  fireEvent.doubleClick(viewer);
  expect(screen.getByText("200 %")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Ajuster" }));
  expect(screen.getByText("100 %")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Zoom arrière" }));
  expect(screen.getByText("80 %")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Cadre suivant" }));
  await screen.findByRole("img", { name: "Réglages" });
  expect(screen.getByText("100 %")).toBeTruthy();
  cleanup();
});

test("a frame without dimensions renders and zooms", async () => {
  mountList([FRAME], [{ url: FRAME, name: "Tickets", width: undefined, height: undefined }]);
  const img = await screen.findByRole("img", { name: "Tickets" });
  expect(img.getAttribute("style") ?? "").not.toContain("NaN");
  fireEvent.click(screen.getByRole("button", { name: "Zoom avant" }));
  expect(screen.getByText("125 %")).toBeTruthy();
  expect(img.getAttribute("style") ?? "").not.toContain("NaN");
  cleanup();
});

test("refresh spins the icon and disables the button until the frame is back", async () => {
  const m = mountList([FRAME]);
  await screen.findByRole("img", { name: "Tickets" });
  const pending: { release(): void } = { release: () => {} };
  const real = m.sdk.design.frame;
  m.sdk.design.frame = (url, opts) =>
    new Promise((resolve) => {
      pending.release = () => resolve(real(url, opts));
    });
  const button = screen.getByRole("button", { name: fr.refresh });
  fireEvent.click(button);
  expect(button.getAttribute("aria-busy")).toBe("true");
  expect(button.hasAttribute("disabled")).toBe(true);
  const icon = button.querySelector("svg");
  expect(icon?.classList.contains("animate-spin")).toBe(true);
  expect(icon?.classList.contains("motion-reduce:animate-none")).toBe(true);
  expect(screen.getByRole("img", { name: "Tickets" })).toBeTruthy();
  pending.release();
  await waitFor(() => expect(button.hasAttribute("disabled")).toBe(false));
  expect(button.querySelector("svg")?.classList.contains("animate-spin")).toBe(false);
  cleanup();
});

test("each failure names its cause and offers a retry", async () => {
  mountList([PENPOT_FRAME], [{ url: PENPOT_FRAME, name: "Accueil", error: "REMOTE_NOT_RENDERED" }]);
  expect(await problemText("status")).toBe(
    frProblems.noThumbnail({ provider: "penpot", name: "Penpot", host: "", code: "" }),
  );
  cleanup();
  mountList([PENPOT_FRAME], [{ url: PENPOT_FRAME, name: "Accueil", error: "REMOTE_REJECTED" }]);
  expect(await problemText("alert")).toBe(
    "Penpot a refusé le jeton. Reconnecte Penpot dans Paramètres › Intégrations.",
  );
  cleanup();
  mountList([PENPOT_FRAME], [{ url: PENPOT_FRAME, name: "Accueil", error: "PERMISSION_DENIED" }]);
  expect(await problemText("alert")).toBe(
    "Ce board est sur une autre instance Penpot (design.penpot.app) que celle connectée.",
  );
  cleanup();
  mountList([FRAME], [{ url: FRAME, name: "Tickets", error: "TIMEOUT" }]);
  expect(await problemText("alert")).toBe(
    "Figma ne répond pas. Vérifie ta connexion, ou que l'instance est démarrée.",
  );
  expect(screen.getByRole("button", { name: "Réessayer" })).toBeTruthy();
  cleanup();
});

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
  expect(await problemText("status")).toBe("Connecte Penpot dans Paramètres › Intégrations.");
  cleanup();
});

test("an invalid frame url is reported as unavailable", async () => {
  mount("https://example.com/nope");
  expect(await problemText("alert")).toBe("Maquette indisponible (INVALID_INPUT).");
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
