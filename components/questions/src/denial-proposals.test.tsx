import { expect, test } from "bun:test";
import type { DenialItem, ProjectCommand, Question, RunDenials, RunState } from "@kibo/schema";
import { SdkProvider } from "@kibo/sdk";
import { seedDemo } from "@kibo/sdk/fixtures";
import { createMockSdk } from "@kibo/sdk/mock";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Component, manifest } from "./index";

const TITLE = "3 actions refusées pendant le run";
const SKILLS = "/Users/adam/.claude/skills";
const ITEMS: DenialItem[] = [
  { tool: "Bash", target: "pnpm test", rule: "Bash(pnpm *)", addDir: null, reason: "ok" },
  {
    tool: "Read",
    target: `${SKILLS}/full-delivery/reference/kibo.md`,
    rule: null,
    addDir: SKILLS,
    reason: "ok",
  },
  {
    tool: "Bash",
    target: "sh -c 'pnpm --filter web build'",
    rule: null,
    addDir: null,
    reason: "shell",
  },
  { tool: "mcp__kibo__peek_work", target: "", rule: null, addDir: null, reason: "mcp" },
];

type Setup = { state?: RunState; reader?: boolean; denials?: boolean };

const mount = ({ state = "waiting_input", reader = false, denials = true }: Setup = {}) => {
  const recorded: Record<string, RunDenials> = {};
  let ticketId = "";
  const seed = (run: (cmd: ProjectCommand) => unknown) => {
    ticketId = seedDemo(run)["KIB-12"] ?? "";
    const q = run({
      method: "createQuestion",
      ticketId,
      title: TITLE,
      context: "Claude Code a refusé ces actions.",
      runId: "r1",
      createdBy: { kind: "agent", ref: "kibo" },
    }) as Question;
    if (denials) recorded.r1 = { runId: "r1", turn: 3, items: ITEMS, questionId: q.id, at: 1 };
  };
  const m = createMockSdk(manifest, {
    seed,
    surface: "view",
    denials: recorded,
    agentExecution: "shown",
  });
  m.setRuns([{ ticketId, runId: "r1", label: "emis · full-delivery · EMIS-15", state, position: null }]);
  if (reader) m.setAccess("read-only");
  render(
    <SdkProvider sdk={m.sdk}>
      <Component />
    </SdkProvider>,
  );
  return m;
};

const proposals = async () => {
  const card = await screen.findByRole("article", { name: TITLE });
  return within(await within(card).findByRole("region", { name: "Propositions de Kibo" }));
};

test("each rule and folder is a checked box, shell and MCP items stay read-only with their reason", async () => {
  mount();
  const block = await proposals();
  const boxes = block.getAllByRole("checkbox");
  expect(boxes.map((b) => b.getAttribute("aria-label"))).toEqual([
    "Règle Bash(pnpm *)",
    "Dossier ~/.claude/skills",
  ]);
  expect(boxes.every((b) => b.getAttribute("aria-checked") === "true")).toBe(true);
  expect(block.getByText("2 sur 4 autorisables")).toBeTruthy();
  expect(block.getByText("commande shell : à autoriser à la main")).toBeTruthy();
  expect(block.getByText("outil MCP : à autoriser dans le fichier de l'agent")).toBeTruthy();
  expect(block.getByText("sh -c 'pnpm --filter web build'")).toBeTruthy();
  expect(block.getByText("~/.claude/skills/full-delivery/reference/kibo.md")).toBeTruthy();
});

test("« Autoriser et relancer » confirms the checked items, then calls the SDK", async () => {
  const m = mount();
  const user = userEvent.setup();
  const block = await proposals();
  await user.click(block.getByRole("button", { name: "Autoriser et relancer" }));
  const dialog = within(await screen.findByRole("alertdialog", { name: "Autoriser et relancer ?" }));
  expect(dialog.getByRole("list", { name: "Règle ajoutée à l'agent (1)" }).textContent).toBe("Bash(pnpm *)");
  expect(dialog.getByRole("list", { name: "Dossier ajouté à l'agent (1)" }).textContent).toBe(
    "~/.claude/skills",
  );
  const message = dialog.getByText(/sont maintenant autorisés/).textContent ?? "";
  expect(message).toContain("`~/.claude/skills`");
  expect(message).not.toContain(SKILLS);
  expect(dialog.getByText(/^Non repris :/).textContent).toContain("sh -c 'pnpm --filter web build'");
  expect(m.allowed).toEqual([]);
  await user.click(dialog.getByRole("button", { name: "Autoriser et relancer" }));
  await waitFor(() =>
    expect(m.allowed).toEqual([
      {
        runId: "r1",
        questionId: m.snapshot().questions[0]?.id ?? "",
        rules: ["Bash(pnpm *)"],
        addDirs: [SKILLS],
      },
    ]),
  );
});

test("an unchecked item is neither repeated nor sent", async () => {
  const m = mount();
  const user = userEvent.setup();
  const block = await proposals();
  await user.click(block.getByRole("checkbox", { name: "Dossier ~/.claude/skills" }));
  await user.click(block.getByRole("button", { name: "Autoriser et relancer" }));
  const dialog = within(await screen.findByRole("alertdialog"));
  expect(dialog.queryByRole("list", { name: /^Dossiers? ajoutés?/ })).toBeNull();
  expect(dialog.getByText(/^Non repris :/).textContent).toContain("~/.claude/skills");
  await user.click(dialog.getByRole("button", { name: "Autoriser et relancer" }));
  await waitFor(() => expect(m.allowed.map((a) => [a.rules, a.addDirs])).toEqual([[["Bash(pnpm *)"], []]]));
});

test("nothing checked ⇒ nothing to allow", async () => {
  mount();
  const user = userEvent.setup();
  const block = await proposals();
  for (const box of block.getAllByRole("checkbox")) await user.click(box);
  expect(block.getByRole("button", { name: "Autoriser et relancer" }).hasAttribute("disabled")).toBe(true);
});

test("« Ignorer » answers the question without allowing anything", async () => {
  const m = mount();
  const user = userEvent.setup();
  const block = await proposals();
  await user.click(block.getByRole("button", { name: "Ignorer" }));
  await waitFor(() =>
    expect(m.snapshot().questions[0]?.answer).toMatchObject({ kind: "text", text: "Ignoré" }),
  );
  expect(m.allowed).toEqual([]);
});

test("a running run cannot be resumed: the proposals stay, the relaunch waits", async () => {
  mount({ state: "running" });
  const block = await proposals();
  expect(block.queryByRole("button", { name: "Autoriser et relancer" })).toBeNull();
  expect(block.getByText("Relance possible quand le run attend une réponse ou est terminé.")).toBeTruthy();
  expect(block.getByRole("button", { name: "Ignorer" })).toBeTruthy();
});

test("a reader sees the proposals without any button", async () => {
  mount({ reader: true });
  const block = await proposals();
  expect(block.queryAllByRole("button")).toEqual([]);
  expect(block.getAllByRole("checkbox").every((b) => b.hasAttribute("disabled"))).toBe(true);
});

test("without recorded denials the card falls back to the ordinary answer form", async () => {
  mount({ denials: false });
  const card = await screen.findByRole("article", { name: TITLE });
  expect(await within(card).findByRole("textbox", { name: "Autre réponse…" })).toBeTruthy();
  expect(within(card).queryByRole("region", { name: "Propositions de Kibo" })).toBeNull();
});
