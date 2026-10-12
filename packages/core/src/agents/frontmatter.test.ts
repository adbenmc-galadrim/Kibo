import { describe, expect, test } from "bun:test";
import { parseAgentFile, parseSkillFile, renderAgentFile, renderSkillFile } from "./frontmatter";

const agent = (frontmatter: string, body = "Corps") => `---\n${frontmatter}\n---\n\n${body}`;

function fileOf(text: string) {
  const parsed = parseAgentFile(text);
  if (!("file" in parsed)) throw new Error(parsed.problem);
  return parsed.file;
}

function problemOf(text: string): string {
  const parsed = parseAgentFile(text);
  if ("file" in parsed) throw new Error("expected a problem");
  return parsed.problem;
}

describe("agent files", () => {
  test("reads the known keys, the comma list of tools and the body", () => {
    const file = fileOf(
      agent("name: review-pr\ndescription: Relit une PR\nmodel: sonnet\ntools: Read, Grep"),
    );
    expect(file.frontmatter).toEqual({
      name: "review-pr",
      description: "Relit une PR",
      model: "sonnet",
      tools: ["Read", "Grep"],
      extra: "",
      extraKeys: [],
    });
    expect(file.body).toBe("Corps");
  });

  test("unquotes values and reads block scalars", () => {
    const quoted = fileOf(agent('name: a\ndescription: "Avec : deux-points"'));
    expect(quoted.frontmatter.description).toBe("Avec : deux-points");
    const single = fileOf(agent("name: a\ndescription: 'L''agent'"));
    expect(single.frontmatter.description).toBe("L'agent");
    const block = fileOf(agent("name: a\ndescription: |\n  ligne 1\n  ligne 2"));
    expect(block.frontmatter.description).toBe("ligne 1\nligne 2");
    const folded = fileOf(agent("name: a\ndescription: >\n  ligne 1\n  ligne 2"));
    expect(folded.frontmatter.description).toBe("ligne 1 ligne 2");
  });

  test("reads lists in block and inline forms", () => {
    expect(fileOf(agent("name: a\ndescription: d\nskills:\n  - a\n  - b")).frontmatter.skills).toEqual([
      "a",
      "b",
    ]);
    expect(fileOf(agent("name: a\ndescription: d\nskills: [a, b]")).frontmatter.skills).toEqual(["a", "b"]);
    expect(
      fileOf(agent("name: a\ndescription: d\ntools: Bash(git commit, ls), Read")).frontmatter.tools,
    ).toEqual(["Bash(git commit, ls)", "Read"]);
  });

  test("keeps the other keys byte for byte", () => {
    const extra = "permissionMode: acceptEdits\nhooks:\n  PreToolUse:\n    - matcher: Bash\n      hooks: []";
    const file = fileOf(agent(`name: a\n${extra}\ndescription: d`));
    expect(file.frontmatter.extra).toBe(extra);
    expect(file.frontmatter.extraKeys).toEqual(["permissionMode", "hooks"]);
    expect(renderAgentFile(file)).toContain(`${extra}\n---`);
  });

  test("an unreadable frontmatter is a problem, never an exception", () => {
    expect(problemOf(agent("description: d"))).toContain("name manquant");
    expect(problemOf(agent("name: a"))).toContain("description manquante");
    expect(problemOf("---\nname: a\ndescription: d\nCorps")).toContain("frontmatter");
    expect(problemOf(agent("name: a\ndescription: d\ntools: {a: 1}"))).toContain("tools");
    expect(problemOf(agent("name: a\ndescription: d\nsans deux points"))).toContain("frontmatter illisible");
    expect(problemOf("# Titre\n\nCorps")).toBe("frontmatter manquant");
    expect(problemOf(agent("name: Review\ndescription: d"))).toContain("name");
  });

  test("the body may hold a horizontal rule", () => {
    expect(fileOf(agent("name: a\ndescription: d", "Avant\n---\nAprès")).body).toBe("Avant\n---\nAprès");
  });

  test("a file written by Kibo reads and writes back identically", () => {
    const text =
      '---\nname: review-pr\ndescription: "Relit : une PR"\nmodel: opus\ntools: Read, Grep\ndisallowedTools: Bash\nskills:\n  - brainstorming\n  - "superpowers:brainstorming"\ncolor: blue\n---\n\n# Spec\n';
    expect(renderAgentFile(fileOf(text))).toBe(text);
  });

  test("quotes a description holding a colon", () => {
    const file = fileOf(agent("name: a\ndescription: d"));
    const text = renderAgentFile({
      ...file,
      frontmatter: { ...file.frontmatter, description: "Relit : vite" },
    });
    expect(text).toContain('description: "Relit : vite"');
    expect(fileOf(text).frontmatter.description).toBe("Relit : vite");
  });
});

describe("skill files", () => {
  test("a skill without frontmatter takes the name of its folder", () => {
    const parsed = parseSkillFile("# Titre", "deploy");
    if (!("file" in parsed)) throw new Error(parsed.problem);
    expect(parsed.name).toBe("deploy");
    expect(parsed.file).toEqual({ frontmatter: { extra: "", extraKeys: [] }, body: "# Titre" });
    expect(renderSkillFile(parsed.file)).toBe("# Titre");
  });

  test("reads the booleans and the allowed tools", () => {
    const parsed = parseSkillFile(
      "---\nname: deploy\ndisable-model-invocation: true\nallowed-tools: Bash(git *), Read\ncontext: fork\n---\n\nCorps",
      "x",
    );
    if (!("file" in parsed)) throw new Error(parsed.problem);
    expect(parsed.name).toBe("deploy");
    expect(parsed.file.frontmatter).toEqual({
      name: "deploy",
      disableModelInvocation: true,
      allowedTools: ["Bash(git *)", "Read"],
      extra: "context: fork",
      extraKeys: ["context"],
    });
    expect(renderSkillFile(parsed.file)).toBe(
      "---\nname: deploy\nallowed-tools: Bash(git *), Read\ndisable-model-invocation: true\ncontext: fork\n---\n\nCorps",
    );
  });

  test("a boolean that is not one is a problem", () => {
    const parsed = parseSkillFile("---\nuser-invocable: peut-être\n---\n", "x");
    expect("problem" in parsed && parsed.problem).toContain("user-invocable");
  });
});
