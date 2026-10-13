import { expect, test } from "bun:test";
import type { AgentSettingsPatch } from "@kibo/schema";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { agentFixture, catalogFixture } from "../catalog/fixtures";
import { projectsFixture } from "../fixtures";
import { SubagentsField } from "./SubagentsField";

const DESCRIPTION =
  "Autorise tout sous-agent de l'ordinateur, du projet ou des plugins (utile pour les skills qui en lancent, comme /full-delivery).";

function renderField(allSubagents: boolean, disabled = false) {
  const patches: AgentSettingsPatch[] = [];
  const base = agentFixture();
  const agent = { ...base, settings: { ...base.settings, allSubagents } };
  render(
    <SubagentsField
      agent={agent}
      agents={catalogFixture()}
      projects={projectsFixture}
      disabled={disabled}
      onPatch={(p) => patches.push(p)}
    />,
  );
  return { patches, user: userEvent.setup() };
}

test("the switch allows every subagent of the machine, the project or the plugins", async () => {
  const { patches, user } = renderField(false);
  await user.click(screen.getByRole("button", { name: /^Sous-agents appelables/ }));
  const box = within(screen.getByRole("group", { name: "Sous-agents appelables" }));
  expect(box.getByText(DESCRIPTION)).toBeTruthy();
  const all = box.getByRole("switch", { name: "Tous les sous-agents" });
  expect(all.getAttribute("aria-checked")).toBe("false");
  expect(box.getByRole("checkbox", { name: "opus-dev" }).hasAttribute("disabled")).toBe(false);
  await user.click(all);
  expect(patches).toEqual([{ allSubagents: true }]);
});

test("with every subagent allowed the list and the generic box are disabled", async () => {
  const { user } = renderField(true);
  const trigger = screen.getByRole("button", { name: /^Sous-agents appelables/ });
  expect(trigger.textContent).toBe("Sous-agents appelablestous les sous-agents");
  await user.click(trigger);
  const box = within(screen.getByRole("group", { name: "Sous-agents appelables" }));
  expect(box.getByRole("switch", { name: "Tous les sous-agents" }).getAttribute("aria-checked")).toBe("true");
  for (const checkbox of box.getAllByRole("checkbox")) expect(checkbox.hasAttribute("disabled")).toBe(true);
  expect(box.queryByText(/Kibo refuse tout autre sous-agent/)).toBeNull();
});

test("a Kibo agent cannot allow every subagent", async () => {
  const { user } = renderField(false, true);
  await user.click(screen.getByRole("button", { name: /^Sous-agents appelables/ }));
  expect(screen.getByRole("switch", { name: "Tous les sous-agents" }).hasAttribute("disabled")).toBe(true);
});
