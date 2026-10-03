import { beforeEach, expect, mock, test } from "bun:test";
import { KiboError, type RpcRequest } from "@kibo/schema";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { agentsFixture, NOW, profilesFixture } from "./fixtures";

const calls: RpcRequest[] = [];
let outcome: () => Promise<unknown> = () => Promise.resolve(null);

mock.module("../api", () => ({
  client: {
    rpc: (req: RpcRequest) => {
      calls.push(req);
      return outcome();
    },
  },
}));

const { moveTarget, QueuePage } = await import("./QueuePage");
const { PauseAdmission } = await import("./PauseAdmission");

beforeEach(() => {
  calls.length = 0;
  outcome = () => Promise.resolve(null);
});

const show = (onAnswer: (runId: string) => void = () => {}) =>
  render(<QueuePage state={agentsFixture()} profiles={profilesFixture} now={NOW} onAnswer={onAnswer} />);

test("capacity shows one card per place, the gauges and the admission rule", () => {
  show();
  const capacity = within(screen.getByRole("region", { name: "Capacité de la machine" }));
  const cards = capacity.getAllByRole("listitem");
  expect(cards.map((c) => c.textContent)).toEqual([
    "Place 1opus-dev-1KIB-12 · 12m",
    "Place 2opus-dev-3KIB-16 · 4m",
    "Place 3sonnet-review-1KIB-7 · 1m",
  ]);
  expect(capacity.getByText("62 % · seuil 85 %")).toBeTruthy();
  expect(capacity.getByText("11,2 / 16 Go · seuil 90 %")).toBeTruthy();
  expect(capacity.getByRole("progressbar", { name: "CPU" })).toBeTruthy();
  expect(capacity.getByText("Places sur la machine : 3 (auto : 8 cœurs, 16 Go)")).toBeTruthy();
});

test("profiles with runs come first, then the idle ones, each group by name", () => {
  const byName = [...profilesFixture].sort((a, b) => a.name.localeCompare(b.name));
  render(<QueuePage state={agentsFixture()} profiles={byName} now={NOW} onAnswer={() => {}} />);
  const columns = screen
    .getAllByRole("region")
    .map((r) => r.getAttribute("aria-label"))
    .filter((name) => profilesFixture.some((p) => p.name === name));
  expect(columns).toEqual(["opus-dev", "sonnet-review", "haiku-tests"]);
});

test("a first turn with a message keeps its queue reason", () => {
  const state = agentsFixture();
  const runs = state.runs.map((r) =>
    r.id === "q18" ? { ...r, pendingAnswer: "Commence par les tests." } : r,
  );
  render(<QueuePage state={{ ...state, runs }} profiles={profilesFixture} now={NOW} onAnswer={() => {}} />);
  const opus = within(screen.getByRole("region", { name: "opus-dev" }));
  const q18 = opus.getAllByRole("listitem").find((li) => li.dataset.run === "q18");
  if (!q18) throw new Error("queue item q18 missing");
  expect(within(q18).getByText("attend une place du profil opus-dev (2/2)")).toBeTruthy();
  expect(within(q18).queryByText("réponse reçue · reprise de la session")).toBeNull();
});

test("a message that resumes a finished run says so, an answer to a question says so too", () => {
  const state = agentsFixture();
  const runs = state.runs.map((r) =>
    r.id === "q29" ? { ...r, turns: 1, pendingAnswer: "Ajoute les tests.", question: null } : r,
  );
  render(<QueuePage state={{ ...state, runs }} profiles={profilesFixture} now={NOW} onAnswer={() => {}} />);
  const opus = within(screen.getByRole("region", { name: "opus-dev" }));
  const item = (runId: string) => {
    const li = opus.getAllByRole("listitem").find((x) => x.dataset.run === runId);
    if (!li) throw new Error(`queue item ${runId} missing`);
    return within(li);
  };
  expect(item("q29").getByText("message reçu · reprise de la session")).toBeTruthy();
  expect(item("q29").queryByText("réponse reçue · reprise de la session")).toBeNull();
  expect(item("q10").getByText("réponse reçue · reprise de la session")).toBeTruthy();
});

test("fixed host slots say so and still give the automatic value", () => {
  const state = agentsFixture();
  render(
    <QueuePage
      state={{ ...state, host: { ...state.host, autoSlots: 5, slotsFixed: true } }}
      profiles={profilesFixture}
      now={NOW}
      onAnswer={() => {}}
    />,
  );
  const capacity = within(screen.getByRole("region", { name: "Capacité de la machine" }));
  expect(capacity.getByText("Places sur la machine : 3 (fixé · auto : 5)")).toBeTruthy();
  expect(capacity.getByRole("button", { name: "modifiable" })).toBeTruthy();
});

test("each profile lists its running runs and its queue in order", () => {
  show();
  const opus = within(screen.getByRole("region", { name: "opus-dev" }));
  expect(opus.getByText("2/2")).toBeTruthy();
  expect(opus.getByText("KIB-12 · Schéma Loro des tickets")).toBeTruthy();
  const items = opus.getAllByRole("listitem").filter((li) => li.dataset.queued === "true");
  expect(items.map((li) => li.dataset.run)).toEqual(["q10", "q18", "q29"]);
  const item = (runId: string) => {
    const li = items.find((x) => x.dataset.run === runId);
    if (!li) throw new Error(`queue item ${runId} missing`);
    return within(li);
  };
  expect(item("q10").getByText("#1")).toBeTruthy();
  expect(item("q10").getByText("Prioritaire")).toBeTruthy();
  expect(item("q10").getByText("réponse reçue · reprise de la session")).toBeTruthy();
  expect(item("q29").getByText("attend une place sur la machine (3/3)")).toBeTruthy();
  const sonnet = within(screen.getByRole("region", { name: "sonnet-review" }));
  expect(sonnet.getByText("1/3")).toBeTruthy();
  expect(sonnet.getByText("Vide")).toBeTruthy();
});

test("sub-agents run in their parent's slot and the waiting column offers an answer", async () => {
  const onAnswer = mock((_: string) => {});
  show(onAnswer);
  const haiku = within(screen.getByRole("region", { name: "haiku-tests" }));
  expect(haiku.getByText("sous-agent")).toBeTruthy();
  expect(haiku.getByText("Dans la place de opus-dev-1")).toBeTruthy();
  expect(haiku.getByText("KIB-12 · Schéma Loro des tickets")).toBeTruthy();
  const waiting = within(screen.getByRole("region", { name: "En attente de réponse" }));
  expect(waiting.getByText("« Quel port pour le récepteur ? 4747 (défaut) ou dynamique ? »")).toBeTruthy();
  await userEvent.setup().click(waiting.getByRole("button", { name: "Répondre à opus-dev-2" }));
  expect(onAnswer).toHaveBeenCalledWith("r41");
});

test("the item menu moves, prioritizes and removes queued runs after a confirmation", async () => {
  show();
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: "Actions KIB-18" }));
  await user.click(await screen.findByRole("menuitem", { name: "Monter" }));
  await user.click(screen.getByRole("button", { name: "Actions KIB-10" }));
  await user.click(await screen.findByRole("menuitem", { name: "Retirer la priorité" }));
  await user.click(screen.getByRole("button", { name: "Actions KIB-29" }));
  expect((await screen.findByRole("menuitem", { name: "Descendre" })).getAttribute("aria-disabled")).toBe(
    "true",
  );
  await user.click(screen.getByRole("menuitem", { name: "Retirer de la file" }));
  const dialog = within(await screen.findByRole("alertdialog"));
  expect(dialog.getByText("Retirer KIB-29 de la file ?")).toBeTruthy();
  expect(dialog.getByText("Le run ne démarrera pas ; le ticket reste assigné.")).toBeTruthy();
  expect(calls).toHaveLength(2);
  await user.click(dialog.getByRole("button", { name: "Retirer" }));
  await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
  expect(calls).toEqual([
    { method: "moveRun", runId: "q18", index: 0 },
    { method: "setRunPriority", runId: "q10", priority: false },
    { method: "cancelRun", runId: "q29" },
  ]);
});

test("host slots can be changed; a refusal is shown", async () => {
  show();
  expect(screen.queryByRole("button", { name: "Mettre en pause l'admission" })).toBeNull();
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: "modifiable" }));
  const slots = screen.getByLabelText("Places sur la machine");
  await user.clear(slots);
  await user.type(slots, "4");
  await user.click(screen.getByRole("button", { name: "Enregistrer" }));
  expect(calls).toEqual([{ method: "setHost", patch: { hostSlots: 4 } }]);
  outcome = () => Promise.reject(new KiboError("INVALID_INPUT", "no"));
  await user.click(screen.getByRole("button", { name: "modifiable" }));
  await user.click(screen.getByRole("button", { name: "Enregistrer" }));
  expect((await screen.findByRole("alert")).textContent).toBe("Action impossible.");
});

test("admission is paused and resumed from the header; a refusal is shown", async () => {
  const user = userEvent.setup();
  const view = render(<PauseAdmission paused={false} />);
  await user.click(screen.getByRole("button", { name: "Mettre en pause l'admission" }));
  view.rerender(<PauseAdmission paused />);
  await user.click(screen.getByRole("button", { name: "Reprendre l'admission" }));
  expect(calls).toEqual([
    { method: "setHost", patch: { paused: true } },
    { method: "setHost", patch: { paused: false } },
  ]);
  outcome = () => Promise.reject(new KiboError("INVALID_INPUT", "no"));
  await user.click(screen.getByRole("button", { name: "Reprendre l'admission" }));
  expect((await screen.findByRole("alert")).textContent).toBe("Action impossible.");
});

test("dropping a run on another one takes that run's place in the whole queue", () => {
  const queue = agentsFixture().queue;
  expect(moveTarget(queue, "q29", "q10")).toBe(0);
  expect(moveTarget(queue, "q10", "q29")).toBe(2);
  expect(moveTarget(queue, "q10", "q10")).toBeNull();
  expect(moveTarget(queue, "q10", null)).toBeNull();
  expect(moveTarget(queue, "q10", "r42")).toBeNull();
});
