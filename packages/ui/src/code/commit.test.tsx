import { expect, test } from "bun:test";
import { type CommitInfo, KiboError } from "@kibo/schema";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { CommitPanel } from "./CommitPanel";
import { UnpushedCommits } from "./UnpushedCommits";

const commit = (sha: string, subject: string, pushed = false): CommitInfo => ({
  sha: sha.padEnd(40, "0"),
  shortSha: sha,
  subject,
  body: "",
  author: "Adam",
  time: 0,
  pushed,
});
const commits = [
  commit("a1f3c2e", "feat(core): opérations move / reparent"),
  commit("9bd02e1", "test(core): convergence fast-check"),
  commit("47ce0aa", "chore: monorepo Bun workspaces", true),
];

function Panel({
  onCommit,
  stagedCount = 2,
  canAmend = true,
}: {
  onCommit(): void;
  stagedCount?: number;
  canAmend?: boolean;
}) {
  const [message, setMessage] = useState("feat: schéma Loro des tickets (KIB-12)");
  const [amend, setAmend] = useState(false);
  return (
    <CommitPanel
      branch="kib-12"
      stagedCount={stagedCount}
      message={message}
      onMessageChange={setMessage}
      prefilled
      amend={amend}
      onAmendChange={setAmend}
      canAmend={canAmend}
      busy={false}
      onCommit={onCommit}
    />
  );
}

test("the commit button names the branch and ⌘↵ commits", async () => {
  let commits = 0;
  render(<Panel onCommit={() => commits++} />);
  expect(screen.getByText("2 fichiers dans le commit")).toBeTruthy();
  expect(screen.getByText("Pré-rempli depuis le ticket · 0 token")).toBeTruthy();
  expect(screen.queryByRole("button", { name: /Générer avec Claude/ })).toBeNull();
  await userEvent.click(screen.getByRole("button", { name: /Commit sur kib-12/ }));
  await userEvent.click(screen.getByLabelText("Message"));
  await userEvent.keyboard("{Meta>}{Enter}{/Meta}");
  expect(commits).toBe(2);
});

function withPlatform(platform: string, run: () => void) {
  const original = navigator.platform;
  Object.defineProperty(navigator, "platform", { value: platform, configurable: true });
  try {
    run();
  } finally {
    Object.defineProperty(navigator, "platform", { value: original, configurable: true });
  }
}

test("the commit shortcut is ⌘↵ on macOS and Ctrl+↵ elsewhere", () => {
  withPlatform("MacIntel", () => {
    const { unmount } = render(<Panel onCommit={() => {}} />);
    expect(screen.getByRole("button", { name: /Commit sur kib-12/ }).querySelector("kbd")?.textContent).toBe(
      "⌘↵",
    );
    unmount();
  });
  withPlatform("Linux x86_64", () => {
    const { unmount } = render(<Panel onCommit={() => {}} />);
    expect(screen.getByRole("button", { name: /Commit sur kib-12/ }).querySelector("kbd")?.textContent).toBe(
      "Ctrl+↵",
    );
    unmount();
  });
});

test("nothing staged blocks a commit, amend unlocks it, a pushed head blocks amend", async () => {
  const { unmount } = render(<Panel onCommit={() => {}} stagedCount={0} />);
  expect(screen.getByRole("button", { name: /Commit sur kib-12/ }).hasAttribute("disabled")).toBe(true);
  await userEvent.click(screen.getByRole("checkbox", { name: "Modifier le dernier commit (non poussé)" }));
  expect(screen.getByRole("button", { name: /Modifier le commit sur kib-12/ }).hasAttribute("disabled")).toBe(
    false,
  );
  unmount();
  render(<Panel onCommit={() => {}} canAmend={false} />);
  expect(
    screen
      .getByRole("checkbox", { name: "Modifier le dernier commit (non poussé)" })
      .hasAttribute("disabled"),
  ).toBe(true);
});

test("only the latest unpushed commit can be modified, pushed ones have no action", async () => {
  const modified: string[] = [];
  render(
    <UnpushedCommits
      commits={commits}
      busy={false}
      onModify={(c) => modified.push(c.shortSha)}
      onReword={async () => {}}
      onUndo={async () => {}}
    />,
  );
  expect(screen.getByText("↑2")).toBeTruthy();
  const [latest, older, pushed] = screen.getAllByRole("listitem");
  if (!latest || !older || !pushed) throw new Error("three commits expected");
  await userEvent.click(within(latest).getByRole("button", { name: "Modifier" }));
  expect(modified).toEqual(["a1f3c2e"]);
  expect(within(older).queryByRole("button", { name: "Modifier" })).toBeNull();
  expect(within(older).getByRole("button", { name: "Reformuler" })).toBeTruthy();
  expect(within(pushed).queryAllByRole("button")).toHaveLength(0);
  expect(within(pushed).getByText("Poussé · ne peut plus être modifié")).toBeTruthy();
});

test("reword submits the edited message, undo explains how many commits go back to the index", async () => {
  const reworded: string[] = [];
  const undone: string[] = [];
  render(
    <UnpushedCommits
      commits={commits}
      busy={false}
      onModify={() => {}}
      onReword={async (c, m) => {
        reworded.push(`${c.shortSha}:${m}`);
      }}
      onUndo={async (c) => {
        undone.push(c.shortSha);
      }}
    />,
  );
  const older = screen.getAllByRole("listitem")[1];
  if (!older) throw new Error("older commit expected");
  await userEvent.click(within(older).getByRole("button", { name: "Reformuler" }));
  const box = screen.getByRole("textbox", { name: "Message" });
  await userEvent.clear(box);
  await userEvent.type(box, "test(core): convergence");
  await userEvent.click(screen.getByRole("button", { name: "Reformuler", hidden: false }));
  expect(reworded).toEqual(["9bd02e1:test(core): convergence"]);
  await userEvent.click(within(older).getByRole("button", { name: "Annuler" }));
  expect(
    screen.getByText(/Le commit 9bd02e1 et 1 commit plus récent sont retirés de la branche/),
  ).toBeTruthy();
  await userEvent.click(screen.getByRole("button", { name: "Annuler les commits" }));
  expect(undone).toEqual(["9bd02e1"]);
});

test("a refused reword is shown in an alert and keeps the dialog open", async () => {
  render(
    <UnpushedCommits
      commits={commits}
      busy={false}
      onModify={() => {}}
      onReword={() => Promise.reject(new KiboError("GIT_PUSHED", "pushed"))}
      onUndo={async () => {}}
    />,
  );
  const latest = screen.getAllByRole("listitem")[0];
  if (!latest) throw new Error("latest commit expected");
  await userEvent.click(within(latest).getByRole("button", { name: "Reformuler" }));
  await userEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Reformuler" }));
  expect((await screen.findByRole("alert")).textContent).toBe(
    "Ce commit est déjà poussé : il ne peut plus être modifié.",
  );
  expect(screen.getByRole("dialog")).toBeTruthy();
});

test("a refused undo is shown in an alert and keeps the confirmation open", async () => {
  render(
    <UnpushedCommits
      commits={commits}
      busy={false}
      onModify={() => {}}
      onReword={async () => {}}
      onUndo={() => Promise.reject(new KiboError("GIT_PUSHED", "pushed"))}
    />,
  );
  const latest = screen.getAllByRole("listitem")[0];
  if (!latest) throw new Error("latest commit expected");
  await userEvent.click(within(latest).getByRole("button", { name: "Annuler" }));
  expect(screen.getByText(/Le commit a1f3c2e est retiré de la branche/)).toBeTruthy();
  await userEvent.click(screen.getByRole("button", { name: "Annuler les commits" }));
  expect((await screen.findByRole("alert")).textContent).toBe(
    "Ce commit est déjà poussé : il ne peut plus être modifié.",
  );
  expect(screen.getByRole("alertdialog")).toBeTruthy();
});

test("while the status loads the commit button stays neutral instead of naming a detached HEAD", () => {
  render(
    <CommitPanel
      branch={null}
      loading
      stagedCount={0}
      message=""
      onMessageChange={() => {}}
      prefilled={false}
      amend={false}
      onAmendChange={() => {}}
      canAmend={false}
      busy={false}
      onCommit={() => {}}
    />,
  );
  const button = screen.getByRole("button", { name: /^Commit/ });
  expect(button.textContent).not.toContain("HEAD détachée");
  expect(button.hasAttribute("disabled")).toBe(true);
  expect(screen.queryByText("Indexe au moins un fichier pour commiter.")).toBeNull();
});

test("the unpushed counter is only highlighted when something is waiting to be pushed", () => {
  const { unmount } = render(
    <UnpushedCommits
      commits={commits}
      busy={false}
      onModify={() => {}}
      onReword={async () => {}}
      onUndo={async () => {}}
    />,
  );
  expect(screen.getByText("↑2").className).toContain("text-orange");
  unmount();
  render(
    <UnpushedCommits
      commits={commits.filter((c) => c.pushed)}
      busy={false}
      onModify={() => {}}
      onReword={async () => {}}
      onUndo={async () => {}}
    />,
  );
  expect(screen.getByText("↑0").className).not.toContain("text-orange");
});
