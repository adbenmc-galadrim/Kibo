import { beforeEach, expect, mock, test } from "bun:test";
import type { RpcRequest, SkillSuggestion } from "@kibo/schema";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { apiMock } from "../api-mock";

const suggestion = (id: string, runs30d: number, extra: Partial<SkillSuggestion> = {}): SkillSuggestion => ({
  id,
  name: id.split(":").at(-1) ?? id,
  description: `Description de ${id}`,
  source: "user",
  plugin: null,
  runs30d,
  lastAt: null,
  ...extra,
});

const SKILLS = [
  suggestion("review-pr", 7),
  suggestion("superpowers:brainstorming", 4, { source: "plugin", plugin: "superpowers" }),
  suggestion("brainstorming", 2, { source: "project" }),
  suggestion("deploy", 0),
];

const calls: RpcRequest[] = [];
let served: SkillSuggestion[] = SKILLS;

mock.module("../api", () =>
  apiMock({
    client: {
      rpc: (req: RpcRequest) => {
        calls.push(req);
        return Promise.resolve(req.method === "skills.suggest" ? { skills: served } : null);
      },
      subscribeTopic: () => () => {},
      subscribe: () => () => {},
    },
  }),
);

const { useSkillComplete } = await import("./use-skill-complete");

const submitted = mock((_: string) => {});
const outerKeys = mock((_: string) => {});

function Field() {
  const [value, setValue] = useState("");
  const complete = useSkillComplete({
    agentRef: "global:dev",
    projectId: "p1",
    value,
    onValueChange: setValue,
  });
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submitted(value);
      }}
    >
      <div className="relative">
        <input aria-label="Message" {...complete.inputProps} />
        {complete.list}
      </div>
    </form>
  );
}

window.addEventListener("keydown", (e) => outerKeys(e.key));

beforeEach(() => {
  calls.length = 0;
  served = SKILLS;
  submitted.mockClear();
  outerKeys.mockClear();
});

const show = async () => {
  const user = userEvent.setup();
  render(<Field />);
  const box = screen.getByRole("combobox", { name: "Message" });
  await user.click(box);
  await waitFor(() =>
    expect(calls).toContainEqual({ method: "skills.suggest", agentRef: "global:dev", projectId: "p1" }),
  );
  return { user, box };
};
const optionNames = () =>
  within(screen.getByRole("listbox", { name: "Skills" }))
    .getAllByRole("option")
    .map((o) => o.textContent);

test("a slash opens the skills ranked by usage, with origin and usage", async () => {
  const { user, box } = await show();
  expect(box.getAttribute("aria-expanded")).toBe("false");
  await user.type(box, "/");
  expect(optionNames()).toEqual([
    "/review-prCet ordinateurDescription de review-pr7 runs/30 j",
    "/superpowers:brainstormingPlugin · superpowersDescription de superpowers:brainstorming4 runs/30 j",
    "/brainstormingProjetDescription de brainstorming2 runs/30 j",
    "/deployCet ordinateurDescription de deployjamais utilisé",
  ]);
  expect(box.getAttribute("aria-expanded")).toBe("true");
  const [first] = screen.getAllByRole("option");
  expect(box.getAttribute("aria-activedescendant")).toBe(first?.id ?? "none");
  expect(first?.getAttribute("aria-selected")).toBe("true");
});

test("typing filters, prefix first, and the keyboard inserts without sending", async () => {
  const { user, box } = await show();
  await user.type(box, "Relis avec /bra");
  expect(optionNames().map((n) => n?.split("Description")[0])).toEqual([
    "/superpowers:brainstormingPlugin · superpowers",
    "/brainstormingProjet",
  ]);
  await user.keyboard("{ArrowDown}{Enter}");
  expect(box).toHaveProperty("value", "Relis avec /brainstorming ");
  expect(submitted).not.toHaveBeenCalled();
  expect(screen.queryByRole("listbox")).toBeNull();
  await user.keyboard("{Enter}");
  expect(submitted).toHaveBeenCalledWith("Relis avec /brainstorming ");
});

test("ArrowUp wraps to the last skill and Tab inserts it", async () => {
  const { user, box } = await show();
  await user.type(box, "/");
  await user.keyboard("{ArrowUp}{Tab}");
  expect(box).toHaveProperty("value", "/deploy ");
});

test("Escape closes the list without reaching the container, a click inserts", async () => {
  const { user, box } = await show();
  await user.type(box, "/re");
  await user.keyboard("{Escape}");
  expect(screen.queryByRole("listbox")).toBeNull();
  expect(outerKeys).not.toHaveBeenCalledWith("Escape");
  await user.type(box, " /");
  await user.hover(screen.getByRole("option", { name: /^\/deploy/ }));
  expect(screen.getByRole("option", { name: /^\/deploy/ }).getAttribute("aria-selected")).toBe("true");
  await user.click(screen.getByRole("option", { name: /^\/deploy/ }));
  expect(box).toHaveProperty("value", "/re /deploy ");
});

test("no match and no allowed skill say so; a slash inside a word does not open", async () => {
  const { user, box } = await show();
  await user.type(box, "a/b");
  expect(screen.queryByRole("listbox")).toBeNull();
  await user.type(box, " /zz");
  expect(screen.getByText("Aucun skill ne correspond.")).toBeTruthy();
  await user.keyboard("{Enter}");
  expect(submitted).toHaveBeenCalledWith("a/b /zz");
});

test("an agent without skills", async () => {
  served = [];
  const { user, box } = await show();
  await user.type(box, "/");
  expect(screen.getByText("Aucun skill autorisé pour cet agent.")).toBeTruthy();
});
