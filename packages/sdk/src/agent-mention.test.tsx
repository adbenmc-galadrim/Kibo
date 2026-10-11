import { afterEach, beforeEach, expect, jest, mock, test } from "bun:test";
import { KiboError, type RunPeek } from "@kibo/schema";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { AgentMention, type MentionTexts } from "./agent-mention";

const PEEK: RunPeek = {
  runId: "r1",
  label: "opus-dev-1",
  profileName: "opus-dev",
  state: "running",
  ticketKey: "KIB-14",
  ticketTitle: "Corriger le formulaire",
  step: { index: 2, total: 5, title: "Corriger la validation" },
  lastMessage: `Je corrige la validation. ${"x".repeat(300)}`,
  waiting: false,
};

const texts: MentionTexts = {
  history: "Voir l'historique",
  reply: "Répondre",
  step: (index, total, title) => `${index}/${total} · ${title}`,
  state: (state) => (state === "running" ? "en cours" : state),
  waiting: "attend une réponse",
};

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

function mount(peek: (runId: string) => Promise<RunPeek>, onReply?: (runId: string) => void) {
  const onOpen = mock((_runId: string) => {});
  const spy = mock(peek);
  render(
    <AgentMention
      runId="r1"
      label="opus-dev-1"
      state="running"
      texts={texts}
      peek={spy}
      onOpen={onOpen}
      onReply={onReply}
    />,
  );
  return { onOpen, peek: spy, trigger: screen.getByRole("button", { name: /opus-dev-1/ }) };
}

async function settle(ms: number) {
  await act(async () => {
    jest.advanceTimersByTime(ms);
    await Promise.resolve();
  });
}

test("the mention is a button with a monospace label and the run dot", () => {
  const { trigger } = mount(async () => PEEK);
  expect(trigger.querySelector(".font-mono")?.textContent).toBe("opus-dev-1");
  expect(trigger.querySelector("[data-state='running']")).not.toBeNull();
});

test("hovering for 300 ms peeks once and shows the card", async () => {
  const { peek, onOpen, trigger } = mount(async () => PEEK);
  fireEvent.pointerEnter(trigger);
  await settle(300);
  await settle(0);
  expect(peek).toHaveBeenCalledTimes(1);
  expect(screen.getByText("opus-dev")).toBeDefined();
  expect(screen.getByText("en cours")).toBeDefined();
  expect(screen.getByText("KIB-14 · Corriger le formulaire")).toBeDefined();
  expect(screen.getByText("2/5 · Corriger la validation")).toBeDefined();
  const message = screen.getByText(/^Je corrige la validation\./);
  expect(message.textContent?.length).toBeLessThanOrEqual(201);
  expect(screen.queryByRole("button", { name: "Répondre" })).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Voir l'historique" }));
  expect(onOpen).toHaveBeenCalledWith("r1");
});

test("a waiting run offers to reply", async () => {
  const onReply = mock((_runId: string) => {});
  const { trigger } = mount(async () => ({ ...PEEK, state: "waiting_input", waiting: true }), onReply);
  fireEvent.pointerEnter(trigger);
  await settle(300);
  await settle(0);
  expect(screen.getByText("attend une réponse")).toBeDefined();
  fireEvent.click(screen.getByRole("button", { name: "Répondre" }));
  expect(onReply).toHaveBeenCalledWith("r1");
});

test("a short hover does not peek", async () => {
  const { peek, trigger } = mount(async () => PEEK);
  fireEvent.pointerEnter(trigger);
  await settle(100);
  fireEvent.pointerLeave(trigger);
  await settle(500);
  expect(peek).not.toHaveBeenCalled();
});

test("a click opens the run at once", () => {
  const { peek, onOpen, trigger } = mount(async () => PEEK);
  fireEvent.click(trigger);
  expect(onOpen).toHaveBeenCalledWith("r1");
  expect(peek).not.toHaveBeenCalled();
});

test("a failed peek shows a missing run without throwing", async () => {
  const { trigger } = mount(async () => {
    throw new KiboError("NOT_FOUND", "run r1 not found");
  });
  fireEvent.pointerEnter(trigger);
  await settle(300);
  await settle(0);
  expect(screen.getByText("Run introuvable")).toBeDefined();
});

test("keyboard focus opens the card", async () => {
  const { peek, trigger } = mount(async () => PEEK);
  fireEvent.focus(trigger);
  await settle(0);
  expect(peek).toHaveBeenCalledTimes(1);
  expect(screen.getByText("2/5 · Corriger la validation")).toBeDefined();
});
