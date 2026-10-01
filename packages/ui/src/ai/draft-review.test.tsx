import { afterAll, beforeEach, expect, mock, test } from "bun:test";
import { type ComponentDraftDetails, KiboError, MAX_DRAFT_REVISIONS, type RpcRequest } from "@kibo/schema";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  aiReady,
  DRAFT_ID,
  draftFixture,
  burndownManifest as manifest,
  burndownPublish as publish,
  uiDiff,
} from "./draft-fixtures";

const sandbox = Bun.serve({
  hostname: "127.0.0.1",
  port: 0,
  fetch: () =>
    new Response("<!doctype html><title>preview</title>", { headers: { "content-type": "text/html" } }),
});
afterAll(() => sandbox.stop(true));

const HASH = "c".repeat(64);
const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13];
const calls: RpcRequest[] = [];
let draft: ComponentDraftDetails = draftFixture({});
let revise: () => unknown = () => null;

mock.module("../api", () => ({
  client: {
    rpc: async (req: RpcRequest) => {
      calls.push(req);
      switch (req.method) {
        case "getAiStatus":
          return aiReady;
        case "getComponentDraft":
          return draft;
        case "getRuntimeInfo":
          return { sandboxOrigin: `http://127.0.0.1:${sandbox.port}` };
        case "previewComponentDraft":
          return { hash: HASH, path: `/c/drafts/${DRAFT_ID}/${HASH}/index.html` };
        case "getAgents":
          return null;
        case "getRunLog":
          return [];
        case "reviseComponentDraft": {
          const out = revise();
          if (out instanceof Error) throw out;
          return out;
        }
        default:
          throw new KiboError("INTERNAL", `unexpected ${req.method}`);
      }
    },
    subscribeAi: () => () => {},
    subscribeTopic: () => () => {},
    onConnection: () => () => {},
    online: () => true,
  },
}));

const { AiDraftPanel } = await import("./AiDraftPanel");

const inReview = (patch: Partial<ComponentDraftDetails> = {}) =>
  draftFixture({ status: "review", diff: [uiDiff], manifest, publish, ...patch });

beforeEach(() => {
  calls.length = 0;
  draft = inReview();
  revise = () => {
    draft = draftFixture({ status: "generating", revisions: 1 });
    return draft;
  };
  Object.defineProperty(navigator, "onLine", { configurable: true, value: true });
});

const mount = () => render(<AiDraftPanel draftId={DRAFT_ID} target={null} onDone={() => {}} />);

test("screen 133: in review, Diff is active and Aperçu mounts the sandboxed preview", async () => {
  mount();
  const user = userEvent.setup();
  const tabs = await screen.findByRole("tablist", { name: "Relecture du brouillon" });
  const diffTab = within(tabs).getByRole("tab", { name: "Diff" });
  expect(diffTab.getAttribute("aria-selected")).toBe("true");
  expect(screen.getByRole("tabpanel", { name: "Diff" }).textContent).toContain(
    "export function Burndown() {}",
  );
  await user.click(within(tabs).getByRole("tab", { name: "Aperçu" }));
  const panel = screen.getByRole("tabpanel", { name: "Aperçu" });
  expect(panel.textContent).toContain(
    "Aperçu isolé avec des données de démonstration. Rien n'est enregistré.",
  );
  const frame = await within(panel).findByTitle("Aperçu de Burndown");
  expect(frame.getAttribute("src")).toContain(`/c/drafts/${DRAFT_ID}/${HASH}/index.html`);
  expect(frame.getAttribute("sandbox")).toBe("allow-scripts");
  const picker = within(panel).getByRole("radiogroup", { name: "Format de l'aperçu" });
  expect(
    within(picker)
      .getAllByRole("radio")
      .map((r) => r.textContent),
  ).toEqual(["Moyen", "Large", "Demi-page"]);
  await user.click(within(picker).getByRole("radio", { name: "Demi-page" }));
  await waitFor(() => expect(within(panel).getByTitle("Aperçu de Burndown").style.width).toBe("1196px"));
  expect(calls.filter((c) => c.method === "previewComponentDraft")).toHaveLength(1);
});

test("the tabs follow the keyboard", async () => {
  mount();
  const user = userEvent.setup();
  const diffTab = await screen.findByRole("tab", { name: "Diff" });
  diffTab.focus();
  await user.keyboard("{ArrowRight}");
  expect(document.activeElement?.textContent).toBe("Aperçu");
  await waitFor(() =>
    expect(screen.getByRole("tab", { name: "Aperçu" }).getAttribute("aria-selected")).toBe("true"),
  );
});

test("screen 134: a revision is sent with its image, then the draft goes back to generation", async () => {
  mount();
  const user = userEvent.setup();
  await user.click(await screen.findByRole("button", { name: "Demander une modification" }));
  const form = screen.getByRole("form", { name: "Demander une modification" });
  expect(within(form).getByText("10 révisions restantes")).toBeTruthy();
  await user.type(within(form).getByLabelText("Ce qu'il faut changer"), "Mets le total en gros");
  await user.upload(
    within(form).getByLabelText("Ajouter des images"),
    new File([new Uint8Array(PNG)], "maquette.png", { type: "image/png" }),
  );
  await within(form).findByRole("img", { name: "maquette.png" });
  await user.click(within(form).getByRole("button", { name: "Envoyer à l'agent" }));
  expect(calls.find((c) => c.method === "reviseComponentDraft")).toEqual({
    method: "reviseComponentDraft",
    draftId: DRAFT_ID,
    feedback: "Mets le total en gros",
    attachments: [{ name: "maquette.png", mime: "image/png", data: expect.any(String) }],
  });
  expect(await screen.findByText("Révision 1 sur 10")).toBeTruthy();
  expect(screen.queryByRole("tablist")).toBeNull();
  const steps = within(screen.getByRole("list", { name: "Créer un composant" })).getAllByRole("listitem");
  expect(steps.find((li) => li.getAttribute("aria-current") === "step")?.textContent).toBe(
    "2 · Générer (agent)",
  );
});

const refusals = [
  [
    "CONFLICT",
    "Impossible pour l'instant : l'agent travaille sur ce brouillon, ou cette version est déjà publiée.",
  ],
  ["INVALID_INPUT", "Révision refusée : dix révisions et 44 images au plus par brouillon."],
] as const;

for (const [code, text] of refusals) {
  test(`a ${code} refusal of the revision is shown with role=alert and keeps the text`, async () => {
    revise = () => new KiboError(code, "refused");
    mount();
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: "Demander une modification" }));
    await user.type(screen.getByLabelText("Ce qu'il faut changer"), "Mets le total en gros");
    await user.click(screen.getByRole("button", { name: "Envoyer à l'agent" }));
    expect((await screen.findByRole("alert")).textContent).toBe(text);
    expect((screen.getByLabelText("Ce qu'il faut changer") as HTMLTextAreaElement).value).toBe(
      "Mets le total en gros",
    );
  });
}

test("after ten revisions the request is gone and the limit is explained", async () => {
  draft = inReview({ revisions: MAX_DRAFT_REVISIONS });
  mount();
  expect(await screen.findByText("Dix révisions atteintes : publie ou abandonne le brouillon.")).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Demander une modification" })).toBeNull();
});

test("the waiting skeletons are announced with role=status", async () => {
  draft = draftFixture({ status: "validating" });
  mount();
  expect(await screen.findByRole("status", { name: "Validation en cours…" })).toBeTruthy();
});

test("AiDraftPanel reports the draft status to its host", async () => {
  const statuses: string[] = [];
  render(
    <AiDraftPanel draftId={DRAFT_ID} target={null} onDone={() => {}} onStatus={(s) => statuses.push(s)} />,
  );
  await waitFor(() => expect(statuses).toEqual(["review"]));
});
