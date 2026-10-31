import { beforeEach, expect, test } from "bun:test";
import { WAKEUP_PREFIX } from "@kibo/schema";
import { act, cleanup, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NOW } from "../lib/fixtures";
import { CONVERSATION_LOG, emptyView, pendingBatch, projectRun, viewFixture } from "./fixtures";
import { formatClock } from "./format";
import { harness, mockPanelApi, panel, resetHarness, rpcs, showPanel } from "./panel-harness";

mockPanelApi();
const { ProjectAgentPanel } = await import("./ProjectAgentPanel");

const MIN = 60_000;
const show = () => showPanel(ProjectAgentPanel);
const you = (at: number) => `Toi · ${formatClock(at)}`;

beforeEach(resetHarness);

test("the panel is one conversation: Adam's bubbles with their time, the agent's answers, the batch card, no tabs nor menu", async () => {
  show();
  const p = panel();
  expect((await p.findByRole("listitem", { name: you(NOW - 30 * MIN) })).textContent).toContain(
    "Où en est-on ?",
  );
  expect(p.getByRole("listitem", { name: you(NOW - 10 * MIN) }).textContent).toContain("Et l'export ?");
  expect(p.getByRole("region", { name: "Lot n° 1" })).toBeTruthy();
  expect(p.getByRole("heading", { name: "Agent de projet · Silo" })).toBeTruthy();
  expect(p.queryByRole("tab")).toBeNull();
  expect(p.queryByRole("button", { name: "Actions de l'agent de projet" })).toBeNull();
  expect(p.queryByRole("heading", { name: "Résumé du jour" })).toBeNull();
  expect(p.queryByText(/Les états avancent seuls/)).toBeNull();
  expect(p.getByRole("button", { name: "Liste des agents" })).toBeTruthy();
  expect(p.getByRole("button", { name: "Nouvel agent" })).toBeTruthy();
  expect(p.getByRole("button", { name: "Agrandir" })).toBeTruthy();
  expect(p.getByRole("button", { name: "Fermer le panneau" })).toBeTruthy();
});

test("while a turn runs the conversation says so in orange, « En file » when queued", async () => {
  harness.current = viewFixture({ run: projectRun({ state: "running" }) });
  show();
  expect((await panel().findByRole("status")).textContent).toContain("L'agent lit le projet…");
  cleanup();
  harness.current = viewFixture({ run: projectRun({ state: "queued" }) });
  show();
  expect((await panel().findByRole("status")).textContent).toContain("En file");
});

test("the conversation is rendered with its batch card", async () => {
  show();
  expect(await panel().findByText("Où en est-on ?")).toBeTruthy();
  expect(panel().getByText("Lu : Tickets, SILO-11")).toBeTruthy();
  await userEvent.setup().click(await panel().findByRole("button", { name: "SILO-11" }));
  expect(harness.opened).toEqual(["t11"]);
});

test("the agent's markdown never injects HTML", async () => {
  harness.log = [
    {
      id: 1,
      at: 1,
      event: {
        type: "exited",
        code: 0,
        isError: false,
        result: "<script>alert(1)</script>",
        tokens: 0,
        costUsd: 0,
        denied: [],
      },
    },
  ];
  harness.current = viewFixture({ run: projectRun({ state: "done" }), batches: [] });
  show();
  expect(await panel().findByText("<script>alert(1)</script>")).toBeTruthy();
  expect(document.querySelector("[role=dialog] script")).toBeNull();
});

test("Shift+Enter adds a line, Enter and ⌘↵ send the message", async () => {
  show();
  const box = await panel().findByRole("textbox", { name: "Message à l'agent de projet" });
  expect(box.getAttribute("placeholder")).toBe("Écris à l'agent de projet…");
  const user = userEvent.setup();
  await user.type(box, "Bonjour{Shift>}{Enter}{/Shift}la suite");
  expect(rpcs("sendProjectAgentMessage")).toHaveLength(0);
  await user.keyboard("{Enter}");
  await waitFor(() =>
    expect(rpcs("sendProjectAgentMessage")).toEqual([
      { method: "sendProjectAgentMessage", projectId: "silo", text: "Bonjour\nla suite" },
    ]),
  );
  await waitFor(() => expect((box as HTMLTextAreaElement).value).toBe(""));
  await user.type(box, "Et F5 ?");
  await user.keyboard("{Meta>}{Enter}{/Meta}");
  await waitFor(() => expect(rpcs("sendProjectAgentMessage")).toHaveLength(2));
});

test("without a session the box invites to ask about the project, with no state line", async () => {
  harness.current = emptyView();
  harness.log = [];
  show();
  const box = await panel().findByRole("textbox", { name: "Message à l'agent de projet" });
  await waitFor(() => expect(box.getAttribute("placeholder")).toBe("Demande quelque chose sur Silo…"));
  expect(panel().getByText("Aucun message pour l'instant.")).toBeTruthy();
  expect(panel().queryByRole("status")).toBeNull();
  expect(panel().getByRole("button", { name: "Nouvel agent" }).hasAttribute("disabled")).toBe(true);
});

test("Réessayer sends the last message again", async () => {
  harness.current = viewFixture({ batches: [] });
  show();
  await userEvent.setup().click(await panel().findByRole("button", { name: "Réessayer" }));
  await waitFor(() =>
    expect(rpcs("sendProjectAgentMessage")).toEqual([
      { method: "sendProjectAgentMessage", projectId: "silo", text: "Et l'export ?" },
    ]),
  );
});

test("deciding a batch calls decideBatch for this project", async () => {
  show();
  const user = userEvent.setup();
  const card = within(await panel().findByRole("region", { name: /Lot n° 1/ }));
  await user.click(card.getByRole("button", { name: "Refuser" }));
  await user.click(card.getByRole("button", { name: "Confirmer le refus" }));
  await waitFor(() =>
    expect(rpcs("decideBatch")).toEqual([
      { method: "decideBatch", projectId: "silo", batchId: "b1", decision: "reject" },
    ]),
  );
});

test("Nouvel agent in the header asks for confirmation, then resets", async () => {
  show();
  const user = userEvent.setup();
  await user.click(await panel().findByRole("button", { name: "Nouvel agent" }));
  const confirm = await screen.findByRole("alertdialog");
  expect(rpcs("resetProjectAgent")).toHaveLength(0);
  await user.click(within(confirm).getByRole("button", { name: "Nouvel agent" }));
  await waitFor(() =>
    expect(rpcs("resetProjectAgent")).toEqual([{ method: "resetProjectAgent", projectId: "silo" }]),
  );
});

test("the panel is 340 px wide by default", async () => {
  show();
  await waitFor(() => expect(screen.getByRole("dialog").style.width).toBe("340px"));
});

test("the width is bounded, remembered, and the edge resizes with Shift+arrows", async () => {
  localStorage.setItem("kibo.projectAgent.width", "9999");
  show();
  await panel().findByText("Mettre à jour la note agent-de-projet/memoire.md");
  await waitFor(() => expect(screen.getByRole("dialog").style.width).toBe("720px"));
  const edge = panel().getByRole("button", { name: "Redimensionner le panneau" });
  edge.focus();
  const user = userEvent.setup();
  await user.keyboard("{Shift>}{ArrowRight}{/Shift}");
  expect(screen.getByRole("dialog").style.width).toBe("704px");
  expect(localStorage.getItem("kibo.projectAgent.width")).toBe("704");
  await user.keyboard("{Shift>}{ArrowLeft}{/Shift}{Shift>}{ArrowLeft}{/Shift}");
  expect(screen.getByRole("dialog").style.width).toBe("720px");
  localStorage.setItem("kibo.projectAgent.width", "10");
  act(() => {
    window.dispatchEvent(new StorageEvent("storage", { key: "kibo.projectAgent.width" }));
  });
  await waitFor(() => expect(screen.getByRole("dialog").style.width).toBe("340px"));
});

const ANSWER_WAKEUP = `${WAKEUP_PREFIX}1 réponse à lire.\n- Q16 répondue : « 5 Go »\nLis chaque réponse.`;

test("a wakeup on an answer shows as a discreet line, never as a bubble from Adam", async () => {
  harness.log = [
    ...CONVERSATION_LOG.slice(0, 6),
    { id: 90, at: NOW - 2_000, event: { type: "answered", text: ANSWER_WAKEUP, rank: 0 } },
  ];
  show();
  expect(await panel().findByText("Q16 répondue : « 5 Go »")).toBeTruthy();
  expect(panel().queryByText(ANSWER_WAKEUP)).toBeNull();
  expect(panel().getAllByRole("listitem", { name: /^Toi · / })).toHaveLength(1);
});

test("a batch after a wakeup says so, and an old dismissal shows as retired", async () => {
  harness.log = [
    {
      id: 1,
      at: 1,
      event: { type: "answered", text: "Réveil automatique : 3 signaux à traiter (…).", rank: 0 },
    },
  ];
  const actions = [
    { id: 1, type: "createTicket" as const, ref: "new:1", title: "Tests", why: "", signals: ["sig:1"] },
    { id: 2, type: "dismissSignal" as const, signal: "sig:3", why: "Déjà connu" },
  ];
  harness.current = viewFixture({ batches: [pendingBatch({ createdAt: 2, actions, expected: [] })] });
  show();
  expect(await panel().findByText("Réveil automatique · 3 signaux")).toBeTruthy();
  const card = within(await panel().findByRole("region", { name: /Lot n° 1/ }));
  expect(card.getByText("2 actions · après réveil")).toBeTruthy();
  expect(card.getByText("Créer le ticket « Tests »")).toBeTruthy();
  expect(card.queryByRole("button", { name: /opus-dev-2/ })).toBeNull();
  expect(card.getByText("Action retirée : Kibo ne lance plus d'agent de ticket")).toBeTruthy();
  expect(card.queryByText("Signal sig:3 : sans suite")).toBeNull();
  expect(card.getAllByRole("checkbox")).toHaveLength(1);
});
