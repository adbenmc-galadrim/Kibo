import { beforeEach, expect, mock, test } from "bun:test";
import { KiboError, type RpcRequest } from "@kibo/schema";
import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { apiMock } from "../api-mock";
import { aiReady, draftFixture } from "./draft-fixtures";

const calls: RpcRequest[] = [];
let answer: (req: RpcRequest) => unknown = () => null;
mock.module("../api", () =>
  apiMock({
    client: {
      rpc: async (req: RpcRequest) => {
        calls.push(req);
        const out = answer(req);
        if (out instanceof Error) throw out;
        return out;
      },
      subscribeAi: () => () => {},
    },
  }),
);

const { DescribeCard } = await import("./DescribeCard");

const describeLabel = "Ce que doit faire le composant";
const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13];
const pngBytes = () => new Uint8Array(PNG);
const startRequest = () => {
  const req = calls.find((c) => c.method === "startComponentDraft");
  if (req?.method !== "startComponentDraft") throw new Error("no startComponentDraft");
  return req.draft;
};
const imagesZone = () => screen.getByRole("group", { name: "Maquettes (facultatif)" });
const generateName = "Générer avec un agent";

beforeEach(() => {
  calls.length = 0;
  Object.defineProperty(navigator, "onLine", { configurable: true, value: true });
});

test("DescribeCard proposes a title and an id, then starts the draft", async () => {
  const onStarted = mock(() => {});
  answer = (req) =>
    req.method === "getAiStatus" ? aiReady : req.method === "startComponentDraft" ? draftFixture({}) : null;
  render(<DescribeCard onStarted={onStarted} />);
  const user = userEvent.setup();
  const button = await screen.findByRole("button", { name: generateName });
  await user.type(screen.getByLabelText(describeLabel), "Burndown du sprint : tickets");
  expect(button.hasAttribute("disabled")).toBe(false);
  expect((screen.getByLabelText("Identifiant") as HTMLInputElement).value).toBe("burndown-du-sprint");
  await user.click(button);
  expect(calls.at(-1)).toEqual({
    method: "startComponentDraft",
    draft: {
      mode: "create",
      id: "burndown-du-sprint",
      title: "Burndown du sprint",
      kind: "widget",
      withServer: false,
      description: "Burndown du sprint : tickets",
      formats: ["medium", "large", "half"],
      template: "blank",
      attachments: [],
    },
  });
  expect(onStarted).toHaveBeenCalledTimes(1);
});

test("DescribeCard shows a taken id", async () => {
  answer = (req) =>
    req.method === "getAiStatus"
      ? aiReady
      : req.method === "startComponentDraft"
        ? new KiboError("CONFLICT", "taken")
        : null;
  render(<DescribeCard onStarted={() => {}} />);
  const user = userEvent.setup();
  await user.type(await screen.findByLabelText(describeLabel), "Burndown du sprint : tickets");
  await user.click(screen.getByRole("button", { name: generateName }));
  expect(await screen.findByText("Identifiant déjà pris.")).toBeTruthy();
});

test("an id the daemon would reject keeps the button disabled and explains why", async () => {
  answer = (req) => (req.method === "getAiStatus" ? aiReady : null);
  render(<DescribeCard onStarted={() => {}} />);
  const user = userEvent.setup();
  await user.type(await screen.findByLabelText(describeLabel), "Burndown du sprint : tickets");
  const id = screen.getByLabelText("Identifiant");
  await user.clear(id);
  await user.type(id, "mon id é");
  expect(screen.getByRole("button", { name: generateName }).hasAttribute("disabled")).toBe(true);
  expect(
    screen.getByText("Minuscules, chiffres et tirets, 2 à 40 caractères, en commençant par une lettre."),
  ).toBeTruthy();
  await user.click(screen.getByRole("button", { name: generateName }));
  expect(calls.some((c) => c.method === "startComponentDraft")).toBe(false);
});

test("a daemon rejection is shown in French, never as the raw detail", async () => {
  const raw = '[{"code":"invalid_string","path":["draft","id"]}]';
  answer = (req) =>
    req.method === "getAiStatus"
      ? aiReady
      : req.method === "startComponentDraft"
        ? new KiboError("INVALID_INPUT", raw)
        : null;
  render(<DescribeCard onStarted={() => {}} />);
  const user = userEvent.setup();
  await user.type(await screen.findByLabelText(describeLabel), "Burndown du sprint : tickets");
  await user.click(screen.getByRole("button", { name: generateName }));
  expect((await screen.findByRole("alert")).textContent).toBe("Le démon a refusé ces données.");
  expect(screen.queryByText(/invalid_string/)).toBeNull();
});

test("DescribeCard is disabled offline", async () => {
  Object.defineProperty(navigator, "onLine", { configurable: true, value: false });
  answer = (req) => (req.method === "getAiStatus" ? aiReady : null);
  render(<DescribeCard onStarted={() => {}} />);
  expect(await screen.findByText("Hors ligne")).toBeTruthy();
  expect(screen.getByRole("button", { name: generateName }).hasAttribute("disabled")).toBe(true);
});

test("screen 132: formats are pre-checked by kind and sent; an image is attached by the file picker, shown, removable", async () => {
  answer = (req) =>
    req.method === "getAiStatus" ? aiReady : req.method === "startComponentDraft" ? draftFixture({}) : null;
  const user = userEvent.setup();
  render(<DescribeCard onStarted={() => {}} />);
  expect(screen.getByRole("checkbox", { name: "Moyen" }).getAttribute("aria-checked")).toBe("true");
  expect(screen.getByRole("checkbox", { name: "Petit" }).getAttribute("aria-checked")).toBe("false");
  await user.click(screen.getByRole("checkbox", { name: "Petit" }));
  const file = new File([pngBytes()], "maquette kanban.png", { type: "image/png" });
  await user.upload(screen.getByLabelText("Ajouter des images"), file);
  expect(await screen.findByRole("img", { name: "maquette-kanban.png" })).toBeTruthy();
  expect(within(imagesZone()).getByText("maquette-kanban.png · 1 ko")).toBeTruthy();
  await user.upload(
    screen.getByLabelText("Ajouter des images"),
    new File([pngBytes()], "autre.png", { type: "image/png" }),
  );
  await user.click(await screen.findByRole("button", { name: "Retirer autre.png" }));
  expect(screen.queryByRole("img", { name: "autre.png" })).toBeNull();
  await user.type(screen.getByLabelText(describeLabel), "Burndown du sprint avec total");
  await user.click(await screen.findByRole("button", { name: generateName }));
  expect(startRequest()).toMatchObject({
    formats: ["small", "medium", "large", "half"],
    attachments: [{ name: "maquette-kanban.png", mime: "image/png" }],
  });
});

test("changing the kind resets the formats, and a view without the full format cannot be sent", async () => {
  answer = (req) => (req.method === "getAiStatus" ? aiReady : null);
  const user = userEvent.setup();
  render(<DescribeCard onStarted={() => {}} />);
  await user.type(await screen.findByLabelText(describeLabel), "Burndown du sprint : tickets");
  screen.getByRole("combobox", { name: "Type" }).focus();
  await user.keyboard("{Enter}");
  await user.click(await screen.findByRole("option", { name: "Vue" }));
  const state = (name: string) => screen.getByRole("checkbox", { name }).getAttribute("aria-checked");
  expect(["Petit", "Moyen", "Large", "Demi-page"].map(state)).toEqual(["false", "false", "false", "false"]);
  expect(screen.getByRole("checkbox", { name: "Plein écran" }).getAttribute("aria-checked")).toBe("true");
  await user.click(screen.getByRole("checkbox", { name: "Plein écran" }));
  expect(screen.getByText("Choisis au moins un format.")).toBeTruthy();
  await user.click(screen.getByRole("checkbox", { name: "Moyen" }));
  expect(screen.getByText("Une vue s'affiche en plein écran : garde « Plein écran ».")).toBeTruthy();
  expect(screen.getByRole("button", { name: generateName }).hasAttribute("disabled")).toBe(true);
});

test("choosing the 3D template sends it with the draft", async () => {
  answer = (req) =>
    req.method === "getAiStatus" ? aiReady : req.method === "startComponentDraft" ? draftFixture({}) : null;
  const user = userEvent.setup();
  render(<DescribeCard onStarted={() => {}} />);
  await user.type(await screen.findByLabelText(describeLabel), "Visionneuse du modèle 3D du projet");
  screen.getByRole("combobox", { name: "Gabarit" }).focus();
  await user.keyboard("{Enter}");
  const options = await screen.findAllByRole("option");
  expect(options.map((o) => o.textContent)).toEqual(["Vide", "3D", "Jeu", "Graphique", "Tableau"]);
  await user.click(screen.getByRole("option", { name: "3D" }));
  await user.click(screen.getByRole("button", { name: generateName }));
  expect(startRequest()).toMatchObject({ template: "3d" });
});

test("a GIF is refused with a message and nothing is attached", async () => {
  answer = (req) => (req.method === "getAiStatus" ? aiReady : null);
  const user = userEvent.setup({ applyAccept: false });
  render(<DescribeCard onStarted={() => {}} />);
  const gif = new File([new Uint8Array([0x47, 0x49, 0x46, 0x38, 0x39, 0x61])], "anim.png", {
    type: "image/png",
  });
  await user.upload(screen.getByLabelText("Ajouter des images"), gif);
  expect((await screen.findByRole("alert")).textContent).toBe(
    "Format non pris en charge : PNG, JPEG ou WebP.",
  );
  expect(screen.queryAllByRole("img")).toHaveLength(0);
});

test("a fifth image is refused before sending, with a single alert", async () => {
  answer = (req) => (req.method === "getAiStatus" ? aiReady : null);
  const user = userEvent.setup();
  render(<DescribeCard onStarted={() => {}} />);
  const files = Array.from(
    { length: 5 },
    (_, i) => new File([pngBytes()], `${i}.png`, { type: "image/png" }),
  );
  await user.upload(screen.getByLabelText("Ajouter des images"), files);
  expect(await screen.findAllByRole("img")).toHaveLength(4);
  expect(screen.getAllByRole("alert")).toHaveLength(1);
  expect(screen.getByRole("alert").textContent).toBe(
    "4 images au plus : retire une image pour en ajouter une autre.",
  );
});

test("a dropped screenshot is sent under a name the daemon accepts", async () => {
  answer = (req) =>
    req.method === "getAiStatus" ? aiReady : req.method === "startComponentDraft" ? draftFixture({}) : null;
  const user = userEvent.setup();
  render(<DescribeCard onStarted={() => {}} />);
  const shot = new File([pngBytes()], "Capture d'écran 2026-10-01 à 10.12.33.png", { type: "image/png" });
  fireEvent.dragOver(imagesZone(), { dataTransfer: { files: [shot] } });
  fireEvent.drop(imagesZone(), { dataTransfer: { files: [shot] } });
  expect(await screen.findByRole("img", { name: "Capture-d-ecran-2026-10-01-a-10.12.33.png" })).toBeTruthy();
  await user.type(screen.getByLabelText(describeLabel), "Burndown du sprint : tickets");
  await user.click(screen.getByRole("button", { name: generateName }));
  expect(startRequest()).toMatchObject({
    attachments: [{ name: "Capture-d-ecran-2026-10-01-a-10.12.33.png", mime: "image/png" }],
  });
});

test("pasting an image into the description attaches it", async () => {
  answer = (req) => (req.method === "getAiStatus" ? aiReady : null);
  render(<DescribeCard onStarted={() => {}} />);
  const image = new File([pngBytes()], "image.png", { type: "image/png" });
  fireEvent.paste(screen.getByLabelText(describeLabel), {
    clipboardData: { files: [image], getData: () => "" },
  });
  expect(await screen.findByRole("img", { name: "image.png" })).toBeTruthy();
});

const noClaude = { ...aiReady, available: false, reason: "missing" as const, loggedIn: null, version: null };
const projectsWith = (demo: boolean) => [
  {
    id: "p",
    key: "DEMO",
    name: "Démo Kibo",
    folder: null,
    color: "#14B8A6",
    counts: { backlog: 0, todo: 0, in_progress: 0, in_review: 0, blocked: 0, done: 0 },
    demo,
  },
];

test("the card sends the current project with the draft", async () => {
  answer = (req) =>
    req.method === "getAiStatus"
      ? aiReady
      : req.method === "listProjects"
        ? projectsWith(false)
        : req.method === "startComponentDraft"
          ? draftFixture({})
          : null;
  render(<DescribeCard projectId="p" onStarted={() => {}} />);
  const user = userEvent.setup();
  await user.type(await screen.findByLabelText(describeLabel), "Burndown du sprint : tickets");
  await user.click(screen.getByRole("button", { name: generateName }));
  expect(startRequest()).toMatchObject({ mode: "create", projectId: "p" });
  expect(screen.queryByText("Agent de démonstration · aucun token consommé")).toBeNull();
});

test("in the demo project the card stays active without claude and says no token is spent", async () => {
  answer = (req) =>
    req.method === "getAiStatus" ? noClaude : req.method === "listProjects" ? projectsWith(true) : null;
  render(<DescribeCard projectId="p" onStarted={() => {}} />);
  expect(await screen.findByText("Agent de démonstration · aucun token consommé")).toBeTruthy();
  await userEvent.setup().type(screen.getByLabelText(describeLabel), "Burndown du sprint : tickets");
  expect(screen.getByRole("button", { name: generateName }).hasAttribute("disabled")).toBe(false);
  expect(screen.queryByText("claude introuvable")).toBeNull();
});

test("outside the demo project a missing claude still blocks the card", async () => {
  answer = (req) =>
    req.method === "getAiStatus" ? noClaude : req.method === "listProjects" ? projectsWith(false) : null;
  render(<DescribeCard projectId="p" onStarted={() => {}} />);
  expect(await screen.findByText("claude introuvable")).toBeTruthy();
  expect(screen.getByRole("button", { name: generateName }).hasAttribute("disabled")).toBe(true);
});
