import { expect, test } from "bun:test";
import { type ProjectCommand, Question } from "@kibo/schema";
import { SdkProvider } from "@kibo/sdk";
import { seedDemo, seedQuestions } from "@kibo/sdk/fixtures";
import { createMockSdk } from "@kibo/sdk/mock";
import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { exportAll, exportQuestionText } from "./export-text";
import { Component, manifest } from "./index";

const OPEN = "Garder l'ordre des sous-tickets par index fractionnaire ?";
const AGENT = { kind: "agent", ref: "opus-dev-1" } as const;

const seed = (run: (cmd: ProjectCommand) => unknown) => {
  const ids = seedDemo(run);
  seedQuestions(run, [ids["KIB-12"] ?? "", ids["KIB-14"] ?? ""]);
  const ask = (ticket: string, title: string, recipient: string) => {
    const q = Question.parse(
      run({
        method: "createQuestion",
        ticketId: ids[ticket] ?? "",
        title,
        options: ["Oui", "Non"],
        createdBy: AGENT,
      }),
    );
    if (recipient !== "me") run({ method: "setQuestionRecipient", questionId: q.id, recipient });
  };
  ask("KIB-12", "Faut-il garder l'historique ?", "client");
  ask("KIB-16", "Le client modifie-t-il les règles ?", "client");
  ask("KIB-16", "Un composant lit-il les fichiers ?", "product");
  ask("KIB-14", "Quel port pour le récepteur ?", "me");
};

const mount = () => {
  const m = createMockSdk(manifest, { seed, surface: "view" });
  render(
    <SdkProvider sdk={m.sdk}>
      <Component />
    </SdkProvider>,
  );
  return m;
};

const clipboard = () => {
  const written: string[] = [];
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: { writeText: async (text: string) => void written.push(text) },
  });
  return written;
};

const named = (m: ReturnType<typeof mount>, title: string) =>
  m.snapshot().questions.find((q) => q.title === title);

const ticketOf = (m: ReturnType<typeof mount>, q: Question | undefined) => {
  const t = m.snapshot().tickets.find((x) => x.id === q?.ticketId);
  return { keyLabel: t?.keyLabel ?? "", title: t?.title ?? "" };
};

test("the filters count open questions per recipient, filter the page and add a recipient", async () => {
  const m = mount();
  const user = userEvent.setup();
  const filters = await screen.findByRole("radiogroup", { name: "Destinataire" });
  expect(await within(filters).findByRole("radio", { name: "Moi (technique) (2)" })).toBeTruthy();
  expect(
    within(filters)
      .getAllByRole("radio")
      .map((r) => r.getAttribute("aria-label")),
  ).toEqual(["Tous (5)", "Moi (technique) (2)", "Produit (1)", "Client (2)"]);
  await user.click(within(filters).getByRole("radio", { name: "Client (2)" }));
  expect(screen.getAllByRole("article").map((a) => a.getAttribute("aria-label"))).toEqual([
    "Faut-il garder l'historique ?",
    "Le client modifie-t-il les règles ?",
  ]);
  await user.click(screen.getByRole("button", { name: "Destinataire" }));
  await user.type(screen.getByRole("textbox", { name: "Nouveau destinataire" }), "Juridique{Enter}");
  expect(await within(filters).findByRole("radio", { name: "Juridique (0)" })).toBeTruthy();
  expect(m.snapshot().questionRecipients.map((r) => r.name)).toContain("Juridique");
});

test("a question changes recipient from its menu", async () => {
  const m = mount();
  const user = userEvent.setup();
  const card = await screen.findByRole("article", { name: OPEN });
  await user.click(within(card).getByRole("button", { name: "Destinataire : Moi (technique)" }));
  await user.click(await screen.findByRole("menuitemradio", { name: "Produit" }));
  await waitFor(() => expect(named(m, OPEN)?.recipient).toBe("product"));
  expect(named(m, OPEN)?.history).toMatchObject([
    { kind: "updated", by: { kind: "human", ref: "adam" }, previous: { recipient: "me" } },
  ]);
  expect(await within(card).findByRole("button", { name: "Destinataire : Produit" })).toBeTruthy();
});

test("« Nouvelle question » picks a recipient, « Moi (technique) » by default", async () => {
  const m = mount();
  const user = userEvent.setup();
  await user.click(await screen.findByRole("button", { name: "Nouvelle question" }));
  const dialog = await screen.findByRole("dialog");
  const recipient = within(dialog).getByRole("combobox", { name: "Destinataire" });
  expect(recipient.textContent).toContain("Moi (technique)");
  const ticket = within(dialog).getByRole("combobox", { name: "Ticket" });
  ticket.focus();
  await user.keyboard("{Enter}");
  await user.click(await screen.findByRole("option", { name: /KIB-9/ }));
  recipient.focus();
  await user.keyboard("{Enter}");
  await user.click(await screen.findByRole("option", { name: "Client" }));
  await user.type(within(dialog).getByRole("textbox", { name: "Question" }), "Quel logo ?");
  await user.click(within(dialog).getByRole("button", { name: "Créer la question" }));
  await waitFor(() => expect(named(m, "Quel logo ?")?.recipient).toBe("client"));
  const card = await screen.findByRole("article", { name: "Quel logo ?" });
  expect(within(card).getByRole("button", { name: "Destinataire : Client" })).toBeTruthy();
});

test("« Exporter » copies the ready text, then marks the question sent", async () => {
  const m = mount();
  const user = userEvent.setup();
  const written = clipboard();
  const card = await screen.findByRole("article", { name: OPEN });
  await user.click(within(card).getByRole("button", { name: "Exporter" }));
  const q = named(m, OPEN);
  expect(written).toEqual([exportQuestionText(q as Question, ticketOf(m, q), "Moi (technique)")]);
  await waitFor(() => expect(named(m, OPEN)?.sentAt).not.toBeNull());
  expect(await within(card).findByText("envoyée à l'instant")).toBeTruthy();
});

test("« Exporter tout (n) » copies the open questions of the recipient and marks them sent", async () => {
  const m = mount();
  const user = userEvent.setup();
  const written = clipboard();
  await user.click(await screen.findByRole("radio", { name: "Client (2)" }));
  await user.click(screen.getByRole("button", { name: "Exporter tout (2)" }));
  const titles = ["Faut-il garder l'historique ?", "Le client modifie-t-il les règles ?"];
  const entries = titles.map((title) => {
    const q = named(m, title) as Question;
    return { question: q, ticket: ticketOf(m, q), recipient: "Client" };
  });
  expect(written).toEqual([exportAll(entries)]);
  await waitFor(() => expect(titles.map((t) => named(m, t)?.sentAt === null)).toEqual([false, false]));
});

test("a failed copy shows the text, selected, and still marks the question sent", async () => {
  const m = mount();
  const user = userEvent.setup();
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: { writeText: () => Promise.reject(new Error("denied")) },
  });
  const card = await screen.findByRole("article", { name: OPEN });
  await user.click(within(card).getByRole("button", { name: "Exporter" }));
  const shown = (await within(card).findByRole("textbox", { name: "Texte à copier" })) as HTMLTextAreaElement;
  expect(shown.value).toContain(`Question : ${OPEN}`);
  await waitFor(() => expect(named(m, OPEN)?.sentAt).not.toBeNull());
});

test("read-only projects show the recipient without its menu, and no export", async () => {
  const m = mount();
  act(() => m.setAccess("read-only"));
  const card = await screen.findByRole("article", { name: OPEN });
  expect(within(card).getByText("Pour : Moi (technique)")).toBeTruthy();
  expect(within(card).queryByRole("button", { name: /Destinataire :/ })).toBeNull();
  expect(screen.queryByRole("button", { name: "Exporter" })).toBeNull();
  expect(screen.queryByRole("button", { name: "Destinataire" })).toBeNull();
});

test("a 21st recipient is refused with the quota", async () => {
  const full = (run: (cmd: ProjectCommand) => unknown) => {
    seed(run);
    for (let i = 1; i <= 17; i++) run({ method: "addQuestionRecipient", name: `Équipe ${i}` });
  };
  const m = createMockSdk(manifest, { seed: full, surface: "view" });
  render(
    <SdkProvider sdk={m.sdk}>
      <Component />
    </SdkProvider>,
  );
  const user = userEvent.setup();
  await user.click(await screen.findByRole("button", { name: "Destinataire" }));
  await user.type(screen.getByRole("textbox", { name: "Nouveau destinataire" }), "Juridique{Enter}");
  expect((await screen.findByRole("alert")).textContent).toBe("20 destinataires au plus.");
});
