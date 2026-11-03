import { beforeEach, expect, test } from "bun:test";
import { REQUEST_CLOCK_REFUSAL } from "@kibo/remote";
import { KiboError } from "@kibo/schema";
import { client } from "@kibo/ui/api";
import { act, render, screen, waitFor, within } from "@testing-library/react";
import { App } from "./App";
import { phoneFixture } from "./app-test-kit";
import { formatClock } from "./format-time";
import { testKeys } from "./test-kit";
import { toast } from "./toast";

beforeEach(() => {
  localStorage.clear();
  window.location.hash = "#/p/silo/kanban";
});

test("the tab bar has five tabs in order Graphe, Kanban, Planning, Questions, Dashboard, each label on one line at 390 px", async () => {
  const { runtime } = await phoneFixture();
  render(<App runtime={runtime} />);
  const bar = await screen.findByRole("navigation", { name: "Écrans du projet" });
  const tabs = within(bar).getAllByRole("link");
  expect(tabs.map((t) => t.textContent)).toEqual(["Graphe", "Kanban", "Planning", "Questions", "Dashboard"]);
  expect(bar.className).toContain("grid-cols-5");
  for (const tab of tabs) {
    expect(tab.querySelector("span")?.className).toContain("whitespace-nowrap");
    expect(tab.className).toContain("min-h-14");
  }
  expect(tabs[1]?.getAttribute("aria-current")).toBe("page");
  expect(tabs[0]?.getAttribute("href")).toBe("#/p/silo/graph");
});

test("the header shows the project name, the project picker and the agent button with its count", async () => {
  const { runtime } = await phoneFixture();
  render(<App runtime={runtime} />);
  const header = await screen.findByRole("banner");
  expect(within(header).getByRole("button", { name: /Silo/ }).getAttribute("aria-haspopup")).toBe("dialog");
  expect(within(header).getByText("Kanban")).toBeTruthy();
  const agent = await within(header).findByRole("button", { name: "Agent de projet · 3 en attente" });
  expect(agent.textContent).toContain("3");
});

test("each tab shows the component name and its count until its screen lands", async () => {
  const { runtime } = await phoneFixture();
  render(<App runtime={runtime} />);
  expect(await screen.findByText("Kanban · 2 tickets")).toBeTruthy();
});

test("a write while offline shows the mac-off toast and keeps the screen", async () => {
  const { runtime, api } = await phoneFixture({ connectivity: { macOnline: false, phoneOnline: true } });
  render(<App runtime={runtime} />);
  await screen.findByRole("navigation", { name: "Écrans du projet" });
  expect(screen.getByRole("status").textContent).toContain("Mac éteint · dernier état à");
  await act(async () => {
    await expect(
      client.rpc({ method: "t3.launch", projectId: "silo", ticketKey: "SILO-45" }),
    ).rejects.toMatchObject({
      code: "REMOTE_UNAVAILABLE",
    });
  });
  const toast = await screen.findByRole("alert");
  expect(toast.textContent).toContain("Mac éteint : lancement refusé");
  expect(toast.textContent).toContain("Rien n'est mis en attente. Réessaie Mac allumé.");
  expect(api.calls.filter((c) => c === "request")).toEqual([]);
  expect(screen.getByRole("navigation", { name: "Écrans du projet" })).toBeTruthy();
  expect(window.location.hash).toBe("#/p/silo/kanban");
});

test("a request refused for the clock tells to fix the phone time", async () => {
  const { runtime, api } = await phoneFixture();
  api.reply = () => ({
    ok: false,
    error: { code: "REMOTE_REJECTED", message: REQUEST_CLOCK_REFUSAL },
  });
  render(<App runtime={runtime} />);
  await screen.findByRole("navigation", { name: "Écrans du projet" });
  const command = { method: "setStatus" as const, ticketId: "t1", statusId: "in_progress" as const };
  await act(async () => {
    await expect(client.rpc({ method: "command", projectId: "silo", command })).rejects.toBeDefined();
  });
  expect((await screen.findByRole("alert")).textContent).toContain("Heure du téléphone décalée");
});

test("undecryptable snapshot switches to needs-pairing", async () => {
  const { runtime } = await phoneFixture({ serverKeys: await testKeys(9, 2) });
  render(<App runtime={runtime} />);
  expect(await screen.findByRole("heading", { name: "Appairage à refaire" })).toBeTruthy();
  expect(screen.queryByRole("navigation", { name: "Écrans du projet" })).toBeNull();
  await act(() => new Promise((resolve) => setTimeout(resolve, 50)));
  expect(screen.getAllByRole("heading", { name: "Appairage à refaire" })).toHaveLength(1);
});

test("without a stored key the app opens the pairing screen", async () => {
  const { runtime, storage } = await phoneFixture();
  await storage.keys.clear();
  render(<App runtime={runtime} />);
  expect(await screen.findByRole("heading", { name: "Appairer ce téléphone" })).toBeTruthy();
  await waitFor(() => expect(window.location.hash).toBe("#/pair"));
});

test("without a session the app asks for the passkey", async () => {
  const { runtime, api } = await phoneFixture();
  api.session = async () => false;
  render(<App runtime={runtime} />);
  expect(await screen.findByRole("button", { name: "Se connecter avec une passkey" })).toBeTruthy();
});

test("a rejected sync shows the band with the time of the block", async () => {
  const { runtime, api, keys } = await phoneFixture();
  runtime.keyring.current = keys;
  await runtime.client.sync();
  api.snapshot = async () => {
    throw new KiboError("REMOTE_UNAVAILABLE", "server unreachable");
  };
  render(<App runtime={runtime} />);
  await screen.findByRole("navigation", { name: "Écrans du projet" });
  const band = await screen.findByRole("status");
  expect(band.textContent).toBe(`Mise à jour impossible · dernier état à ${formatClock(1_760_619_120_000)}`);
});

test("a failed sync is tried again when the phone comes back", async () => {
  const { runtime, api, keys, presence } = await phoneFixture();
  runtime.keyring.current = keys;
  await runtime.client.sync();
  const snapshot = api.snapshot;
  api.snapshot = async () => {
    throw new KiboError("REMOTE_UNAVAILABLE", "server unreachable");
  };
  render(<App runtime={runtime} />);
  await screen.findByText(/Mise à jour impossible/);
  api.snapshot = snapshot;
  const resumed: Promise<void>[] = [];
  const sync = runtime.client.sync;
  runtime.client.sync = () => {
    const done = sync();
    resumed.push(done);
    return done;
  };
  await act(async () => {
    presence.handlers?.onResume();
    await Promise.all(resumed);
  });
  expect(resumed).toHaveLength(1);
  expect(screen.queryByText(/Mise à jour impossible/)).toBeNull();
});

test("an event socket that never opens with an expired session asks for the passkey", async () => {
  const { runtime, api, presence } = await phoneFixture();
  render(<App runtime={runtime} />);
  await screen.findByRole("navigation", { name: "Écrans du projet" });
  api.session = async () => false;
  act(() => presence.handlers?.onUnopened());
  expect(await screen.findByRole("button", { name: "Se connecter avec une passkey" })).toBeTruthy();
});

test("a toast.error from a component shows on the phone, without sonner", async () => {
  const { runtime } = await phoneFixture();
  render(<App runtime={runtime} />);
  await screen.findByRole("navigation", { name: "Écrans du projet" });
  act(() => void toast.error("Copie impossible"));
  expect((await screen.findByRole("alert")).textContent).toContain("Copie impossible");
  act(() => window.dispatchEvent(new CustomEvent("kibo:toast", { detail: "Lien copié" })));
  expect(await screen.findByText("Lien copié")).toBeTruthy();
});
