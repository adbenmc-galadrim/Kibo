import { afterEach, expect, test } from "bun:test";
import type { ProjectCommand } from "@kibo/schema";
import { SdkProvider } from "@kibo/sdk";
import { createMockSdk } from "@kibo/sdk/mock";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Component, manifest } from "./index";

afterEach(cleanup);

const EMPTY = "Pose ici les questions au client ou à l'équipe : une question bloquante retient son étape.";

const mount = (seed?: (run: (cmd: ProjectCommand) => unknown) => void) => {
  const m = createMockSdk(manifest, { seed, surface: "view" });
  render(
    <SdkProvider sdk={m.sdk}>
      <Component />
    </SdkProvider>,
  );
  return m;
};

test("a project without questions says what the page is for and offers « Nouvelle question »", async () => {
  mount((run) => void run({ method: "createTicket", title: "Écran d'import" }));
  expect(await screen.findByText(EMPTY)).toBeTruthy();
  const buttons = screen.getAllByRole("button", { name: "Nouvelle question" });
  const inEmpty = buttons.find((b) => b.closest("[data-slot='questions-empty']") !== null);
  if (!inEmpty) throw new Error("no button in the empty state");
  await userEvent.setup().click(inEmpty);
  expect(await screen.findByRole("dialog", { name: "Nouvelle question" })).toBeTruthy();
});

test("answered questions only: the filter says none is open, without the page explanation", async () => {
  mount((run) => {
    const t = run({ method: "createTicket", title: "Écran d'import" });
    const ticketId = typeof t === "object" && t !== null ? String(Reflect.get(t, "id")) : "";
    const q = run({
      method: "createQuestion",
      ticketId,
      title: "CSV ou XLSX ?",
      createdBy: { kind: "human", ref: "adam" },
    });
    const questionId = typeof q === "object" && q !== null ? String(Reflect.get(q, "id")) : "";
    run({
      method: "answerQuestion",
      questionId,
      answer: { kind: "text", text: "CSV" },
      by: { kind: "human", ref: "adam" },
    });
  });
  expect(await screen.findByText("Aucune question ouverte.")).toBeTruthy();
  expect(screen.queryByText(EMPTY)).toBeNull();
});
