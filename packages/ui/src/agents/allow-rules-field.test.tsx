import { expect, mock, test } from "bun:test";
import { ALLOW_MAX } from "@kibo/schema";
import { fireEvent, render, screen } from "@testing-library/react";
import { AllowRulesField, allowRulesProblem } from "./AllowRulesField";

const field = () => screen.getByLabelText("Autorisations");

test("a bare Bash rule is explained and the invalid list is never sent", () => {
  const onChange = mock((_: string[]) => {});
  const onProblem = mock((_: string | null) => {});
  render(<AllowRulesField value={[]} onChange={onChange} onProblem={onProblem} disabled={false} />);
  fireEvent.change(field(), { target: { value: "Edit\nBash\nBash(pnpm *)" } });
  expect(screen.getByText("Une règle Bash doit porter un motif : Bash(pnpm *).")).toBeTruthy();
  expect(field().getAttribute("aria-invalid")).toBe("true");
  expect(onChange).not.toHaveBeenCalled();
  expect(onProblem).toHaveBeenLastCalledWith("Une règle Bash doit porter un motif : Bash(pnpm *).");
});

test("valid lines are sent trimmed, blank lines ignored", () => {
  const onChange = mock((_: string[]) => {});
  const onProblem = mock((_: string | null) => {});
  render(<AllowRulesField value={["Read"]} onChange={onChange} onProblem={onProblem} disabled={false} />);
  expect((field() as HTMLTextAreaElement).value).toBe("Read");
  fireEvent.change(field(), { target: { value: "  Bash(pnpm *) \n\n Edit\n" } });
  expect(onChange).toHaveBeenLastCalledWith(["Bash(pnpm *)", "Edit"]);
  expect(onProblem).toHaveBeenLastCalledWith(null);
  expect(field().getAttribute("aria-invalid")).toBeNull();
});

test("each unsafe rule is named, and the list is capped", () => {
  expect(allowRulesProblem(["Edit", "", "Bash"])).toBe("Une règle Bash doit porter un motif : Bash(pnpm *).");
  for (const rule of [
    "Bash(*)",
    "Bash( * )",
    "Read(dangerously)",
    "bash(pnpm *)",
    "Bash(--dangerously-skip-permissions)",
  ])
    expect(allowRulesProblem([rule])).toBe(`Règle refusée : ${rule}`);
  const many = Array.from({ length: ALLOW_MAX + 1 }, (_, i) => `Bash(tool${i} *)`);
  expect(allowRulesProblem(many)).toBe("50 règles au plus.");
  expect(allowRulesProblem(["Bash(pnpm *)", "WebFetch(domain:github.com)", "Edit", " "])).toBeNull();
});
