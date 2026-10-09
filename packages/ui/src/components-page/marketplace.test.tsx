import { beforeEach, expect, mock, test } from "bun:test";
import {
  KiboError,
  type MarketHit,
  type MarketInstallResult,
  type MarketPackageDetail,
  type MarketSourceInfo,
  NO_PERMISSIONS,
  type RpcRequest,
} from "@kibo/schema";
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
        return answer ? answer() : Promise.resolve([]);
      },
      subscribe: () => () => undefined,
    },
  }),
);

const { MarketplaceTab } = await import("./MarketplaceTab");
const { MarketPackageSheet } = await import("./MarketPackageSheet");

const source: MarketSourceInfo = {
  id: "equipe",
  name: "Équipe",
  url: "https://market.kibo.test/",
  publicKey: "PK",
  fingerprint: "3f9a".repeat(16),
  lastSerial: 42,
  lastFetchedAt: 1,
  lastError: null,
  enabled: true,
};
const hit: MarketHit = {
  sourceId: "equipe",
  sourceName: "Équipe",
  id: "sprint-review",
  title: "Revue de sprint",
  description: "Résumé de sprint : terminés, reportés, bloqués.",
  kind: "view",
  latest: "0.1.2",
  publisher: { name: "Léa", publicKey: "LEA", verified: false },
  installed: null,
  updateAvailable: null,
};
const burndown: MarketHit = {
  ...hit,
  id: "burndown",
  title: "Burndown",
  kind: "widget",
  latest: "0.4.0",
  publisher: { name: "Léa", publicKey: "LEA", verified: true },
  installed: "0.3.0",
};
const reads = { ...NO_PERMISSIONS, reads: ["ticket" as const] };
const detail: MarketPackageDetail = {
  ...hit,
  id: "milestones",
  title: "Calendrier des jalons",
  publisher: { name: "Léa", publicKey: "LEA", verified: true },
  latest: "1.2.0",
  version: "1.2.0",
  hash: `9c41${"0".repeat(56)}7e0b`,
  size: 184 * 1024,
  permissions: { ...NO_PERMISSIONS, reads: ["ticket", "status"] },
  versions: [
    {
      version: "1.2.0",
      hash: "c21e".repeat(16),
      size: 4096,
      permissions: reads,
      publishedAt: "2026-09-22T10:00:00Z",
      revoked: null,
    },
    {
      version: "1.0.3",
      hash: "aaaa".repeat(16),
      size: 4000,
      permissions: reads,
      publishedAt: "2026-08-18T10:00:00Z",
      revoked: "calcul des échéances faux",
    },
  ],
  pinnedPublisher: null,
  newPublisher: true,
  publisherChanged: false,
  files: [
    { path: "kibo.component.json", content: '{ "id": "milestones" }' },
    { path: "ui.tsx", content: "export const Component = () => <div>Jalons</div>;" },
  ],
};
const TARGET = { sourceId: "equipe", id: "milestones", version: "1.2.0" };

beforeEach(() => {
  calls.length = 0;
  answers = {};
});

test("without any source the tab explains what a source is and adds one in place", async () => {
  answers.listMarketSources = () => Promise.resolve([]);
  render(<MarketplaceTab onInstalled={() => {}} remote={false} />);
  expect(await screen.findByText("Aucune source de composants")).toBeTruthy();
  expect(
    screen.getByText("Une source est un catalogue signé, publié par ton équipe ou par un tiers."),
  ).toBeTruthy();
  expect(screen.getByRole("link", { name: "Gérer les sources" }).getAttribute("href")).toBe(
    "#/settings/components",
  );
  await userEvent.setup().click(screen.getByRole("button", { name: "Ajouter une source" }));
  expect(await screen.findByRole("dialog", { name: "Ajouter une source" })).toBeTruthy();
});

test("a remote session sees the empty state without the add button", async () => {
  answers.listMarketSources = () => Promise.resolve([]);
  render(<MarketplaceTab onInstalled={() => {}} remote />);
  expect(await screen.findByText("Aucune source de composants")).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Ajouter une source" })).toBeNull();
  expect(
    screen.getByText("Ajouter ou retirer une source n'est possible que depuis l'ordinateur où tourne Kibo."),
  ).toBeTruthy();
});

test("adding the first source from the empty state lists its components", async () => {
  answers.listMarketSources = () => Promise.resolve([]);
  answers.probeMarketSource = () =>
    Promise.resolve({
      sourceId: "equipe",
      name: "Équipe",
      publicKey: "PK",
      fingerprint: "3f9a".repeat(16),
      serial: 42,
      packages: 1,
    });
  answers.addMarketSource = () => Promise.resolve(source);
  answers.searchMarket = () => Promise.resolve([hit]);
  render(<MarketplaceTab onInstalled={() => {}} remote={false} />);
  const user = userEvent.setup();
  await user.click(await screen.findByRole("button", { name: "Ajouter une source" }));
  await user.type(await screen.findByLabelText("Adresse"), "https://market.kibo.test/");
  await user.click(screen.getByRole("button", { name: "Suivant" }));
  answers.listMarketSources = () => Promise.resolve([source]);
  await user.click(await screen.findByRole("button", { name: "Ajouter" }));
  expect(await screen.findByText("Revue de sprint")).toBeTruthy();
});

test("cards show the publisher status, the version and the install badge, the id only in Details", async () => {
  answers.listMarketSources = () => Promise.resolve([source]);
  answers.searchMarket = () => Promise.resolve([burndown, hit]);
  render(<MarketplaceTab onInstalled={() => {}} remote={false} />);
  expect(await screen.findByText("Revue de sprint")).toBeTruthy();
  expect(screen.getByText("non vérifié · Équipe")).toBeTruthy();
  expect(screen.getByText("vérifié · Équipe")).toBeTruthy();
  expect(screen.getByText("Installé 0.3.0")).toBeTruthy();
  expect(screen.getByText("0.1.2")).toBeTruthy();
  expect(screen.getByText("1 source · 2 paquets")).toBeTruthy();
  expect(screen.queryByText("sprint-review")).toBeNull();
  const card = screen.getByRole("button", { name: "Voir Revue de sprint" }).closest("[data-slot=card]");
  if (!(card instanceof HTMLElement)) throw new Error("card not found");
  await userEvent.setup().click(within(card).getByRole("button", { name: "Détails" }));
  expect(within(card).getByText("sprint-review")).toBeTruthy();
});

test("typing searches the cached index", async () => {
  answers.listMarketSources = () => Promise.resolve([source]);
  answers.searchMarket = () => Promise.resolve([hit]);
  render(<MarketplaceTab onInstalled={() => {}} remote={false} />);
  await screen.findByText("Revue de sprint");
  await userEvent.setup().type(screen.getByLabelText("Rechercher un composant"), "burn");
  await waitFor(() => expect(calls.at(-1)).toEqual({ method: "searchMarket", query: "burn" }));
});

test("the kind and source filters narrow the search", async () => {
  answers.listMarketSources = () => Promise.resolve([source]);
  answers.searchMarket = () => Promise.resolve([hit]);
  render(<MarketplaceTab onInstalled={() => {}} remote={false} />);
  await screen.findByText("Revue de sprint");
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: "Type : tous" }));
  await user.click(await screen.findByRole("menuitemradio", { name: "Vue" }));
  await waitFor(() => expect(calls.at(-1)).toEqual({ method: "searchMarket", query: "", kind: "view" }));
  expect(screen.getByRole("button", { name: "Type : Vue" })).toBeTruthy();
  await user.click(screen.getByRole("button", { name: "Source : toutes" }));
  await user.click(await screen.findByRole("menuitemradio", { name: "Équipe" }));
  await waitFor(() =>
    expect(calls.at(-1)).toEqual({ method: "searchMarket", query: "", sourceId: "equipe", kind: "view" }),
  );
});

test("an empty search result says so", async () => {
  answers.listMarketSources = () => Promise.resolve([source]);
  answers.searchMarket = () => Promise.resolve([]);
  render(<MarketplaceTab onInstalled={() => {}} remote={false} />);
  expect(await screen.findByText("Aucun composant ne correspond à ta recherche.")).toBeTruthy();
});

test("opening a card loads its detail", async () => {
  answers.listMarketSources = () => Promise.resolve([source]);
  answers.searchMarket = () => Promise.resolve([hit]);
  answers.getMarketPackage = () => Promise.resolve(detail);
  render(<MarketplaceTab onInstalled={() => {}} remote={false} />);
  await userEvent.setup().click(await screen.findByRole("button", { name: "Voir Revue de sprint" }));
  await waitFor(() =>
    expect(calls).toContainEqual({
      method: "getMarketPackage",
      sourceId: "equipe",
      id: "sprint-review",
      version: "0.1.2",
    }),
  );
});

test("the detail shows the verified publisher, the source, revoked versions and the code", async () => {
  answers.listMarketSources = () => Promise.resolve([source]);
  answers.getMarketPackage = () => Promise.resolve(detail);
  render(<MarketPackageSheet target={TARGET} onClose={() => {}} onInstalled={() => {}} />);
  expect(await screen.findByText("Léa · vérifié par Équipe")).toBeTruthy();
  expect(screen.getByText("Nouvel éditeur")).toBeTruthy();
  expect(await screen.findByText("Équipe (https://market.kibo.test)")).toBeTruthy();
  expect(screen.getByText("184 ko")).toBeTruthy();
  expect(screen.getByText("sha256:9c41…7e0b")).toBeTruthy();
  expect(screen.getByText("Code vérifié : signature et empreinte correspondent")).toBeTruthy();
  expect(screen.getByText("Révoquée : calcul des échéances faux")).toBeTruthy();
  const versions = screen.getByRole("list", { name: "Versions" });
  expect(
    within(versions)
      .getAllByRole("listitem")
      .map((li) => li.firstChild?.textContent),
  ).toEqual(["1.2.0", "1.0.3"]);
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: "Voir le code" }));
  await user.click(screen.getByRole("button", { name: "ui.tsx" }));
  expect((await screen.findByRole("region", { name: "ui.tsx" })).textContent).toContain("<div>Jalons</div>");
  expect(screen.getByRole("button", { name: "Masquer le code" })).toBeTruthy();
});

test("installing calls the daemon then hands the result over", async () => {
  answers.getMarketPackage = () => Promise.resolve(detail);
  const result: MarketInstallResult = {
    id: "milestones",
    title: "Calendrier des jalons",
    version: "1.2.0",
    hash: detail.hash,
    permissions: detail.permissions,
    market: { publisherName: "Léa", verified: true, sourceName: "Équipe", newPublisher: true },
  };
  answers.installFromMarket = () => Promise.resolve(result);
  const onInstalled = mock((_: MarketInstallResult) => {});
  render(<MarketPackageSheet target={TARGET} onClose={() => {}} onInstalled={onInstalled} />);
  await userEvent.setup().click(await screen.findByRole("button", { name: "Installer 1.2.0" }));
  await waitFor(() => expect(onInstalled).toHaveBeenCalledWith(result));
  expect(calls.at(-1)).toEqual({ method: "installFromMarket", ...TARGET });
});

test("a failed check opens the refusal and nothing is handed over", async () => {
  answers.getMarketPackage = () => Promise.resolve(detail);
  answers.installFromMarket = () => Promise.reject(new KiboError("SIGNATURE_INVALID", "x"));
  const onInstalled = mock((_: MarketInstallResult) => {});
  render(<MarketPackageSheet target={TARGET} onClose={() => {}} onInstalled={onInstalled} />);
  const user = userEvent.setup();
  await user.click(await screen.findByRole("button", { name: "Installer 1.2.0" }));
  const refusal = await screen.findByRole("dialog", { name: "Installation refusée" });
  expect(within(refusal).getByText("« Calendrier des jalons » 1.2.0 · milestones")).toBeTruthy();
  expect(within(refusal).getByText("Signature invalide")).toBeTruthy();
  expect(
    within(refusal).getByText(
      "Le paquet téléchargé n'est pas signé par la clé de l'éditeur enregistrée pour la source Équipe. Rien n'a été installé.",
    ),
  ).toBeTruthy();
  expect(onInstalled).not.toHaveBeenCalled();
  await user.click(within(refusal).getAllByRole("button", { name: "Fermer" })[0] as HTMLElement);
  await waitFor(() => expect(screen.queryByRole("dialog", { name: "Installation refusée" })).toBeNull());
});

test("an unreachable source is explained inline", async () => {
  answers.getMarketPackage = () => Promise.resolve(detail);
  answers.installFromMarket = () => Promise.reject(new KiboError("TIMEOUT", "x"));
  render(<MarketPackageSheet target={TARGET} onClose={() => {}} onInstalled={() => {}} />);
  await userEvent.setup().click(await screen.findByRole("button", { name: "Installer 1.2.0" }));
  expect((await screen.findByRole("alert")).textContent).toBe("La source ne répond pas.");
});

test("a changed publisher key disables install and offers to unlock", async () => {
  answers.getMarketPackage = () =>
    Promise.resolve({ ...detail, publisherChanged: true, newPublisher: false });
  const onUnlock = mock((_: MarketPackageDetail) => {});
  render(
    <MarketPackageSheet target={TARGET} onClose={() => {}} onInstalled={() => {}} onUnlock={onUnlock} />,
  );
  expect(await screen.findByText("La clé de l'éditeur a changé.")).toBeTruthy();
  expect(screen.getByRole("button", { name: "Installer 1.2.0" }).hasAttribute("disabled")).toBe(true);
  await userEvent.setup().click(screen.getByRole("button", { name: "Débloquer…" }));
  expect(onUnlock).toHaveBeenCalled();
});

test("a remote session cannot install and is told why", async () => {
  answers.getMarketPackage = () => Promise.resolve(detail);
  render(<MarketPackageSheet target={TARGET} onClose={() => {}} onInstalled={() => {}} remote />);
  expect(
    await screen.findByText("Cette action n'est possible que depuis l'ordinateur où tourne Kibo."),
  ).toBeTruthy();
  expect(screen.getByRole("button", { name: "Installer 1.2.0" }).hasAttribute("disabled")).toBe(true);
});
