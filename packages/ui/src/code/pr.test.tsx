import { expect, test } from "bun:test";
import { KiboError } from "@kibo/schema";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PushPrDialog, type PushPrInput } from "./PushPrDialog";
import { parseReviewers, prCommandPreview } from "./pr-command";

test("the command preview mirrors the options", () => {
  expect(prCommandPreview({ remote: "origin", branch: "kib-12", draft: true })).toBe(
    "git push -u origin kib-12 && gh pr create --draft",
  );
  expect(prCommandPreview({ remote: "origin", branch: "kib-12", draft: false })).toBe(
    "git push -u origin kib-12 && gh pr create",
  );
});

test("reviewers accept @logins separated by commas or spaces and flag invalid ones", () => {
  expect(parseReviewers("@adam, @kibo/core  lea")).toEqual({
    logins: ["adam", "kibo/core", "lea"],
    invalid: null,
  });
  expect(parseReviewers("@adam --admin")).toEqual({ logins: ["adam", "--admin"], invalid: "--admin" });
  expect(parseReviewers("  ")).toEqual({ logins: [], invalid: null });
});

function renderDialog(overrides: Partial<Parameters<typeof PushPrDialog>[0]> = {}) {
  const submitted: PushPrInput[] = [];
  const events: string[] = [];
  render(
    <PushPrDialog
      open
      onOpenChange={(o) => events.push(o ? "open" : "close")}
      branch="kib-12"
      remote="origin"
      bases={["main", "develop"]}
      base="main"
      onBaseChange={(b) => events.push(`base:${b}`)}
      unpushedCount={2}
      fileCount={3}
      stagedCount={2}
      ticketKey="KIB-12"
      defaultTitle="feat: schéma Loro des tickets (KIB-12)"
      defaultBody={"## Ticket\nKIB-12 · Schéma Loro des tickets"}
      onCommitFirst={() => events.push("commitFirst")}
      onSubmit={async (input) => {
        submitted.push(input);
      }}
      {...overrides}
    />,
  );
  return { submitted, events };
}

test("the dialog shows the summary, the staged warning and submits the defaults", async () => {
  const { submitted, events } = renderDialog({
    extraOptions: <span>Lancer sonnet-review sur la PR</span>,
    ruleNote: "À l'ouverture de la PR, KIB-12 passe en « En review » (règle du workflow).",
  });
  expect(screen.getByText("kib-12 → main · 2 commits non poussés · 3 fichiers")).toBeTruthy();
  expect(
    screen.getByText(
      "2 fichiers ajoutés au commit ne sont pas encore commités : ils ne seront pas dans la PR.",
    ),
  ).toBeTruthy();
  expect(screen.getByText("Lancer sonnet-review sur la PR")).toBeTruthy();
  expect(screen.getByText(/passe en « En review »/)).toBeTruthy();
  expect(screen.getByText("git push -u origin kib-12 && gh pr create --draft")).toBeTruthy();
  await userEvent.click(screen.getByRole("button", { name: "Commiter d'abord" }));
  expect(events).toEqual(["commitFirst"]);
  await userEvent.type(screen.getByLabelText("Reviewers"), "@adam");
  await userEvent.click(screen.getByRole("checkbox", { name: "Brouillon (draft)" }));
  expect(screen.getByText("git push -u origin kib-12 && gh pr create")).toBeTruthy();
  await userEvent.click(screen.getByRole("button", { name: "Créer la PR" }));
  expect(submitted).toEqual([
    {
      title: "feat: schéma Loro des tickets (KIB-12)",
      body: "## Ticket\nKIB-12 · Schéma Loro des tickets",
      base: "main",
      draft: false,
      reviewers: ["adam"],
      link: true,
    },
  ]);
  expect(events).toEqual(["commitFirst", "close"]);
});

test("unchecking the ticket link is sent", async () => {
  const { submitted } = renderDialog();
  await userEvent.click(screen.getByRole("checkbox", { name: "Lier la PR à KIB-12" }));
  await userEvent.click(screen.getByRole("button", { name: "Créer la PR" }));
  expect(submitted[0]?.link).toBe(false);
  expect(submitted[0]?.draft).toBe(true);
});

test("an empty title blocks the submit", async () => {
  renderDialog();
  await userEvent.clear(screen.getByLabelText("Titre"));
  expect(screen.getByRole("button", { name: "Créer la PR" }).hasAttribute("disabled")).toBe(true);
});

test("an invalid reviewer blocks the submit, a GitHub failure is shown and keeps the dialog open", async () => {
  const { events } = renderDialog({
    onSubmit: () => Promise.reject(new KiboError("GH_FAILED", "a pull request already exists")),
  });
  await userEvent.type(screen.getByLabelText("Reviewers"), "--admin");
  expect(screen.getByText("Login GitHub invalide : --admin")).toBeTruthy();
  expect(screen.getByRole("button", { name: "Créer la PR" }).hasAttribute("disabled")).toBe(true);
  await userEvent.clear(screen.getByLabelText("Reviewers"));
  await userEvent.click(screen.getByRole("button", { name: "Créer la PR" }));
  expect((await screen.findByRole("alert")).textContent).toBe(
    "GitHub a refusé la demande. (a pull request already exists)",
  );
  expect(events).toEqual([]);
  expect(screen.getByRole("button", { name: "Créer la PR" }).hasAttribute("disabled")).toBe(false);
});

test("the submit button shows progress while the push runs", async () => {
  let finish: () => void = () => {};
  renderDialog({
    onSubmit: () =>
      new Promise<void>((resolve) => {
        finish = resolve;
      }),
  });
  await userEvent.click(screen.getByRole("button", { name: "Créer la PR" }));
  expect(screen.getByRole("button", { name: "Création…" }).hasAttribute("disabled")).toBe(true);
  for (const label of ["Titre", "Description", "Branche de base", "Reviewers"]) {
    expect(screen.getByLabelText(label).hasAttribute("disabled")).toBe(true);
  }
  expect(screen.getByRole("checkbox", { name: "Brouillon (draft)" }).hasAttribute("disabled")).toBe(true);
  expect(screen.getByRole("checkbox", { name: "Lier la PR à KIB-12" }).hasAttribute("disabled")).toBe(true);
  finish();
  expect(await screen.findByRole("button", { name: "Créer la PR" })).toBeTruthy();
});

test("without a ticket the link option is hidden", () => {
  renderDialog({ ticketKey: null, stagedCount: 0 });
  expect(screen.queryByRole("checkbox", { name: /Lier la PR/ })).toBeNull();
  expect(screen.queryByRole("button", { name: "Commiter d'abord" })).toBeNull();
});

test("the file count is left out of the summary until the comparison is known", () => {
  renderDialog({ fileCount: null });
  expect(screen.getByText("kib-12 → main · 2 commits non poussés")).toBeTruthy();
});
