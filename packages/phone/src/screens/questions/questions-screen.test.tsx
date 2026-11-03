import { afterEach, beforeEach, expect, test } from "bun:test";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { z } from "zod";
import { App } from "../../App";
import { phoneFixture } from "../../app-test-kit";
import { Q14, Q16, sealQuestions } from "./questions-kit";

beforeEach(() => {
  localStorage.clear();
  window.location.hash = "#/p/silo/questions";
});
afterEach(cleanup);

async function mountQuestions() {
  const fixture = await phoneFixture();
  await sealQuestions(fixture);
  fixture.api.reply = () => ({ ok: true, result: null });
  render(<App runtime={fixture.runtime} />);
  const row = await screen.findByRole("article", { name: Q14 });
  return { ...fixture, row, user: userEvent.setup() };
}

const Relayed = z.object({
  method: z.literal("command"),
  command: z.object({ method: z.string() }).passthrough(),
});

const commands = (requests: unknown[]) =>
  requests.flatMap((r) => {
    const parsed = Relayed.safeParse(r);
    return parsed.success ? [parsed.data.command] : [];
  });

test("QuestionsScreen lists open questions, expands one, answers through command answerQuestion", async () => {
  const { row, user, api } = await mountQuestions();
  expect(screen.getByRole("article", { name: Q16 })).toBeTruthy();
  expect(screen.getByRole("toolbar", { name: "Filtres des questions" })).toBeTruthy();
  await user.click(within(row).getByRole("button", { name: Q14 }));
  const form = within(row).getByRole("form", { name: `Répondre à ${Q14}` });
  await user.type(within(form).getByRole("textbox"), "Oui, elles suivent le box");
  await user.click(within(form).getByRole("button", { name: "Répondre" }));
  await waitFor(() =>
    expect(commands(api.requests)).toEqual([
      {
        method: "answerQuestion",
        questionId: "q14",
        answer: { kind: "text", text: "Oui, elles suivent le box" },
        by: { kind: "human", ref: "adam" },
      },
    ]),
  );
});

test("images render from imageUrl (blob:) and open the lightbox", async () => {
  const { row, user } = await mountQuestions();
  await user.click(within(row).getByRole("button", { name: Q14 }));
  const images = await within(row).findByRole("list", { name: "Captures · 2" });
  const first = within(images).getByRole("img", { name: "box-avant.png" });
  await waitFor(() => expect(first.getAttribute("src")).toStartWith("blob:"));
  await user.click(within(images).getByRole("button", { name: "Agrandir box-avant.png" }));
  const lightbox = await screen.findByRole("dialog", { name: "box-avant.png" });
  expect(within(lightbox).getByText("1 / 2")).toBeTruthy();
  expect(within(lightbox).getByRole("img", { name: "box-avant.png" }).getAttribute("src")).toStartWith(
    "blob:",
  );
});

test("create, edit and delete a question relay their commands", async () => {
  const { row, user, api } = await mountQuestions();
  await user.click(screen.getByRole("button", { name: "Nouvelle question" }));
  const dialog = await screen.findByRole("dialog");
  within(dialog).getByRole("combobox", { name: "Ticket" }).focus();
  await user.keyboard("{Enter}");
  await user.click(await screen.findByRole("option", { name: /SILO-51/ }));
  await user.type(
    within(dialog).getByRole("textbox", { name: "Question" }),
    "Les photos sont-elles datées ?",
  );
  await user.click(within(dialog).getByRole("button", { name: "Créer la question" }));
  await waitFor(() => expect(commands(api.requests).map((c) => c.method)).toEqual(["createQuestion"]));

  await user.click(within(row).getByRole("button", { name: Q14 }));
  await user.click(within(row).getByRole("button", { name: "Actions de Q14" }));
  await user.click(await screen.findByRole("menuitem", { name: "Modifier" }));
  const edit = await screen.findByRole("dialog", { name: "Modifier la question" });
  const title = within(edit).getByRole("textbox", { name: "Question" });
  await user.clear(title);
  await user.type(title, "Un box réaffecté garde-t-il toutes ses photos ?");
  await user.click(within(edit).getByRole("button", { name: "Enregistrer" }));
  await waitFor(() => expect(commands(api.requests).map((c) => c.method)).toContain("updateQuestion"));

  await user.click(within(row).getByRole("button", { name: "Actions de Q14" }));
  await user.click(await screen.findByRole("menuitem", { name: "Supprimer" }));
  const confirm = await screen.findByRole("alertdialog");
  await user.click(within(confirm).getByRole("button", { name: "Supprimer" }));
  await waitFor(() =>
    expect(commands(api.requests).at(-1)).toEqual({ method: "removeQuestion", questionId: "q14" }),
  );
});

test("the export copies the text without a clipboard API and marks the questions sent", async () => {
  const { user, api } = await mountQuestions();
  const clipboard = Object.getOwnPropertyDescriptor(navigator, "clipboard");
  Object.defineProperty(navigator, "clipboard", { value: undefined, configurable: true });
  try {
    await user.click(screen.getByRole("button", { name: /^Exporter pour le client/ }));
    expect((await screen.findByText(/^Questions pour Silo SA/)).textContent).toContain(Q14);
    await waitFor(() =>
      expect(commands(api.requests).map((c) => c.method)).toEqual(["markQuestionsExported"]),
    );
  } finally {
    if (clipboard) Object.defineProperty(navigator, "clipboard", clipboard);
  }
});
