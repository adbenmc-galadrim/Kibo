import { beforeEach, expect, mock, test } from "bun:test";
import { KiboError, type MarketSourceInfo, type RpcRequest } from "@kibo/schema";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { apiMock } from "../api-mock";

const calls: RpcRequest[] = [];
let answers: Partial<Record<RpcRequest["method"], () => Promise<unknown>>> = {};

mock.module("../api", () =>
  apiMock({
    client: {
      rpc: (req: RpcRequest) => {
        calls.push(req);
        const answer = answers[req.method];
        return answer ? answer() : Promise.resolve(null);
      },
      subscribe: () => () => undefined,
    },
  }),
);

const { ComponentSourcesPage } = await import("./ComponentSourcesPage");
const { AddSourceDialog } = await import("../dialogs/AddSourceDialog");

const FP = "c0d538aa7f12e94b06c3d2185ab7f9402e6d81b5c7a03f19d42e9b0671c8e3a5";
const equipe: MarketSourceInfo = {
  id: "equipe",
  name: "Équipe",
  url: "https://sync.kibo.test/market/",
  publicKey: "PK",
  fingerprint: `7b2e91c4${"0".repeat(56)}`,
  lastSerial: 42,
  lastFetchedAt: Date.now() - 5 * 60_000,
  lastError: null,
  enabled: true,
};
const kibo: MarketSourceInfo = {
  ...equipe,
  id: "kibo",
  name: "Kibo",
  url: "https://market.kibo.test/",
  fingerprint: FP,
  lastSerial: 17,
  lastFetchedAt: Date.now() - 26 * 3_600_000,
  lastError: "INDEX_ROLLBACK: serial 3 < 17",
};
const probe = { sourceId: "kibo", name: "Kibo", publicKey: "PK", fingerprint: FP, serial: 17, packages: 6 };
const URL = "https://market.kibo.test/";

beforeEach(() => {
  calls.length = 0;
  answers = {};
});

test("screen 118: title, subtitle and columns; the key fingerprint lives in Details", async () => {
  answers.listMarketSources = () => Promise.resolve([equipe, kibo]);
  render(<ComponentSourcesPage remote={false} />);
  expect(await screen.findByText("Équipe")).toBeTruthy();
  expect(screen.getByRole("heading", { level: 1, name: "Sources de composants" })).toBeTruthy();
  expect(screen.getByRole("link", { name: "Sources de composants" }).getAttribute("aria-current")).toBe(
    "page",
  );
  expect(
    screen.getByText(
      "Les catalogues où tu installes des composants. Chaque catalogue est signé par sa source.",
    ),
  ).toBeTruthy();
  expect(screen.getAllByRole("columnheader").map((h) => h.textContent)).toEqual([
    "Nom",
    "Adresse",
    "Version du catalogue",
    "Mise à jour",
    "État",
    "",
  ]);
  expect(screen.getByText("42")).toBeTruthy();
  expect(screen.getByText("il y a 5 min")).toBeTruthy();
  expect(screen.getByText("hier")).toBeTruthy();
  expect(screen.getByText("À jour")).toBeTruthy();
  expect(screen.getByText("Catalogue refusé : version inférieure à la dernière vue")).toBeTruthy();
  expect(screen.queryByText("7b2e 91c4 …")).toBeNull();
  const row = screen.getByRole("row", { name: /Équipe/ });
  await userEvent.setup().click(within(row).getByRole("button", { name: "Détails" }));
  expect(within(row).getByText("7b2e 91c4 …")).toBeTruthy();
});

test("refreshing a row refreshes only that source; the header refreshes them all", async () => {
  answers.listMarketSources = () => Promise.resolve([equipe]);
  answers.refreshMarketSource = () => Promise.resolve(equipe);
  render(<ComponentSourcesPage remote={false} />);
  const user = userEvent.setup();
  await user.click(await screen.findByRole("button", { name: "Actions Équipe" }));
  await user.click(await screen.findByRole("menuitem", { name: "Rafraîchir cette source" }));
  await waitFor(() => expect(calls.at(-1)).toEqual({ method: "listMarketSources" }));
  expect(calls).toContainEqual({ method: "refreshMarketSource", id: "equipe" });
  expect(calls).not.toContainEqual({ method: "refreshMarket" });
  calls.length = 0;
  await user.click(screen.getByRole("button", { name: "Tout rafraîchir" }));
  await waitFor(() => expect(calls.at(-1)).toEqual({ method: "listMarketSources" }));
  expect(calls).toContainEqual({ method: "refreshMarket" });
});

test("removing a source is confirmed, Cancel sends nothing, then it waits for the daemon", async () => {
  answers.listMarketSources = () => Promise.resolve([equipe]);
  let finish: (v: null) => void = () => {};
  answers.removeMarketSource = () =>
    new Promise((resolve) => {
      finish = resolve;
    });
  render(<ComponentSourcesPage remote={false} />);
  const user = userEvent.setup();
  await user.click(await screen.findByRole("button", { name: "Actions Équipe" }));
  await user.click(await screen.findByRole("menuitem", { name: "Retirer…" }));
  const dialog = await screen.findByRole("alertdialog", { name: "Retirer la source Équipe ?" });
  expect(within(dialog).getByText(/Kibo reconnaîtra ses éditeurs/)).toBeTruthy();
  await user.click(within(dialog).getByRole("button", { name: "Annuler" }));
  await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
  expect(calls.some((c) => c.method === "removeMarketSource")).toBe(false);
  await user.click(screen.getByRole("button", { name: "Actions Équipe" }));
  await user.click(await screen.findByRole("menuitem", { name: "Retirer…" }));
  const again = await screen.findByRole("alertdialog", { name: "Retirer la source Équipe ?" });
  await user.click(within(again).getByRole("button", { name: "Retirer" }));
  expect(await screen.findByText("Retrait…")).toBeTruthy();
  expect(calls).toContainEqual({ method: "removeMarketSource", id: "equipe" });
  answers.listMarketSources = () => Promise.resolve([]);
  finish(null);
  expect(await screen.findByText("Aucune source pour l'instant.")).toBeTruthy();
});

test("a refused removal stays in the confirmation", async () => {
  answers.listMarketSources = () => Promise.resolve([equipe]);
  answers.removeMarketSource = () => Promise.reject(new KiboError("FORBIDDEN", "x"));
  render(<ComponentSourcesPage remote={false} />);
  const user = userEvent.setup();
  await user.click(await screen.findByRole("button", { name: "Actions Équipe" }));
  await user.click(await screen.findByRole("menuitem", { name: "Retirer…" }));
  const dialog = await screen.findByRole("alertdialog", { name: "Retirer la source Équipe ?" });
  await user.click(within(dialog).getByRole("button", { name: "Retirer" }));
  expect((await within(dialog).findByRole("alert")).textContent).toBe(
    "Cette action n'est possible que depuis l'ordinateur où tourne Kibo.",
  );
  expect(screen.getByRole("alertdialog")).toBeTruthy();
});

test("a refused refresh is explained in French", async () => {
  answers.listMarketSources = () => Promise.resolve([equipe]);
  answers.refreshMarketSource = () => Promise.reject(new KiboError("TIMEOUT", "x"));
  render(<ComponentSourcesPage remote={false} />);
  const user = userEvent.setup();
  await user.click(await screen.findByRole("button", { name: "Actions Équipe" }));
  await user.click(await screen.findByRole("menuitem", { name: "Rafraîchir cette source" }));
  expect((await screen.findByRole("alert")).textContent).toBe("La source ne répond pas.");
});

test("a remote session can refresh but not add nor remove a source", async () => {
  answers.listMarketSources = () => Promise.resolve([equipe]);
  render(<ComponentSourcesPage remote />);
  expect(
    await screen.findByText(
      "Ajouter ou retirer une source n'est possible que depuis l'ordinateur où tourne Kibo.",
    ),
  ).toBeTruthy();
  expect(screen.getByRole("button", { name: "Ajouter une source" }).hasAttribute("disabled")).toBe(true);
  expect(screen.getByRole("button", { name: "Tout rafraîchir" }).hasAttribute("disabled")).toBe(false);
  await userEvent.setup().click(screen.getByRole("button", { name: "Actions Équipe" }));
  expect((await screen.findByRole("menuitem", { name: "Retirer…" })).getAttribute("aria-disabled")).toBe(
    "true",
  );
  expect(
    screen.getByRole("menuitem", { name: "Rafraîchir cette source" }).getAttribute("aria-disabled"),
  ).toBeNull();
});

test("adding a source shows the full fingerprint before confirming", async () => {
  answers.probeMarketSource = () => Promise.resolve(probe);
  answers.addMarketSource = () => Promise.resolve(kibo);
  const onAdded = mock(() => {});
  render(<AddSourceDialog open onOpenChange={() => {}} onAdded={onAdded} />);
  const user = userEvent.setup();
  expect(screen.getByText("HTTPS uniquement.")).toBeTruthy();
  await user.type(screen.getByLabelText("Adresse"), URL);
  await user.click(screen.getByRole("button", { name: "Suivant" }));
  expect(
    await screen.findByText("https://market.kibo.test/ · version du catalogue n° 17 · 6 paquets"),
  ).toBeTruthy();
  expect((screen.getByLabelText("Nom de la source") as HTMLInputElement).value).toBe("Kibo");
  const key = screen.getByRole("group", { name: "Empreinte de la clé" });
  expect(within(key).getByText("c0d5 38aa 7f12 e94b 06c3 d218 5ab7 f940")).toBeTruthy();
  expect(within(key).getByText("2e6d 81b5 c7a0 3f19 d42e 9b06 71c8 e3a5")).toBeTruthy();
  expect(
    screen.getByText("Compare cette empreinte avec celle communiquée par l'éditeur de la source"),
  ).toBeTruthy();
  await user.click(screen.getByRole("button", { name: "Ajouter" }));
  await waitFor(() => expect(onAdded).toHaveBeenCalled());
  expect(calls.at(-1)).toEqual({ method: "addMarketSource", url: URL, publicKey: "PK" });
});

test("going back returns to the address step without adding anything", async () => {
  answers.probeMarketSource = () => Promise.resolve(probe);
  render(<AddSourceDialog open onOpenChange={() => {}} onAdded={() => {}} />);
  const user = userEvent.setup();
  await user.type(screen.getByLabelText("Adresse"), URL);
  await user.click(screen.getByRole("button", { name: "Suivant" }));
  await user.click(await screen.findByRole("button", { name: "Retour" }));
  expect((screen.getByLabelText("Adresse") as HTMLInputElement).value).toBe(URL);
  expect(calls.some((c) => c.method === "addMarketSource")).toBe(false);
});

test("a probe failure is explained on the first step", async () => {
  answers.probeMarketSource = () => Promise.reject(new KiboError("TLS_REQUIRED", "x"));
  render(<AddSourceDialog open onOpenChange={() => {}} onAdded={() => {}} />);
  const user = userEvent.setup();
  await user.type(screen.getByLabelText("Adresse"), "http://example.com/");
  await user.click(screen.getByRole("button", { name: "Suivant" }));
  expect((await screen.findByRole("alert")).textContent).toBe("Adresse non chiffrée : utilise https://.");
});
