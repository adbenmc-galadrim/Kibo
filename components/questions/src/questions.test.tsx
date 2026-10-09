import { expect, test } from "bun:test";
import type { ProjectCommand, Surface } from "@kibo/schema";
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
  const m = createMockSdk(manifest, { seed, surface, ...opts });
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

test("answers wait for « Transmettre à l'agent » and the button calls the SDK", async () => {
  const m = mount("view");
  const user = userEvent.setup();
  const group = await screen.findByRole("region", { name: /KIB-14/ });
  const deliver = within(group).getByRole("button", { name: "Transmettre à l'agent (1)" });
  await user.click(screen.getByRole("radio", { name: "Toutes" }));
  expect(within(group).getByText("à transmettre")).toBeTruthy();
  expect(within(group).getByText(/^Répondu par adam/)).toBeTruthy();
  await user.click(deliver);
  expect(await within(group).findByText("Transmis à mock")).toBeTruthy();
  expect(m.deliveries).toEqual([questionNamed(m, ANSWERED)?.ticketId ?? ""]);
  await waitFor(() => expect(within(group).queryByText("à transmettre")).toBeNull());
  expect(within(group).getByText("transmise à mock")).toBeTruthy();
  expect(within(group).queryByRole("button", { name: /Transmettre à l'agent/ })).toBeNull();
});

test("a refused delivery says there is no session to resume", async () => {
  mount("view", { deliveryRefused: true });
  const user = userEvent.setup();
  const group = await screen.findByRole("region", { name: /KIB-14/ });
  await user.click(within(group).getByRole("button", { name: "Transmettre à l'agent (1)" }));
  expect(
    await within(group).findByText(
      "Aucune session à reprendre : assigne le ticket, le brief portera les réponses.",
    ),
  ).toBeTruthy();
});

test("the widget offers the delivery of pending answers under its list", async () => {
  const m = mount("widget");
  const user = userEvent.setup();
  await user.click(await screen.findByRole("button", { name: "Transmettre à l'agent (1) · KIB-14" }));
  expect(await screen.findByText("Transmis à mock")).toBeTruthy();
  expect(m.deliveries).toHaveLength(1);
});

test("read-only projects hide the forms", async () => {
  const m = mount("view");
  act(() => m.setAccess("read-only"));
  expect(await screen.findByText("Lecture seule")).toBeTruthy();
  await screen.findByText(OPEN);
  expect(screen.queryByRole("button", { name: "Valider le choix provisoire" })).toBeNull();
  expect(screen.queryByRole("button", { name: "Nouvelle question" })).toBeNull();
  expect(screen.queryByRole("button", { name: /Transmettre à l'agent/ })).toBeNull();
  expect(screen.queryByRole("button", { name: "Supprimer" })).toBeNull();
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

test("only the human author removes an open question, any editor an answered one", async () => {
  const m = mount("view");
  const user = userEvent.setup();
  await user.click(await screen.findByRole("radio", { name: "Toutes" }));
  const open = screen.getByRole("article", { name: OPEN });
  expect(within(open).queryByRole("button", { name: "Supprimer" })).toBeNull();
  const answered = screen.getByRole("article", { name: ANSWERED });
  await user.click(within(answered).getByRole("button", { name: "Supprimer" }));
  await user.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: "Supprimer" }));
  await waitFor(() => expect(questionNamed(m, ANSWERED)).toBeUndefined());
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
