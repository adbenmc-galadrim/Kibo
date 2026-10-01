import { afterEach, beforeEach, expect, jest, mock, test } from "bun:test";
import { KiboError, type RpcRequest } from "@kibo/schema";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { aiReady, burndownManifest, DRAFT_ID, draftFixture as details } from "../ai/draft-fixtures";

const calls: RpcRequest[] = [];
let answer: (req: RpcRequest) => unknown = () => null;
mock.module("../api", () => ({
  client: {
    rpc: async (req: RpcRequest) => {
      calls.push(req);
      if (req.method === "getAiStatus") return aiReady;
      if (req.method === "getAgents" || req.method === "getConfig") return null;
      const out = answer(req);
      if (out instanceof Error) throw out;
      return out;
    },
    subscribeAi: () => () => {},
    subscribeTopic: () => () => {},
    subscribe: () => () => {},
    onConnection: () => () => {},
    online: () => true,
  },
}));

const { CreateComponentDialog } = await import("./CreateComponentDialog");

afterEach(() => jest.useRealTimers());

beforeEach(() => {
  calls.length = 0;
  Object.defineProperty(navigator, "onLine", { configurable: true, value: true });
});

const active = (n: number, status: "generating" | "review" | "done") =>
  details({
    id: `0b5c1f3e-7a51-4d2a-9c1e-2f0d6f1b8a1${n}`,
    componentId: `c${n}`,
    title: `Brouillon ${n}`,
    status,
  });

test("the dialog can be closed while generating without any RPC, and reopens on a draft id", async () => {
  answer = () => details({});
  const onOpenChange = mock((_: boolean) => {});
  const user = userEvent.setup();
  render(<CreateComponentDialog open onOpenChange={onOpenChange} target={null} draftId={DRAFT_ID} />);
  const background = await screen.findByRole("button", { name: "Continuer en arrière-plan" });
  const before = calls.length;
  await user.click(background);
  expect(onOpenChange).toHaveBeenCalledWith(false);
  expect(calls.slice(before)).toEqual([]);
  expect(calls.some((c) => c.method === "abandonComponentDraft")).toBe(false);
});

test("the open draft is loaded once for the panel and the background button", async () => {
  answer = () => details({});
  render(<CreateComponentDialog open onOpenChange={() => {}} target={null} draftId={DRAFT_ID} />);
  await screen.findByRole("button", { name: "Continuer en arrière-plan" });
  await act(async () => {
    await new Promise((r) => setTimeout(r, 0));
  });
  expect(calls.filter((c) => c.method === "getComponentDraft")).toHaveLength(1);
});

test("Échap in the revision form closes the form, not the dialog", async () => {
  answer = () => details({ status: "review", manifest: burndownManifest });
  const onOpenChange = mock((_: boolean) => {});
  const user = userEvent.setup();
  render(<CreateComponentDialog open onOpenChange={onOpenChange} target={null} draftId={DRAFT_ID} />);
  await user.click(await screen.findByRole("button", { name: "Demander une modification" }));
  await user.type(screen.getByLabelText("Ce qu'il faut changer"), "Plus gros{Escape}");
  await waitFor(() => expect(screen.queryByLabelText("Ce qu'il faut changer")).toBeNull());
  expect(onOpenChange).not.toHaveBeenCalled();
  expect(screen.getByRole("dialog")).toBeTruthy();
});

test("a finished draft offers no background button", async () => {
  answer = () => details({ status: "done" });
  render(<CreateComponentDialog open onOpenChange={() => {}} target={null} draftId={DRAFT_ID} />);
  await waitFor(() =>
    expect(calls.filter((c) => c.method === "getComponentDraft").length).toBeGreaterThan(0),
  );
  expect(screen.queryByRole("button", { name: "Continuer en arrière-plan" })).toBeNull();
});

test("the banner lists up to three active drafts and links to Créations", async () => {
  answer = (req) =>
    req.method === "listComponentDrafts"
      ? [
          active(1, "generating"),
          active(2, "done"),
          active(3, "review"),
          active(4, "generating"),
          active(5, "generating"),
        ]
      : details({ id: active(3, "review").id, status: "review" });
  const onOpenCreations = mock(() => {});
  const user = userEvent.setup();
  render(
    <CreateComponentDialog open onOpenChange={() => {}} target={null} onOpenCreations={onOpenCreations} />,
  );
  const banner = await screen.findByRole("region", { name: "4 créations en cours" });
  expect(within(banner).getAllByRole("button", { name: "Reprendre" })).toHaveLength(3);
  expect(banner.textContent).toContain("Brouillon 3 · 3 · Tests de conformité");
  expect(banner.textContent).not.toContain("Brouillon 2");
  await user.click(within(banner).getByRole("button", { name: "Voir les créations" }));
  expect(onOpenCreations).toHaveBeenCalled();
  await user.click(within(banner).getAllByRole("button", { name: "Reprendre" })[1] as HTMLElement);
  expect(await screen.findByRole("button", { name: "Continuer en arrière-plan" })).toBeTruthy();
  expect(calls).toContainEqual({ method: "getComponentDraft", draftId: active(3, "review").id });
});

test("without onOpenCreations the banner has no link to Créations", async () => {
  answer = (req) => (req.method === "listComponentDrafts" ? [active(1, "generating")] : null);
  render(<CreateComponentDialog open onOpenChange={() => {}} target={null} />);
  const banner = await screen.findByRole("region", { name: "1 création en cours" });
  expect(within(banner).queryByRole("button", { name: "Voir les créations" })).toBeNull();
});

test("a listing failure is shown in French in the banner place", async () => {
  answer = (req) =>
    req.method === "listComponentDrafts" ? new KiboError("INTERNAL", "sqlite: disk I/O error") : null;
  render(<CreateComponentDialog open onOpenChange={() => {}} target={null} />);
  expect(await screen.findByText("Erreur interne du démon.")).toBeTruthy();
  expect(screen.queryByText(/sqlite/)).toBeNull();
});

test("« Commandes copiées. » disappears after two seconds", async () => {
  answer = (req) => (req.method === "listComponentDrafts" ? [] : null);
  const writeText = mock(async (_: string) => {});
  Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
  render(<CreateComponentDialog open onOpenChange={() => {}} target={null} />);
  jest.useFakeTimers();
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "Copier les commandes" }));
  });
  expect(screen.getByText("Commandes copiées.")).toBeTruthy();
  act(() => jest.advanceTimersByTime(1_999));
  expect(screen.getByText("Commandes copiées.")).toBeTruthy();
  act(() => jest.advanceTimersByTime(1));
  expect(screen.queryAllByText("Commandes copiées.")).toHaveLength(0);
});
