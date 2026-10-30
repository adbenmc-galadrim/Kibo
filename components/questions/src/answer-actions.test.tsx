import { expect, test } from "bun:test";
import { type ProjectCommand, Question } from "@kibo/schema";
import { SdkProvider } from "@kibo/sdk";
import { seedDemo, seedQuestions } from "@kibo/sdk/fixtures";
import { createMockSdk, type MockSdkOptions } from "@kibo/sdk/mock";
import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Component, manifest } from "./index";

const OPEN = "Garder l'ordre des sous-tickets par index fractionnaire ?";
const ANSWERED = "Refuser les hooks d'un processus mort ?";

const seed = (run: (cmd: ProjectCommand) => unknown) => {
  const ids = seedDemo(run);
  seedQuestions(run, [ids["KIB-12"] ?? "", ids["KIB-14"] ?? ""]);
};

const mount = (opts: MockSdkOptions = {}) => {
  const m = createMockSdk(manifest, {
    seed,
    surface: "view",
    config: { scope: "all" },
    ...opts,
  });
  render(
    <SdkProvider sdk={m.sdk}>
      <Component />
    </SdkProvider>,
  );
  return m;
};

const named = (m: ReturnType<typeof mount>, title: string) =>
  m.snapshot().questions.find((q) => q.title === title);

const confirmIn = async (label: string) =>
  userEvent
    .setup()
    .click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: label }));

test("an answer not yet delivered is edited from a prefilled form", async () => {
  const m = mount();
  const user = userEvent.setup();
  const card = await screen.findByRole("article", { name: ANSWERED });
  expect(within(card).getByRole("button", { name: "Retirer la réponse" })).toBeTruthy();
  await user.click(within(card).getByRole("button", { name: "Modifier la réponse" }));
  const form = within(card).getByRole("form", { name: `Modifier la réponse à ${ANSWERED}` });
  const pressed = (name: string) => within(form).getByRole("button", { name }).getAttribute("aria-pressed");
  expect(pressed("Valider le choix provisoire")).toBe("true");
  expect(pressed("Non")).toBe("false");
  await user.click(within(form).getByRole("button", { name: "Non" }));
  expect(pressed("Non")).toBe("true");
  await user.click(within(form).getByRole("button", { name: "Enregistrer" }));
  await waitFor(() =>
    expect(named(m, ANSWERED)?.answer).toMatchObject({
      kind: "option",
      option: "Non",
      deliveredAt: null,
      by: { kind: "human", ref: "adam" },
    }),
  );
  expect(await within(card).findByText("Réponse : Non")).toBeTruthy();
  expect(within(card).queryByRole("form", { name: /Modifier la réponse/ })).toBeNull();
  expect(named(m, ANSWERED)?.history.map((e) => e.kind)).toEqual(["answer_edited"]);
});

test("a free text answer is edited with its current text", async () => {
  const m = mount();
  const user = userEvent.setup();
  const card = await screen.findByRole("article", { name: OPEN });
  await user.type(within(card).getByRole("textbox", { name: "Autre réponse…" }), "Racine{Enter}");
  await user.click(await within(card).findByRole("button", { name: "Modifier la réponse" }));
  const text = within(card).getByRole("textbox", { name: "Autre réponse…" }) as HTMLInputElement;
  expect(text.value).toBe("Racine");
  await user.clear(text);
  await user.type(text, "Partout{Enter}");
  await waitFor(() => expect(named(m, OPEN)?.answer).toMatchObject({ kind: "text", text: "Partout" }));
});

test("« Retirer la réponse » asks first, then reopens the question", async () => {
  const m = mount();
  const user = userEvent.setup();
  const card = await screen.findByRole("article", { name: ANSWERED });
  await user.click(within(card).getByRole("button", { name: "Retirer la réponse" }));
  await confirmIn("Retirer la réponse");
  await waitFor(() => expect(named(m, ANSWERED)?.answer).toBeNull());
  expect(await within(card).findByRole("form", { name: `Répondre à ${ANSWERED}` })).toBeTruthy();
  await user.click(within(card).getByText("Historique (1)"));
  expect(within(card).getByText("à l'instant · adam · Rouverte (réponse « Oui » retirée)")).toBeTruthy();
});

const markDelivered = (m: ReturnType<typeof mount>, title: string) => {
  const q = named(m, title);
  if (q === undefined) throw new Error(`no question ${title}`);
  act(() => {
    m.run({
      method: "markAnswersDelivered",
      ticketId: q.ticketId,
      questionIds: [q.id],
      runId: "r-old",
      at: 5,
    });
  });
};

test("an answer marked delivered before stays editable and removable", async () => {
  const m = mount();
  markDelivered(m, ANSWERED);
  const user = userEvent.setup();
  const card = await screen.findByRole("article", { name: ANSWERED });
  expect(within(card).queryByText(/figée/)).toBeNull();
  expect(within(card).queryByRole("button", { name: "Rouvrir" })).toBeNull();
  await user.click(within(card).getByRole("button", { name: "Modifier la réponse" }));
  await user.click(within(card).getByRole("button", { name: "Non" }));
  await user.click(within(card).getByRole("button", { name: "Enregistrer" }));
  await waitFor(() => expect(named(m, ANSWERED)?.answer).toMatchObject({ option: "Non", deliveredAt: null }));
  await user.click(await within(card).findByRole("button", { name: "Retirer la réponse" }));
  await confirmIn("Retirer la réponse");
  await waitFor(() => expect(named(m, ANSWERED)?.answer).toBeNull());
});

const headerOf = (card: HTMLElement) => {
  const header = card.querySelector("header");
  if (header === null) throw new Error("card without header");
  return within(header);
};

test("answer actions sit in the card header, next to the card menu", async () => {
  const m = mount();
  const user = userEvent.setup();
  const card = await screen.findByRole("article", { name: ANSWERED });
  const header = headerOf(card);
  const names = header.getAllByRole("button").map((b) => b.getAttribute("aria-label") ?? b.textContent);
  expect(names).toEqual(["Modifier la réponse", "Retirer la réponse", expect.stringMatching(/^Actions de /)]);
  await user.click(header.getByRole("button", { name: "Modifier la réponse" }));
  const form = within(card).getByRole("form", { name: `Modifier la réponse à ${ANSWERED}` });
  expect(form.closest("header")).toBeNull();
  expect(header.queryByRole("button", { name: "Modifier la réponse" })).toBeNull();
  await user.click(within(form).getByRole("button", { name: "Annuler" }));
  markDelivered(m, ANSWERED);
  await waitFor(() =>
    expect(
      headerOf(card)
        .getAllByRole("button")
        .map((b) => b.getAttribute("aria-label") ?? b.textContent),
    ).toEqual(["Modifier la réponse", "Retirer la réponse", expect.stringMatching(/^Actions de /)]),
  );
});

test("an imported answer stays editable", async () => {
  const seedImported = (run: (cmd: ProjectCommand) => unknown) => {
    const ids = seedDemo(run);
    const q = Question.parse(
      run({
        method: "createQuestion",
        ticketId: ids["KIB-12"] ?? "",
        title: "Arbitrage importé ?",
        createdBy: { kind: "import", ref: "plan" },
      }),
    );
    run({
      method: "answerQuestion",
      questionId: q.id,
      answer: { kind: "text", text: "Tranché" },
      by: { kind: "import", ref: "plan" },
    });
  };
  mount({ seed: seedImported });
  const card = await screen.findByRole("article", { name: "Arbitrage importé ?" });
  expect(within(card).getByRole("button", { name: "Modifier la réponse" })).toBeTruthy();
});

test("« Archiver » hides the question, « Archivées » shows it with « Restaurer »", async () => {
  const m = mount();
  const user = userEvent.setup();
  const open = await screen.findByRole("article", { name: OPEN });
  await user.click(within(open).getByRole("button", { name: /^Actions de / }));
  expect(screen.queryByRole("menuitem", { name: "Archiver" })).toBeNull();
  expect(screen.getByRole("menuitem", { name: "Supprimer" })).toBeTruthy();
  await user.keyboard("{Escape}");
  const card = screen.getByRole("article", { name: ANSWERED });
  await user.click(within(card).getByRole("button", { name: /^Actions de / }));
  await user.click(await screen.findByRole("menuitem", { name: "Archiver" }));
  const dialog = await screen.findByRole("alertdialog");
  expect(
    within(dialog).getByText(
      "La question est masquée ; tu peux la restaurer depuis le filtre « Archivées ».",
    ),
  ).toBeTruthy();
  await confirmIn("Archiver");
  await waitFor(() => expect(screen.queryByRole("article", { name: ANSWERED })).toBeNull());
  expect(named(m, ANSWERED)?.archivedBy).toEqual({ kind: "human", ref: "adam" });
  await user.click(screen.getByRole("radio", { name: "Archivées" }));
  const archived = await screen.findByRole("article", { name: ANSWERED });
  expect(screen.queryByRole("article", { name: OPEN })).toBeNull();
  expect(within(archived).getByText("Archivée par adam · à l'instant")).toBeTruthy();
  expect(within(archived).queryByRole("form")).toBeNull();
  expect(within(archived).queryByRole("button", { name: "Exporter" })).toBeNull();
  expect(within(archived).queryByRole("button", { name: /Destinataire :/ })).toBeNull();
  expect(within(archived).queryByRole("button", { name: "Modifier la réponse" })).toBeNull();
  await user.click(within(archived).getByRole("button", { name: "Restaurer" }));
  await waitFor(() => expect(named(m, ANSWERED)?.archivedAt).toBeNull());
  await user.click(screen.getByRole("radio", { name: "Toutes" }));
  expect(await screen.findByRole("article", { name: ANSWERED })).toBeTruthy();
});

test("the history lists events newest first, folded under its count", async () => {
  const m = mount();
  const user = userEvent.setup();
  const card = await screen.findByRole("article", { name: ANSWERED });
  expect(within(card).queryByText(/^Historique/)).toBeNull();
  await user.click(within(card).getByRole("button", { name: "Destinataire : Moi (technique)" }));
  await user.click(await screen.findByRole("menuitemradio", { name: "Client" }));
  await waitFor(() => expect(named(m, ANSWERED)?.recipient).toBe("client"));
  await user.click(within(card).getByRole("button", { name: "Modifier la réponse" }));
  await user.click(within(card).getByRole("button", { name: "Non" }));
  await user.click(within(card).getByRole("button", { name: "Enregistrer" }));
  const summary = await within(card).findByText("Historique (2)");
  await user.click(summary);
  const lines = within(card)
    .getAllByRole("listitem")
    .map((li) => li.textContent);
  expect(lines).toEqual([
    "à l'instant · adam · Réponse modifiée (« Oui » → « Non »)",
    "à l'instant · adam · Modifiée (destinataire : Moi (technique) → Client)",
  ]);
});
