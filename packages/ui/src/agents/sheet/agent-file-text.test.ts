import { expect, test } from "bun:test";
import { agentFileText } from "./agent-file-text";

test("the file text shows the frontmatter Kibo writes, then the extra keys and the body", () => {
  expect(
    agentFileText({
      frontmatter: {
        name: "livraison",
        description: "Livre un ticket : code en TDD",
        model: "opus",
        tools: ["Read", "Bash"],
        skills: ["porte-qualite"],
        extra: "color: orange\n",
        extraKeys: ["color"],
      },
      body: "# Livraison\n",
    }),
  ).toBe(
    [
      "---",
      "name: livraison",
      'description: "Livre un ticket : code en TDD"',
      "model: opus",
      "tools: Read, Bash",
      "skills:",
      "  - porte-qualite",
      "color: orange",
      "---",
      "",
      "# Livraison",
      "",
    ].join("\n"),
  );
});

test("a plain description stays unquoted and absent keys are left out", () => {
  expect(
    agentFileText({
      frontmatter: { name: "seo", description: "Audite les pages publiques", extra: "", extraKeys: [] },
      body: "",
    }),
  ).toBe("---\nname: seo\ndescription: Audite les pages publiques\n---\n\n");
});
