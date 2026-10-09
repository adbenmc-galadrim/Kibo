import { afterEach, expect, test } from "bun:test";
import { EMBED_ATTRIBUTES, KiboError, type KiboErrorCode } from "@kibo/schema";
import { SdkProvider } from "@kibo/sdk";
import { runConformance } from "@kibo/sdk/conformance";
import { seedDemo } from "@kibo/sdk/fixtures";
import { createMockSdk, type MockSdk, type MockSdkOptions } from "@kibo/sdk/mock";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { fr } from "./fr";
import { Component, manifest } from "./index";

runConformance({ manifest, Component }, seedDemo, { config: { embed: null, page: null } });

const URL_1 = "https://itch.io/embed-upload/1234567?color=333333";
const CODE = `<iframe frameborder="0" src="${URL_1}" allowfullscreen="" width="640" height="380"><a href="https://sigmatronic.itch.io/una-war">Play una-war on itch.io</a></iframe>`;

let online = true;
Object.defineProperty(navigator, "onLine", { configurable: true, get: () => online });

const goOnline = (value: boolean) =>
  act(() => {
    online = value;
    window.dispatchEvent(new Event(value ? "online" : "offline"));
  });

afterEach(() => {
  cleanup();
  online = true;
});

const sdkFor = (embed: string | null, opts: Partial<MockSdkOptions> = {}, page: string | null = null) =>
  createMockSdk(manifest, { config: { embed, page }, ...opts });

const mount = (m: MockSdk) => {
  render(
    <SdkProvider sdk={m.sdk}>
      <Component />
    </SdkProvider>,
  );
  return m;
};

const frame = () => screen.findByTitle(fr.frame);

const failWith = (m: MockSdk, codes: KiboErrorCode[]) => {
  const open = m.sdk.embed.open;
  m.sdk.embed.open = (url) => {
    const code = codes.shift();
    return code ? Promise.reject(new KiboError(code, "mock")) : open(url);
  };
};

test("without a setting the widget asks for the embed code", async () => {
  const m = mount(sdkFor(null));
  expect((await screen.findByRole("status")).textContent).toBe(fr.empty);
  expect(screen.queryByRole("button", { name: fr.retry })).toBeNull();
  expect(m.embedCalls).toEqual([]);
});

test("a refused code shows its cause as an alert, without any call", async () => {
  const m = mount(sdkFor("https://sigmatronic.itch.io/una-war"));
  expect((await screen.findByRole("alert")).textContent).toBe(fr.invalid["page-url"]);
  expect(screen.queryByRole("button", { name: fr.retry })).toBeNull();
  expect(m.embedCalls).toEqual([]);
});

test("a ready game shows the relay frame with the attributes of the view", async () => {
  const m = mount(sdkFor(CODE));
  const iframe = await frame();
  expect(m.embedCalls).toEqual([URL_1]);
  expect(iframe.tagName).toBe("IFRAME");
  expect(iframe.getAttribute("src")).toBe("about:blank#embed-1");
  expect(iframe.getAttribute("sandbox")).toBe(EMBED_ATTRIBUTES.game.sandbox);
  expect(iframe.getAttribute("allow")).toBe(EMBED_ATTRIBUTES.game.allow);
  expect(iframe.getAttribute("referrerpolicy")).toBe("no-referrer");
  expect(screen.getByRole("region", { name: fr.title })).toBeTruthy();
  expect(screen.getByText("Una war")).toBeTruthy();
  expect(screen.getByText(fr.credit)).toBeTruthy();
  const link = screen.getByRole("link", { name: fr.open });
  expect(link.getAttribute("href")).toBe("https://sigmatronic.itch.io/una-war");
  expect(link.getAttribute("rel")).toBe("noreferrer noopener");
  expect(m.used).toEqual(expect.arrayContaining(["cap:embed", "cap:fullscreen"]));
  expect(m.violations).toEqual([]);
});

test("the attributes come from the view, never from the component", async () => {
  const m = sdkFor(URL_1);
  m.sdk.embed.open = async (url) => ({
    url: "about:blank#custom",
    kind: "game",
    sandbox: "allow-scripts",
    allow: "gamepad",
    expiresAt: Date.now() + 60_000,
    target: url,
  });
  mount(m);
  const iframe = await frame();
  expect(iframe.getAttribute("sandbox")).toBe("allow-scripts");
  expect(iframe.getAttribute("allow")).toBe("gamepad");
});

test("without a known page the title is generic and no link is shown", async () => {
  mount(sdkFor(URL_1));
  await frame();
  expect(screen.getByText(fr.title, { selector: "p" })).toBeTruthy();
  expect(screen.queryByRole("link", { name: fr.open })).toBeNull();
});

test("the page setting wins over the link of the code", async () => {
  mount(sdkFor(CODE, {}, "https://autre.itch.io/mon-jeu"));
  await frame();
  expect(screen.getByText("Mon jeu")).toBeTruthy();
  expect(screen.getByRole("link", { name: fr.open }).getAttribute("href")).toBe(
    "https://autre.itch.io/mon-jeu",
  );
});

test("offline: the message shows at once without any call, back online the frame is asked", async () => {
  online = false;
  const m = mount(sdkFor(URL_1));
  expect((await screen.findByRole("alert")).textContent).toContain(fr.problem.offline());
  expect(m.embedCalls).toEqual([]);
  fireEvent.click(screen.getByRole("button", { name: fr.retry }));
  expect(m.embedCalls).toEqual([]);
  goOnline(true);
  await frame();
  expect(m.embedCalls).toEqual([URL_1]);
});

test("going offline replaces the game by the message", async () => {
  mount(sdkFor(URL_1));
  await frame();
  goOnline(false);
  expect(screen.getByRole("alert").textContent).toContain(fr.problem.offline());
  expect(screen.queryByTitle(fr.frame)).toBeNull();
});

test("an embed refused by itch.io says so and links to the game page", async () => {
  const m = mount(sdkFor(CODE, { embed: { error: "EMBED_REFUSED" } }));
  expect(await screen.findByText(fr.problem.refused())).toBeTruthy();
  expect(screen.getByRole("alert")).toBeTruthy();
  const links = screen.getAllByRole("link", { name: fr.open });
  expect(links.every((l) => l.getAttribute("href") === "https://sigmatronic.itch.io/una-war")).toBe(true);
  expect(links.length).toBe(2);
  expect(m.embedCalls).toEqual([URL_1]);
});

test("a refused embed without a known page offers no link", async () => {
  mount(sdkFor(URL_1, { embed: { error: "EMBED_REFUSED" } }));
  await screen.findByText(fr.problem.refused());
  expect(screen.queryByRole("link", { name: fr.open })).toBeNull();
});

test("an unreachable itch.io reads like offline and Retry asks again", async () => {
  const m = sdkFor(URL_1);
  failWith(m, ["REMOTE_UNAVAILABLE"]);
  mount(m);
  expect((await screen.findByRole("alert")).textContent).toContain(fr.problem.offline());
  fireEvent.click(screen.getByRole("button", { name: fr.retry }));
  await frame();
  expect(m.embedCalls).toEqual([URL_1]);
});

test("every other daemon error has its own text", async () => {
  const cases: [KiboErrorCode, string][] = [
    ["TIMEOUT", fr.problem.offline()],
    ["REMOTE_NOT_FOUND", fr.problem.notFound()],
    ["RATE_LIMITED", fr.problem.rateLimited()],
    ["PERMISSION_DENIED", "Jeu indisponible (PERMISSION_DENIED)."],
  ];
  for (const [code, text] of cases) {
    mount(sdkFor(URL_1, { embed: { error: code } }));
    expect((await screen.findByRole("alert")).querySelector("p")?.textContent).toBe(text);
    cleanup();
  }
});

test("an expired view at mount asks for a new frame", async () => {
  const m = sdkFor(URL_1);
  const open = m.sdk.embed.open;
  const asked: string[] = [];
  m.sdk.embed.open = async (url) => {
    asked.push(url);
    const view = await open(url);
    return asked.length === 1 ? { ...view, expiresAt: 0 } : view;
  };
  mount(m);
  await waitFor(() => expect(asked.length).toBe(2));
  expect((await frame()).getAttribute("src")).toBe("about:blank#embed-2");
});

test("fullscreen goes through the focus mode and keeps the same frame", async () => {
  const m = mount(sdkFor(URL_1));
  const iframe = await frame();
  expect(screen.getByText(fr.fullscreenHint)).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: fr.fullscreen }));
  expect(m.focusRequests).toEqual([true]);
  act(() => m.setFocus(true));
  expect(screen.getByTitle(fr.frame)).toBe(iframe);
  expect(screen.queryByText(fr.fullscreenHint)).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: fr.exitFullscreen }));
  expect(m.focusRequests).toEqual([true, false]);
  act(() => m.setFocus(false));
  expect(screen.getByTitle(fr.frame)).toBe(iframe);
  expect(m.embedCalls).toEqual([URL_1]);
});

test("without the fullscreen capability there is no fullscreen button", async () => {
  const m = createMockSdk({ ...manifest, capabilities: ["embed"] }, { config: { embed: URL_1, page: null } });
  mount(m);
  await frame();
  expect(screen.queryByRole("button", { name: fr.fullscreen })).toBeNull();
  expect(screen.queryByText(fr.fullscreenHint)).toBeNull();
});
