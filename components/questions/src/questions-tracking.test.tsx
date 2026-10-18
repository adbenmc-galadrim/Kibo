import { expect, test } from "bun:test";
import { type ProjectCommand, type Question, Sprint, Ticket } from "@kibo/schema";
import { SdkProvider } from "@kibo/sdk";
import { createMockSdk, type MockSdkOptions } from "@kibo/sdk/mock";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Component, manifest } from "./index";

const ADAM = { kind: "human", ref: "adam" } as const;
const Q14 = "Un ISO réaffecté garde-t-il ses photos ?";
const Q17 = "Un rapport par chef de chantier ou par affaire ?";
const Q16 = "Quota par affaire : 2 Go ou 5 Go ?";

const seed = (run: (cmd: ProjectCommand) => unknown) => {
  const s43 = Sprint.parse(
    run({ method: "createSprint", code: "S43", name: "Sprint 43", start: "2026-10-19", end: "2026-10-23" }),
  );
  const f6 = Ticket.parse(run({ method: "createTicket", title: "Tronçons", feature: true }));
  run({ method: "setTicketSprint", ticketId: f6.id, sprintId: s43.id });
  const step = Ticket.parse(
    run({ method: "createTicket", title: "Lecture du fichier Excel", parentId: f6.id }),
  );
  const other = Ticket.parse(run({ method: "createTicket", title: "Modèle du rapport" }));
  run({ method: "createQuestion", ticketId: other.id, title: Q17, recipient: "client", createdBy: ADAM });
  run({ method: "createQuestion", ticketId: other.id, title: Q16, recipient: "product", createdBy: ADAM });
  run({
    method: "createQuestion",
    ticketId: step.id,
    title: Q14,
    blocking: true,
    recipient: "client",
    createdBy: ADAM,
  });
};

const mount = (opts: MockSdkOptions = {}) => {
  const m = createMockSdk(manifest, { seed, surface: "view", client: "Emis SA", ...opts });
  render(
    <SdkProvider sdk={m.sdk}>
      <Component />
    </SdkProvider>,
  );
  return m;
};

const named = (m: ReturnType<typeof mount>, title: string): Question | undefined =>
  m.snapshot().questions.find((q) => q.title === title);

test("cards carry Qn, the blocking badge and come blocking first", async () => {
  mount();
  const blocking = await screen.findByRole("article", { name: Q14 });
  expect(within(blocking).getByText("Q3")).toBeTruthy();
  expect(within(screen.getByRole("article", { name: Q17 })).getByText("Q1")).toBeTruthy();
  expect(within(blocking).getByText("bloquante")).toBeTruthy();
  expect(within(screen.getByRole("article", { name: Q17 })).queryByText("bloquante")).toBeNull();
  const titles = screen.getAllByRole("article").map((a) => a.getAttribute("aria-label"));
  expect(titles[0]).toBe(Q14);
  expect(screen.getByText("1 bloquante en tête · 3 ouvertes")).toBeTruthy();
});

test("the client recipient shows the client of the project", async () => {
  mount();
  const card = await screen.findByRole("article", { name: Q14 });
  expect(within(card).getByText("Pour : Emis SA")).toBeTruthy();
});

test("« Exporter » copies the text, marks the questions sent and can be undone", async () => {
  const m = mount();
  const user = userEvent.setup();
  await user.click(await screen.findByRole("button", { name: "Exporter pour le client (2)" }));
  const copied = await navigator.clipboard.readText();
  expect(copied).toContain("Questions pour Emis SA · ");
  expect(copied).toEndWith(
    [
      "Q3 · Un ISO réaffecté garde-t-il ses photos ?",
      "   bloque F1, prévue en S43",
      "",
      "Q1 · Un rapport par chef de chantier ou par affaire ?",
      "   pour KIB-2, à planifier",
    ].join("\n"),
  );
  await waitFor(() => expect(named(m, Q14)?.history.map((e) => e.kind)).toEqual(["exported"]));
  expect(named(m, Q17)?.history.map((e) => e.kind)).toEqual(["exported"]);
  expect(named(m, Q16)?.history).toEqual([]);
  const toast = await screen.findByRole("status", { name: "2 questions marquées envoyées" });
  await user.click(within(toast).getByRole("button", { name: "Annuler" }));
  await waitFor(() => expect(named(m, Q14)?.history).toEqual([]));
  expect(named(m, Q17)?.history).toEqual([]);
});

test("a card exported earlier reads « envoyée le 18 oct. »", async () => {
  const m = mount();
  await screen.findByRole("article", { name: Q14 });
  m.run({
    method: "markQuestionsExported",
    questionIds: [named(m, Q14)?.id ?? ""],
    by: ADAM,
    at: Date.parse("2026-10-18T10:00:00+02:00"),
  });
  expect(
    await within(screen.getByRole("article", { name: Q14 })).findByText("envoyée le 18 oct."),
  ).toBeTruthy();
});

test("answering the blocking question toasts « F1 débloquée »", async () => {
  const m = mount();
  const user = userEvent.setup();
  const card = await screen.findByRole("article", { name: Q14 });
  await user.type(within(card).getByRole("textbox", { name: "Autre réponse…" }), "Oui");
  await user.click(within(card).getByRole("button", { name: "Répondre" }));
  await waitFor(() => expect(m.toasts).toEqual(["F1 débloquée"]));
});
