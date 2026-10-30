import { expect, test } from "bun:test";
import { type ProjectCommand, Question, type Surface } from "@kibo/schema";
import { SdkProvider } from "@kibo/sdk";
import { runConformance } from "@kibo/sdk/conformance";
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

runConformance({ manifest, Component }, seed);

const mount = (surface: Surface, opts: MockSdkOptions = {}) => {
  const m = createMockSdk(manifest, { seed, surface, agentExecution: "shown", ...opts });
  render(
    <SdkProvider sdk={m.sdk}>
      <Component />
    </SdkProvider>,
  );
  return m;
};

const questionNamed = (m: ReturnType<typeof mount>, title: string) =>
  m.snapshot().questions.find((q) => q.title === title);

test("the widget lists open questions, answers one inline and sends a public command", async () => {
  const m = mount("widget");
  const user = userEvent.setup();
  expect(await screen.findByText(OPEN)).toBeTruthy();
  expect(screen.getByText("Questions ouvertes · 1")).toBeTruthy();
  expect(screen.queryByText(ANSWERED)).toBeNull();
  expect(screen.getByText("provisoire : Oui")).toBeTruthy();
  await user.click(screen.getByRole("button", { name: /Garder l'ordre/ }));
  await user.click(screen.getByRole("button", { name: "Valider le choix provisoire" }));
  await waitFor(() =>
    expect(questionNamed(m, OPEN)?.answer).toMatchObject({
      kind: "confirm",
      option: "Oui",
      by: { kind: "human", ref: "adam" },
    }),
  );
  expect(await screen.findByText("Aucune question ouverte.")).toBeTruthy();
  expect(screen.getByText("Questions ouvertes · 0")).toBeTruthy();
});

test("a free answer and an option answer go through the same form", async () => {
  const m = mount("widget");
  const user = userEvent.setup();
  await user.click(await screen.findByRole("button", { name: /Garder l'ordre/ }));
  await user.type(screen.getByRole("textbox", { name: "Autre réponse…" }), "  Seulement à la racine ");
  await user.click(screen.getByRole("button", { name: "Répondre" }));
  await waitFor(() =>
    expect(questionNamed(m, OPEN)?.answer).toMatchObject({ kind: "text", text: "Seulement à la racine" }),
  );
});

test("a saved answer is shown as given, with no delivery to do", async () => {
  mount("view");
  const user = userEvent.setup();
  await user.click(await screen.findByRole("radio", { name: "Toutes" }));
  const group = await screen.findByRole("region", { name: /KIB-14/ });
  expect(within(group).getByText(/^Répondu par adam/)).toBeTruthy();
  expect(within(group).queryByText("à transmettre")).toBeNull();
  expect(within(group).queryByText(/figée/)).toBeNull();
  expect(screen.queryByRole("button", { name: /Transmettre/ })).toBeNull();
});

test("the widget offers no delivery under its list", async () => {
  mount("widget");
  expect(await screen.findByText(OPEN)).toBeTruthy();
  expect(screen.queryByRole("button", { name: /Transmettre/ })).toBeNull();
});

const IMPORT = { kind: "import", ref: "plan" } as const;

const seedImported = (run: (cmd: ProjectCommand) => unknown) => {
  const ids = seedDemo(run);
  const imported = Question.parse(
    run({
      method: "createQuestion",
      ticketId: ids["KIB-12"] ?? "",
      title: "Arbitrage importé du plan ?",
      blocking: true,
      createdBy: IMPORT,
    }),
  );
  run({
    method: "answerQuestion",
    questionId: imported.id,
    answer: { kind: "text", text: "Tranché dans le plan" },
    by: IMPORT,
  });
};

test("an imported answer is shown like any other", async () => {
  mount("view", { seed: seedImported });
  const user = userEvent.setup();
  expect(await screen.findByText("Aucune question ouverte.")).toBeTruthy();
  await user.click(screen.getByRole("radio", { name: "Toutes" }));
  const group = await screen.findByRole("region", { name: /KIB-12/ });
  expect(within(group).getByText("Arbitrage importé du plan ?")).toBeTruthy();
  expect(within(group).getByText("Réponse : Tranché dans le plan")).toBeTruthy();
  expect(within(group).queryByText("à transmettre")).toBeNull();
  expect(screen.queryByRole("button", { name: /Transmettre/ })).toBeNull();
});

test("the view filters by state and ticket", async () => {
  const m = mount("view");
  const user = userEvent.setup();
  expect(await screen.findByText(OPEN)).toBeTruthy();
  expect(screen.queryByText(ANSWERED)).toBeNull();
  await user.click(screen.getByRole("radio", { name: "Répondues" }));
  expect(screen.getByText(ANSWERED)).toBeTruthy();
  expect(screen.queryByText(OPEN)).toBeNull();
  await user.click(screen.getByRole("radio", { name: "Toutes" }));
  await user.click(screen.getByRole("button", { name: "Tous les tickets" }));
  await user.type(screen.getByRole("textbox", { name: "Rechercher une clé" }), "14");
  await user.click(await screen.findByRole("menuitem", { name: /KIB-14/ }));
  expect(screen.getByText(ANSWERED)).toBeTruthy();
  expect(screen.queryByText(OPEN)).toBeNull();
  await user.click(
    within(screen.getByRole("region", { name: /KIB-14/ })).getByRole("button", { name: /KIB-14/ }),
  );
  expect(m.opened).toEqual([questionNamed(m, ANSWERED)?.ticketId ?? ""]);
});

test("a question is created by hand, as the viewer, with six options at most", async () => {
  const m = mount("view");
  const user = userEvent.setup();
  await user.click(await screen.findByRole("button", { name: "Nouvelle question" }));
  const dialog = await screen.findByRole("dialog");
  const ticket = within(dialog).getByRole("combobox", { name: "Ticket" });
  ticket.focus();
  await user.keyboard("{Enter}");
  await user.click(await screen.findByRole("option", { name: /KIB-9/ }));
  await user.type(within(dialog).getByRole("textbox", { name: "Question" }), "Signer l'app ?");
  await user.type(within(dialog).getByRole("textbox", { name: "Contexte (Markdown)" }), "Voir `tauri`");
  const options = within(dialog).getByRole("textbox", { name: "Options, une par ligne" });
  await user.type(options, "a{Enter}b{Enter}c{Enter}d{Enter}e{Enter}f{Enter}g");
  await user.click(within(dialog).getByRole("button", { name: "Créer la question" }));
  expect(within(dialog).getByRole("alert").textContent).toBe("6 options au plus.");
  await user.clear(options);
  await user.type(options, "Oui{Enter}Non");
  await user.click(within(dialog).getByRole("button", { name: "Créer la question" }));
  await waitFor(() => expect(questionNamed(m, "Signer l'app ?")).toBeTruthy());
  expect(questionNamed(m, "Signer l'app ?")).toMatchObject({
    options: ["Oui", "Non"],
    provisional: null,
    blocking: false,
    runId: null,
    context: "Voir `tauri`",
    createdBy: { kind: "human", ref: "adam" },
  });
  expect(questionNamed(m, "Signer l'app ?")?.ticketId).toBe(
    m.snapshot().tickets.find((t) => t.key === "KIB-9")?.id ?? "",
  );
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
});

test("the context is rendered without raw HTML", async () => {
  const m = mount("view");
  const ticketId = m.snapshot().tickets.find((t) => t.key === "KIB-3")?.id ?? "";
  act(() => {
    m.run({
      method: "createQuestion",
      ticketId,
      title: "Échapper le contexte ?",
      context: "<script>alert(1)</script>\n\n- `code`",
      createdBy: { kind: "human", ref: "adam" },
    });
  });
  const card = await screen.findByRole("article", { name: "Échapper le contexte ?" });
  expect(card.querySelector("script")).toBeNull();
  expect(within(card).getByText("<script>alert(1)</script>")).toBeTruthy();
  expect(card.querySelector("li code")?.textContent).toBe("code");
});

test("the widget links to the view", async () => {
  const m = mount("widget");
  const user = userEvent.setup();
  await user.click(await screen.findByRole("button", { name: "Ouvrir les questions →" }));
  expect(m.openedViews).toEqual(["questions"]);
});

const RUN_ID = "run-opus-2";

const seedWithRun = (run: (cmd: ProjectCommand) => unknown) => {
  const ids = seedDemo(run);
  run({
    method: "createQuestion",
    ticketId: ids["KIB-16"] ?? "",
    title: "Le client modifie-t-il les règles ?",
    options: ["Oui", "Non"],
    runId: RUN_ID,
    createdBy: { kind: "agent", ref: "opus-dev-2" },
  });
};

test("an agent question names its run with a mention that opens the run", async () => {
  const m = mount("view", { seed: seedWithRun });
  const ticketId = m.snapshot().tickets.find((t) => t.key === "KIB-16")?.id ?? "";
  act(() => m.setRuns([{ ticketId, runId: RUN_ID, label: "opus-dev-2", state: "done", position: null }]));
  const user = userEvent.setup();
  const card = await screen.findByRole("article", { name: "Le client modifie-t-il les règles ?" });
  await user.click(await within(card).findByRole("button", { name: /opus-dev-2/ }));
  expect(m.openedRuns).toEqual([RUN_ID]);
});

test("« Coller la réponse » records a text answer, shown at once as answered", async () => {
  const m = mount("view");
  const user = userEvent.setup();
  const card = await screen.findByRole("article", { name: OPEN });
  await user.click(within(card).getByRole("button", { name: "Coller la réponse" }));
  const save = within(card).getByRole("button", { name: "Enregistrer" });
  expect(save.hasAttribute("disabled")).toBe(true);
  await user.type(
    within(card).getByRole("textbox", { name: "Réponse reçue" }),
    "Oui, à la racine.{Enter}— Claire",
  );
  await user.click(save);
  await waitFor(() =>
    expect(questionNamed(m, OPEN)?.answer).toMatchObject({
      kind: "text",
      text: "Oui, à la racine.\n— Claire",
      by: { kind: "human", ref: "adam" },
    }),
  );
  await user.click(screen.getByRole("radio", { name: "Toutes" }));
  const group = await screen.findByRole("region", { name: /KIB-12/ });
  expect(await within(group).findByText("Réponse : Oui, à la racine. — Claire")).toBeTruthy();
  expect(screen.queryByRole("button", { name: /Transmettre/ })).toBeNull();
});
