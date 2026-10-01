import { beforeEach, expect, mock, test } from "bun:test";
import { EMPTY_TABS, KiboError, type RpcRequest, type Session } from "@kibo/schema";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

const adam: Session = { user: "adam", notifications: "browser" };
let session: () => Promise<Session> = () => Promise.resolve(adam);
let sessionCalls = 0;

mock.module("./api", () => ({
  client: {
    rpc: (req: RpcRequest) => {
      if (req.method === "getSession") {
        sessionCalls += 1;
        return session();
      }
      if (req.method === "listProjects") return Promise.resolve([]);
      if (req.method === "getTabs") return Promise.resolve(EMPTY_TABS);
      return Promise.resolve(null);
    },
    pair: () => Promise.resolve(),
    code: () => Promise.resolve(null),
    subscribe: () => () => {},
    subscribeTopic: () => () => {},
    online: () => true,
    onConnection: () => () => {},
    subscribeCode: () => () => {},
    subscribeEvents: () => () => {},
    subscribeAi: () => () => {},
    subscribeIntegrations: () => () => {},
  },
  onUnauthorized: () => () => {},
}));

const unmockedApp = "./App?unmocked";
const { App }: typeof import("./App") = await import(unmockedApp);

beforeEach(() => {
  session = () => Promise.resolve(adam);
  sessionCalls = 0;
  location.hash = "";
});

test("a network failure shows « Kibo ne répond pas » with retry, then the shell once the daemon answers", async () => {
  session = () => Promise.reject(new TypeError("Failed to fetch"));
  render(<App retryMs={60_000} />);
  expect(await screen.findByRole("heading", { name: "Kibo ne répond pas" })).toBeTruthy();
  expect(screen.getByText(/Vérifie que Kibo tourne/)).toBeTruthy();
  session = () => Promise.resolve(adam);
  fireEvent.click(screen.getByRole("button", { name: "Réessayer" }));
  expect(await screen.findByRole("tablist", { name: "Onglets" })).toBeTruthy();
  expect(screen.queryByRole("heading", { name: "Kibo ne répond pas" })).toBeNull();
});

test("UNAUTHORIZED still leads to pairing", async () => {
  session = () => Promise.reject(new KiboError("UNAUTHORIZED", "no cookie"));
  render(<App retryMs={60_000} />);
  expect(await screen.findByRole("button", { name: "Appairer" })).toBeTruthy();
});

test("another daemon error is shown with retry, never a blank screen", async () => {
  session = () => Promise.reject(new KiboError("MIGRATION_FAILED", "schema v3"));
  render(<App retryMs={60_000} />);
  expect(await screen.findByRole("heading", { name: "Kibo n'a pas pu s'ouvrir" })).toBeTruthy();
  expect(screen.getByText(/La migration de la configuration a échoué/)).toBeTruthy();
  expect(screen.getByRole("button", { name: "Réessayer" })).toBeTruthy();
});

test("the loading text appears only after 300 ms", async () => {
  session = () => new Promise(() => {});
  render(<App />);
  expect(screen.queryByText("Chargement de Kibo…")).toBeNull();
  await new Promise((r) => setTimeout(r, 100));
  expect(screen.queryByText("Chargement de Kibo…")).toBeNull();
  expect(await screen.findByText("Chargement de Kibo…")).toBeTruthy();
});

test("the automatic retry fires every retryMs while unreachable", async () => {
  session = () => Promise.reject(new TypeError("Failed to fetch"));
  render(<App retryMs={20} />);
  await waitFor(() => expect(sessionCalls).toBeGreaterThanOrEqual(4));
  session = () => Promise.resolve(adam);
  expect(await screen.findByRole("tablist", { name: "Onglets" })).toBeTruthy();
  const settled = sessionCalls;
  await new Promise((r) => setTimeout(r, 80));
  expect(sessionCalls).toBe(settled);
});

test("the countdown follows the injected clock", async () => {
  session = () => Promise.reject(new TypeError("Failed to fetch"));
  let clock = 1_000;
  render(<App now={() => clock} retryMs={60_000} />);
  expect(await screen.findByText("Nouvelle tentative dans 60 s…")).toBeTruthy();
  clock += 58_500;
  expect(await screen.findByText("Nouvelle tentative dans 2 s…", undefined, { timeout: 2_000 })).toBeTruthy();
});
