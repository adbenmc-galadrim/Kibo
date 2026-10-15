import { beforeEach, expect, mock, test } from "bun:test";
import { type Agent, DELIVERY_ALLOW_DEFAULTS, type RpcRequest, systemAgentSettings } from "@kibo/schema";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { apiMock } from "../../api-mock";
import { agentFixture } from "../catalog/fixtures";

const calls: RpcRequest[] = [];
let fail = false;

mock.module("../../api", () =>
  apiMock({
    client: {
      rpc: async (req: RpcRequest) => {
        calls.push(req);
        if (fail) throw new Error("down");
        return agentFixture({ settings: { ...agentFixture().settings, permissionMode: "auto" } });
      },
    },
  }),
);

const { PresetButton } = await import("./PresetButton");

const HOME = "/Users/adam";
const delivery = (): Agent =>
  agentFixture({
    ref: "global:full-delivery",
    name: "full-delivery",
    settings: { ...agentFixture().settings, allow: ["Bash(git *)"], addDirs: [] },
  });

beforeEach(() => {
  calls.length = 0;
  fail = false;
});

test("screen 210b: the dialog lists what the preset changes before applying it", async () => {
  const applied = mock((_: Agent) => {});
  render(<PresetButton agent={delivery()} home={HOME} onApplied={applied} />);
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: "Préréglage : Livraison" }));
  const dialog = within(await screen.findByRole("dialog", { name: "Appliquer le préréglage Livraison ?" }));
  const rows = dialog.getAllByRole("definition").map((d) => d.textContent);
  expect(rows).toEqual([
    "Demande à chaque action → Automatique (l'agent décide, sans contournement)",
    "aucun → Tous les sous-agents",
    "Worktree par ticket (inchangé)",
    "Tous les skills (inchangé)",
  ]);
  const added = DELIVERY_ALLOW_DEFAULTS.filter((r) => r !== "Bash(git *)");
  expect(dialog.getByText(`Règles ajoutées (${added.length})`)).toBeTruthy();
  expect(dialog.getAllByRole("listitem").map((li) => li.textContent)).toEqual([...added, "~/.claude/skills"]);
  expect(dialog.queryByText("Bash(git *)")).toBeNull();
  expect(dialog.getByText("Dossiers ajoutés (1)")).toBeTruthy();
  await user.click(dialog.getByRole("button", { name: "Appliquer le préréglage" }));
  expect(calls).toEqual([{ method: "agents.applyPreset", ref: "global:full-delivery", preset: "delivery" }]);
  expect(applied).toHaveBeenCalledTimes(1);
  expect(screen.queryByRole("dialog")).toBeNull();
});

test("a refused preset keeps the dialog open with the reason", async () => {
  fail = true;
  render(<PresetButton agent={delivery()} home={HOME} onApplied={() => {}} />);
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: "Préréglage : Livraison" }));
  await user.click(await screen.findByRole("button", { name: "Appliquer le préréglage" }));
  expect((await screen.findByRole("alert")).textContent).toBe("Impossible d'appliquer le préréglage.");
  expect(screen.getByRole("dialog")).toBeTruthy();
});

test("a Kibo agent has no preset", () => {
  const system = agentFixture({
    ref: "system:assistant",
    scope: "system",
    settings: systemAgentSettings("assistant", {}),
  });
  render(<PresetButton agent={system} home={HOME} onApplied={() => {}} />);
  expect(screen.queryByRole("button", { name: "Préréglage : Livraison" })).toBeNull();
});
