import { beforeEach, expect, mock, test } from "bun:test";
import { type AiEvent, type ComponentDraftDetails, KiboError, type RpcRequest } from "@kibo/schema";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  aiReady,
  DRAFT_ID,
  draftFixture,
  burndownManifest as manifest,
  burndownPublish as publish,
  uiDiff,
} from "./draft-fixtures";

const HASH = "3f9a".padEnd(64, "0");
const calls: RpcRequest[] = [];
const aiListeners = new Set<(e: AiEvent) => void>();
let draft: ComponentDraftDetails = draftFixture({});

const inStatus = (status: "review" | "permissions" | "generating", mode: "create" | "modify") =>
  draftFixture({
    status,
    mode,
    baseVersion: mode === "modify" ? "0.1.0" : null,
    diff: [uiDiff],
    manifest,
    revisions: status === "generating" ? 1 : 0,
    publish: {
      ...publish,
      ...(mode === "modify" ? { from: "0.1.0", to: "0.2.0", status: "update" as const } : {}),
      hash: status === "permissions" ? HASH : null,
    },
  });

mock.module("../api", () => ({
  client: {
    rpc: async (req: RpcRequest) => {
      calls.push(req);
      switch (req.method) {
        case "getAiStatus":
          return aiReady;
        case "getComponentDraft":
          return draft;
        case "getAgents":
          return null;
        case "getRunLog":
          return [];
        case "reviseComponentDraft":
          draft = inStatus("generating", draft.mode);
          return draft;
        case "reviewComponentDraft":
          draft = inStatus("permissions", draft.mode);
          return draft;
        case "listComponents":
          return [];
        default:
          throw new KiboError("INTERNAL", `unexpected ${req.method}`);
      }
    },
    subscribeAi: (listener: (e: AiEvent) => void) => {
      aiListeners.add(listener);
      return () => aiListeners.delete(listener);
    },
    subscribeTopic: () => () => {},
    subscribe: () => () => {},
    subscribeEvents: () => () => {},
    onConnection: () => () => {},
    online: () => true,
  },
}));

const { AiDraftPanel } = await import("./AiDraftPanel");

beforeEach(() => {
  calls.length = 0;
  Object.defineProperty(navigator, "onLine", { configurable: true, value: true });
});

const backTo = (next: ComponentDraftDetails) =>
  act(() => {
    draft = next;
    for (const l of aiListeners) l({ type: "draft.changed", draftId: DRAFT_ID, status: next.status });
  });

async function refuseThenRevise() {
  const user = userEvent.setup();
  await user.click(await screen.findByRole("button", { name: "Refuser" }));
  await user.click(await screen.findByRole("button", { name: "Demander une modification" }));
  await user.type(screen.getByLabelText("Ce qu'il faut changer"), "Mets le total en gros");
  await user.click(screen.getByRole("button", { name: "Envoyer à l'agent" }));
  await screen.findByText("Révision 1 sur 10");
  return user;
}

test("a revision sent after refusing the approval leaves the review step while generating", async () => {
  draft = inStatus("permissions", "create");
  render(<AiDraftPanel draftId={DRAFT_ID} target={null} onDone={() => {}} />);
  await refuseThenRevise();
  expect(screen.queryByRole("tablist")).toBeNull();
  expect(screen.queryByRole("button", { name: "J'ai relu, continuer" })).toBeNull();
});

test("back in review after a revision (create), a single click sends the review", async () => {
  draft = inStatus("permissions", "create");
  render(<AiDraftPanel draftId={DRAFT_ID} target={null} onDone={() => {}} />);
  const user = await refuseThenRevise();
  await backTo(inStatus("review", "create"));
  await user.click(await screen.findByRole("button", { name: "J'ai relu, continuer" }));
  await waitFor(() => expect(calls.filter((c) => c.method === "reviewComponentDraft")).toHaveLength(1));
});

test("back in review after a revision (modify), the publish step waits for a new review", async () => {
  draft = inStatus("review", "modify");
  render(<AiDraftPanel draftId={DRAFT_ID} target={null} onDone={() => {}} />);
  const user = userEvent.setup();
  await user.click(await screen.findByRole("button", { name: "J'ai relu, continuer" }));
  await user.click(await screen.findByRole("button", { name: "Publier" }));
  await refuseThenRevise();
  await backTo(inStatus("review", "modify"));
  expect(await screen.findByRole("tablist", { name: "Relecture du brouillon" })).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Publier" })).toBeNull();
  await user.click(screen.getByRole("button", { name: "J'ai relu, continuer" }));
  expect(await screen.findByRole("button", { name: "Publier" })).toBeTruthy();
});
