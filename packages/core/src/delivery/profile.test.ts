import { expect, test } from "bun:test";
import { parseDeliveryProfile } from "./profile";

const PROFILE = `# Profil de livraison

## Publication

\`draft\` (push + PR draft sur la base) ou \`local\` (rien n'est poussé).

## Autorisations

- \`Bash(pnpm *)\`
- \`Bash(sh -c *)\`
- \`Bash(docker compose *)\` pour les services

## Spécification

- \`Bash(rm *)\` hors section
`;

test("the authorisations section gives the allowed rules and the refused ones", () => {
  expect(parseDeliveryProfile(PROFILE)).toEqual({
    allow: ["Bash(pnpm *)", "Bash(docker compose *)"],
    publication: "draft",
    rejected: ["Bash(sh -c *)"],
  });
});

test("publication reads the first word, quoted or bare", () => {
  expect(parseDeliveryProfile("## Publication\n\nlocal : rien n'est poussé\n").publication).toBe("local");
  expect(parseDeliveryProfile("## Publication\n\n`draft` — `git push`\n").publication).toBe("draft");
  expect(parseDeliveryProfile("## Publication\n\nà voir\n").publication).toBeNull();
});

test("a profile without these sections gives nothing", () => {
  expect(parseDeliveryProfile("# Profil\n\n## Spécification\n\n- `Bash(pnpm *)`\n")).toEqual({
    allow: [],
    publication: null,
    rejected: [],
  });
});

test("duplicated rules are kept once and rules beyond fifty are refused", () => {
  const lines = Array.from({ length: 52 }, (_, i) => `- \`Bash(tool${i} *)\``);
  const text = `## Autorisations\n\n- \`Bash(pnpm *)\`\n- \`Bash(pnpm *)\`\n${lines.join("\n")}\n`;
  const { allow, rejected } = parseDeliveryProfile(text);
  expect(allow).toHaveLength(50);
  expect(allow[0]).toBe("Bash(pnpm *)");
  expect(rejected).toEqual(["Bash(tool49 *)", "Bash(tool50 *)", "Bash(tool51 *)"]);
});
