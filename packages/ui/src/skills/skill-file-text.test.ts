import { expect, test } from "bun:test";
import { SKILL_TEXT, skillFixture } from "./fixtures";
import { composeSkillText, fieldsOf, splitSkillText, splitTools } from "./skill-file-text";

const file = skillFixture().file;

test("the body is what follows the frontmatter, and the prefix keeps it byte for byte", () => {
  const split = splitSkillText(SKILL_TEXT);
  expect(split.body).toBe("# Porte qualité\nRelis le diff d'une branche avant son push.\n");
  expect(composeSkillText({ ...split, fields: null, file })).toBe(SKILL_TEXT);
  expect(splitSkillText("# Sans frontmatter\n")).toEqual({ prefix: "", body: "# Sans frontmatter\n" });
});

test("the fields come from the parsed frontmatter, with the defaults of Claude Code", () => {
  expect(fieldsOf(file)).toEqual({
    description: "Porte qualité d'une branche avant son push.",
    allowedTools: "Read, Grep",
    disableModelInvocation: false,
    userInvocable: true,
  });
  expect(fieldsOf(null)).toEqual({
    description: "",
    allowedTools: "",
    disableModelInvocation: false,
    userInvocable: true,
  });
});

test("changed fields rewrite the known keys and keep the other fields as they are", () => {
  const split = splitSkillText(SKILL_TEXT);
  const fields = {
    ...fieldsOf(file),
    description: "Relit: une branche",
    allowedTools: "Read, Bash(git diff *, git log)",
  };
  expect(composeSkillText({ ...split, fields: { ...fields, disableModelInvocation: true }, file })).toBe(
    [
      "---",
      "name: porte-qualite",
      'description: "Relit: une branche"',
      "allowed-tools: Read, Bash(git diff *, git log)",
      "disable-model-invocation: true",
      "user-invocable: true",
      "context: fork",
      "---",
      "",
      "# Porte qualité",
      "Relis le diff d'une branche avant son push.",
      "",
    ].join("\n"),
  );
});

test("a default value never set in the file stays out of it", () => {
  const bare = { frontmatter: { name: "x", extra: "", extraKeys: [] }, body: "corps" };
  const fields = { ...fieldsOf(bare), description: "Fait une chose." };
  expect(composeSkillText({ prefix: "", body: "corps", fields, file: bare })).toBe(
    "---\nname: x\ndescription: Fait une chose.\n---\n\ncorps",
  );
});

test("tools split on top-level commas only", () => {
  expect(splitTools(" Read, Grep ,Bash(git diff *, git log), ")).toEqual([
    "Read",
    "Grep",
    "Bash(git diff *, git log)",
  ]);
});
