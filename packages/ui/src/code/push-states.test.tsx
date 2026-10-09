import { expect, test } from "bun:test";
import type { CommitInfo, PrInfo } from "@kibo/schema";
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PushActions } from "./PushActions";

const commit = (shortSha: string): CommitInfo => ({
  sha: shortSha.padEnd(40, "0"),
  shortSha,
  subject: `feat: ${shortSha}`,
  body: "",
  author: "Adam",
  time: 0,
  pushed: false,
});

const pr: PrInfo = {
  number: 12,
  url: "https://github.com/kibo/test/pull/12",
  state: "open",
  base: null,
  head: null,
};

function renderActions(overrides: Partial<Parameters<typeof PushActions>[0]> = {}) {
  return render(
    <PushActions
      target="origin/kib-12"
      remote="origin"
      branch="kib-12"
      base="main"
      pending={[commit("a1f3c2e"), commit("9bd02e1")]}
      canPush
      upToDate={null}
      pushing={false}
      pushError={null}
      busy={false}
      pr={null}
      prTicketKey={null}
      prBlocked={null}
      canOpenPr
      onPush={() => {}}
      onOpenPr={() => {}}
      {...overrides}
    />,
  );
}

test("a push in progress names the branch, the pending commits and the elapsed time", async () => {
  const realNow = Date.now;
  let now = 1_000_000;
  Date.now = () => now;
  try {
    renderActions({ pushing: true });
    const card = screen.getByRole("status");
    expect(card.textContent).toContain("Publication de la branche kib-12 sur origin…");
    expect(card.textContent).not.toContain("git push");
    expect(card.textContent).toContain("2 commits (a1f3c2e, 9bd02e1). Jamais de force-push.");
    expect(card.textContent).toContain("0 s");
    now += 4_000;
    await act(async () => {
      await new Promise((r) => setTimeout(r, 1_100));
    });
    expect(card.textContent).toContain("4 s");
  } finally {
    Date.now = realNow;
  }
});

test("the git command of a push in progress is only shown under Détails", async () => {
  renderActions({ pushing: true });
  expect(screen.queryByText("git push -u origin kib-12")).toBeNull();
  await userEvent.click(screen.getByRole("button", { name: "Détails" }));
  expect(screen.getByText("git push -u origin kib-12")).toBeTruthy();
});

test("a failed push shows the git output in a code block apart from the explanation", () => {
  renderActions({
    pushError: { message: "La commande git a échoué", output: "! [rejected] kib-12 (fetch first)" },
  });
  const alert = screen.getByRole("alert");
  expect(alert.textContent).toContain("Le push a échoué");
  expect(alert.textContent).not.toContain("[rejected]");
  const output = screen.getByRole("region", { name: "Sortie de git" }).querySelector("pre");
  expect(output?.textContent).toBe("! [rejected] kib-12 (fetch first)");
  expect(screen.getByRole("button", { name: "Réessayer" })).toBeTruthy();
});

test("an existing PR is summarised in a card with its state, branches and linked ticket", () => {
  renderActions({ pr, prTicketKey: "KIB-12", pending: [], upToDate: "origin/kib-12" });
  const card = screen.getByRole("region", { name: "PR #12 ouverte" });
  expect(card.textContent).toContain("kib-12 → main · rattachée à KIB-12");
  expect(screen.getByRole("link", { name: "Voir la PR #12" })).toBeTruthy();
});
