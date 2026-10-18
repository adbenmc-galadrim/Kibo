import { expect, mock, test } from "bun:test";
import { fireEvent, render, screen } from "@testing-library/react";
import { AddDirsField, addDirsProblem } from "./AddDirsField";

const HOME = "/Users/adam";
const field = () => screen.getByRole("textbox", { name: "Dossiers supplémentaires" });
const type = (text: string) => fireEvent.change(field(), { target: { value: text } });

test("a secret folder is refused with its reason and never saved", () => {
  const changed = mock((_: string[]) => {});
  const problems = mock((_: string | null) => {});
  render(<AddDirsField value={[]} home={HOME} onChange={changed} onProblem={problems} disabled={false} />);
  type("~/.kibo");
  expect(screen.getByText("Ce dossier contient des secrets ou sort de ton dossier personnel.")).toBeTruthy();
  expect(field().getAttribute("aria-invalid")).toBe("true");
  expect(changed).not.toHaveBeenCalled();
  expect(problems).toHaveBeenLastCalledWith(
    "Ce dossier contient des secrets ou sort de ton dossier personnel.",
  );
});

test("a tilde is expanded with the home folder of the machine", () => {
  const changed = mock((_: string[]) => {});
  render(<AddDirsField value={[]} home={HOME} onChange={changed} disabled={false} />);
  type("~/.claude/skills\n\n/Users/adam/Documents/silo\n");
  expect(changed).toHaveBeenLastCalledWith(["/Users/adam/.claude/skills", "/Users/adam/Documents/silo"]);
  expect(field().getAttribute("aria-invalid")).toBeNull();
});

test("saved folders are shown under the home folder with a tilde", () => {
  render(
    <AddDirsField value={["/Users/adam/.claude/skills"]} home={HOME} onChange={() => {}} disabled={false} />,
  );
  expect((field() as HTMLTextAreaElement).value).toBe("~/.claude/skills");
});

test("while the home folder loads the field waits", () => {
  render(<AddDirsField value={[]} home={undefined} onChange={() => {}} disabled={false} />);
  expect((field() as HTMLTextAreaElement).disabled).toBe(true);
});

test("without a user home the field refuses with its reason", () => {
  render(<AddDirsField value={["/Users/adam/x"]} home={null} onChange={() => {}} disabled={false} />);
  expect((field() as HTMLTextAreaElement).disabled).toBe(true);
  expect(
    screen.getByText(
      "Dossier personnel inconnu de cette session : les dossiers ne se règlent que sur la machine de Kibo.",
    ),
  ).toBeTruthy();
});

test("the root of ~/.claude, a folder outside home and more than 20 folders are refused", () => {
  expect(addDirsProblem(["~/.claude"], HOME)).toBe(
    "Ce dossier contient des secrets ou sort de ton dossier personnel.",
  );
  expect(addDirsProblem(["/opt/tools"], HOME)).toBe(
    "Ce dossier contient des secrets ou sort de ton dossier personnel.",
  );
  const many = Array.from({ length: 21 }, (_, i) => `~/d${i}`);
  expect(addDirsProblem(many, HOME)).toBe("20 dossiers au plus.");
  expect(addDirsProblem(["~/.claude/agents"], HOME)).toBeNull();
});
