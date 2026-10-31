import { expect, test } from "bun:test";
import type { Batch, StoredProposedAction } from "@kibo/schema";
import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BatchCard, type Decision } from "./BatchCard";
import { defaultLabels, projectLabels } from "./batch-groups";
import { partialBatch, pendingBatch, questionsProject, siloProject } from "./fixtures";
import { projectQuestionLinks, QuestionLinksContext } from "./QuestionText";

function show(batch: Batch, readOnly = false) {
  const decisions: Decision[] = [];
  render(
    <BatchCard
      batch={batch}
      labels={projectLabels(siloProject())}
      afterWakeup={false}
      readOnly={readOnly}
      onDecide={async (d) => {
        decisions.push(d);
      }}
    />,
  );
  const card = within(screen.getByRole("region", { name: /Lot n° 1/ }));
  return { decisions, card };
}

test("a pending batch is compact: header, one checked line per action, no summary or group", () => {
  const { card } = show(pendingBatch());
  expect(card.getByRole("heading", { name: "Lot n° 1" })).toBeTruthy();
  expect(card.getByText("7 actions")).toBeTruthy();
  expect(card.queryByText("Passer SILO-11 en review et lancer l'export")).toBeNull();
  expect(card.queryAllByRole("group")).toHaveLength(0);
  expect(card.queryByRole("button", { name: /Tout (dé)?cocher/ })).toBeNull();
  const boxes = card.getAllByRole("checkbox");
  expect(boxes).toHaveLength(7);
  expect(boxes.every((b) => b.getAttribute("aria-checked") === "true")).toBe(true);
  expect(card.getAllByRole("button").map((b) => b.textContent)).toEqual(["Valider (7)", "Refuser"]);
  expect(card.getAllByText("En cours")).toHaveLength(2);
  expect(card.getByText("En review")).toBeTruthy();
  expect(card.getByText("Export CSV")).toBeTruthy();
  expect(card.getByText("Le code est prêt")).toBeTruthy();
  expect(card.getByText("contenu remplacé")).toBeTruthy();
});

test("Valider counts the checked boxes and sends only them, in order", async () => {
  const { card, decisions } = show(pendingBatch());
  const user = userEvent.setup();
  await user.click(card.getByRole("checkbox", { name: "SILO-12 : passer en En cours" }));
  await user.click(card.getByRole("checkbox", { name: /^Question sur SILO-12/ }));
  await user.click(card.getByRole("button", { name: "Valider (5)" }));
  expect(decisions).toEqual([{ decision: "apply", actionIds: [1, 2, 3, 6, 7] }]);
});

test("unchecking every line disables Valider", async () => {
  const { card } = show(pendingBatch());
  const user = userEvent.setup();
  for (const box of card.getAllByRole("checkbox")) await user.click(box);
  expect((card.getByRole("button", { name: "Valider (0)" }) as HTMLButtonElement).disabled).toBe(true);
});

test("Refuser asks for an optional comment, then rejects with it", async () => {
  const { card, decisions } = show(pendingBatch());
  const user = userEvent.setup();
  await user.click(card.getByRole("button", { name: "Refuser" }));
  await user.type(
    card.getByRole("textbox", { name: "Commentaire pour l'agent (facultatif)" }),
    "Pas maintenant",
  );
  await user.click(card.getByRole("button", { name: "Confirmer le refus" }));
  expect(decisions).toEqual([{ decision: "reject", comment: "Pas maintenant" }]);
});

test("a refusal without comment sends no comment", async () => {
  const { card, decisions } = show(pendingBatch());
  const user = userEvent.setup();
  await user.click(card.getByRole("button", { name: "Refuser" }));
  await user.click(card.getByRole("button", { name: "Confirmer le refus" }));
  expect(decisions).toEqual([{ decision: "reject" }]);
});

test("after the decision each action shows its result and no box or button remains", () => {
  const { card } = show({ ...partialBatch(), seq: 1 });
  expect(card.getByText("Appliqué en partie")).toBeTruthy();
  expect(card.queryAllByRole("checkbox")).toHaveLength(0);
  expect(card.queryAllByRole("button")).toHaveLength(0);
  expect(card.getAllByText("Appliquée")).toHaveLength(3);
  expect(card.getByText("Périmée")).toBeTruthy();
  expect(card.getByText("Échec")).toBeTruthy();
  expect(card.getByText("profil désactivé")).toBeTruthy();
  expect(card.getAllByText("Ignorée")).toHaveLength(2);
  expect(card.getByText("SILO-13")).toBeTruthy();
});

test("a batch being applied (partial without results) says so and never shows a failure", () => {
  const { card } = show(pendingBatch({ status: "partial", decidedAt: 1, chosen: [1], results: [] }));
  expect(card.getByText("Application en cours…")).toBeTruthy();
  expect(card.queryByText("Échec")).toBeNull();
  expect(card.queryByText("Appliqué en partie")).toBeNull();
  expect(card.queryAllByRole("button")).toHaveLength(0);
});

test("superseded, abandoned and rejected batches carry only their label", () => {
  for (const [status, label] of [
    ["superseded", "Remplacé par un lot plus récent"],
    ["abandoned", "Abandonné"],
    ["rejected", "Refusé"],
  ] as const) {
    const view = render(
      <BatchCard
        batch={pendingBatch({ status })}
        labels={defaultLabels}
        afterWakeup={false}
        readOnly={false}
        onDecide={async () => {}}
      />,
    );
    const card = within(view.getByRole("region", { name: /Lot n° 1/ }));
    expect(card.getByText(label)).toBeTruthy();
    expect(card.queryAllByRole("checkbox")).toHaveLength(0);
    expect(card.queryAllByRole("button")).toHaveLength(0);
    view.unmount();
  }
});

test("a pending batch read from an old agent cannot be decided", () => {
  const { card } = show(pendingBatch(), true);
  expect(card.queryAllByRole("checkbox")).toHaveLength(0);
  expect(card.queryByRole("button", { name: /Valider/ })).toBeNull();
});

test("a question line names its question, previews it and opens it", async () => {
  const project = questionsProject();
  const opened: string[] = [];
  const batch = pendingBatch({
    actions: [
      { id: 1, type: "addRecipient", name: "Galadrim", why: "" },
      { id: 2, type: "createQuestion", ticket: "SILO-11", title: "Police ?", recipient: "client", why: "" },
      {
        id: 3,
        type: "updateQuestion",
        questionId: "q-logo",
        title: "Logo ?",
        recipient: "Galadrim",
        why: "",
      },
      { id: 4, type: "reopenQuestion", questionId: "q-port", why: "" },
    ],
    expected: [{ actionId: 3, fields: { title: "Client - Logo ?", recipient: "client", delivered: false } }],
  });
  render(
    <QuestionLinksContext.Provider value={projectQuestionLinks(project, (id) => opened.push(id))}>
      <BatchCard
        batch={batch}
        labels={projectLabels(project)}
        afterWakeup={false}
        readOnly={false}
        onDecide={async () => {}}
      />
    </QuestionLinksContext.Provider>,
  );
  const group = within(screen.getByRole("region", { name: "Lot n° 1" }));
  expect(group.getByText("Ajouter le destinataire « Galadrim »")).toBeTruthy();
  expect(group.getByText("Question sur SILO-11 pour Client : « Police ? »")).toBeTruthy();
  expect(group.getByText("Titre :")).toBeTruthy();
  expect(group.getByText("Client - Logo ?")).toBeTruthy();
  expect(group.getByText("Destinataire :")).toBeTruthy();
  const rename = group.getByRole("button", { name: "Modifier la question « Client - Logo ? »" });
  fireEvent.focus(rename);
  expect(await screen.findByText("Le logo actuel est trop petit sur mobile.")).toBeTruthy();
  await userEvent
    .setup()
    .click(group.getByRole("button", { name: "Rouvrir « Quel port ? » (réponse retirée)" }));
  expect(opened).toEqual(["q-port"]);
  const box = group.getByRole("checkbox", { name: "Rouvrir « Quel port ? » (réponse retirée)" });
  expect(box.getAttribute("aria-checked")).toBe("true");
});

test("a question line says an old delivered answer is answered, without naming a run", async () => {
  const base = questionsProject();
  const delivered = {
    by: { kind: "human" as const, ref: "adam" },
    at: 2,
    deliveredAt: 3,
    deliveredRunId: "e1",
  };
  const project = {
    ...base,
    questions: base.questions.map((q) =>
      q.id === "q-port"
        ? { ...q, answer: { kind: "text" as const, option: null, text: "8080", ...delivered } }
        : q,
    ),
  };
  render(
    <QuestionLinksContext.Provider value={projectQuestionLinks(project, () => {})}>
      <BatchCard
        batch={pendingBatch({ actions: [{ id: 1, type: "reopenQuestion", questionId: "q-port", why: "" }] })}
        labels={projectLabels(project)}
        afterWakeup={false}
        readOnly={false}
        onDecide={async () => {}}
      />
    </QuestionLinksContext.Provider>,
  );
  fireEvent.focus(screen.getByRole("button", { name: "Rouvrir « Quel port ? » (réponse retirée)" }));
  expect(await screen.findByText(/· répondue$/)).toBeTruthy();
  expect(screen.queryByText(/transmise/)).toBeNull();
});

test("a partly decided batch shows the result of its decided actions and decides only the others", async () => {
  const applied = { actionId: 1, outcome: "applied" as const, detail: null, created: null };
  const { card, decisions } = show(pendingBatch({ chosen: [1], results: [applied] }));
  expect(card.getAllByRole("checkbox")).toHaveLength(6);
  expect(card.getAllByText("Appliquée")).toHaveLength(1);
  await userEvent.setup().click(card.getByRole("button", { name: "Valider (6)" }));
  expect(decisions).toEqual([{ decision: "apply", actionIds: [2, 3, 4, 5, 6, 7] }]);
});

test("a stored assignAgent action shows as retired, without a box, and Valider leaves it out", async () => {
  const retired: StoredProposedAction = {
    id: 9,
    type: "assignAgent",
    ticket: "SILO-12",
    profileId: "opus",
    why: "Personne n'y travaille",
  };
  const batch = pendingBatch({
    actions: [
      { id: 1, type: "setStatus", ticket: "SILO-11", statusId: "in_review", why: "Le code est prêt" },
      retired,
    ],
  });
  const { card, decisions } = show(batch);
  const line = card.getByText("Action retirée : Kibo ne lance plus d'agent de ticket");
  expect(line.closest("li")?.querySelector("[role=checkbox]")).toBeNull();
  expect(line.closest("li")?.querySelector("button")).toBeNull();
  expect(card.getAllByRole("checkbox")).toHaveLength(1);
  expect(card.queryByText(/opus/)).toBeNull();
  await userEvent.setup().click(card.getByRole("button", { name: "Valider (1)" }));
  expect(decisions).toEqual([{ decision: "apply", actionIds: [1] }]);
});
