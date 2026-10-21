import { beforeEach, expect, test } from "bun:test";
import type { RunLogEntry } from "@kibo/schema";
import { act, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { formatClock } from "../agents/format";
import { CONVERSATION_LOG } from "./fixtures";
import { emitTopic, harness, mockPanelApi, panel, resetHarness, rpcs, showPanel } from "./panel-harness";

mockPanelApi();
const { ProjectAgentPanel } = await import("./ProjectAgentPanel");

type Pending = { resolve(): void; reject(e: Error): void };

let pending: Pending[] = [];

beforeEach(() => {
  resetHarness();
  pending = [];
  harness.send = () =>
    new Promise<unknown>((resolve, reject) => {
      pending.push({ resolve: () => resolve(null), reject });
    });
});

const settle = async (f: (p: Pending) => void) => {
  const next = pending.shift();
  if (!next) throw new Error("no pending send");
  await act(async () => f(next));
};

async function sendText(text: string) {
  const user = userEvent.setup();
  const box = await panel().findByRole("combobox", { name: "Message à l'agent de projet" });
  await user.type(box, text);
  await user.click(panel().getByRole("button", { name: "Envoyer" }));
  return { user, box };
}

test("the message shows with « envoi… » before the daemon answers, then once as a logged bubble", async () => {
  showPanel(ProjectAgentPanel);
  await sendText("Et F5 ?");
  const bubble = await panel().findByRole("listitem", { name: "Toi · envoi…" });
  expect(bubble.textContent).toContain("Et F5 ?");
  expect(within(bubble).getByText("envoi…")).toBeTruthy();
  const at = Date.now() + 1_000;
  const entry: RunLogEntry = { id: 10, at, event: { type: "answered", text: "Et F5 ?", rank: 0 } };
  harness.log = [...CONVERSATION_LOG, entry];
  await settle((p) => p.resolve());
  act(emitTopic);
  const logged = await panel().findByRole("listitem", { name: `Toi · ${formatClock(at)}` });
  expect(logged.textContent).toContain("Et F5 ?");
  expect(panel().queryByText("envoi…")).toBeNull();
  expect(panel().getAllByText("Et F5 ?")).toHaveLength(1);
});

test("a failed send keeps the bubble with Non envoyé and Réessayer, which sends the same text again", async () => {
  showPanel(ProjectAgentPanel);
  const { user, box } = await sendText("Et F5 ?");
  await settle((p) => p.reject(new Error("boom")));
  const bubble = await panel().findByRole("listitem", { name: "Toi · non envoyé" });
  expect(within(bubble).getByText("Non envoyé")).toBeTruthy();
  expect((box as HTMLTextAreaElement).value).toBe("Et F5 ?");
  await user.click(within(bubble).getByRole("button", { name: "Réessayer" }));
  await waitFor(() => expect(rpcs("sendProjectAgentMessage")).toHaveLength(2));
  expect(rpcs("sendProjectAgentMessage").at(-1)).toMatchObject({ text: "Et F5 ?" });
  expect(await panel().findByRole("listitem", { name: "Toi · envoi…" })).toBeTruthy();
  expect(panel().queryByRole("listitem", { name: "Toi · non envoyé" })).toBeNull();
});
