import { expect, test } from "bun:test";
import { RESUME_AFTER_ALLOW } from "./denial";

test("the resume text names what is now allowed", () => {
  expect(RESUME_AFTER_ALLOW(["Bash(pnpm *)", "Bash(git *)"], ["/Users/a/.claude/skills"])).toBe(
    "Kibo : les règles `Bash(pnpm *)`, `Bash(git *)` et le dossier `/Users/a/.claude/skills` sont maintenant autorisés. Reprends là où tu t'es arrêté, sans refaire ce qui est déjà fait.",
  );
  expect(RESUME_AFTER_ALLOW(["Bash(pnpm *)", "Bash(git *)"], [])).toBe(
    "Kibo : les règles `Bash(pnpm *)`, `Bash(git *)` sont maintenant autorisées. Reprends là où tu t'es arrêté, sans refaire ce qui est déjà fait.",
  );
  expect(RESUME_AFTER_ALLOW([], ["/Users/a/x", "/Users/a/y"])).toBe(
    "Kibo : les dossiers `/Users/a/x`, `/Users/a/y` sont maintenant autorisés. Reprends là où tu t'es arrêté, sans refaire ce qui est déjà fait.",
  );
});

test("a single rule or a single folder is named in the singular", () => {
  const resume = "Reprends là où tu t'es arrêté, sans refaire ce qui est déjà fait.";
  expect(RESUME_AFTER_ALLOW(["Bash(pnpm *)"], [])).toBe(
    `Kibo : la règle \`Bash(pnpm *)\` est maintenant autorisée. ${resume}`,
  );
  expect(RESUME_AFTER_ALLOW([], ["/Users/a/x"])).toBe(
    `Kibo : le dossier \`/Users/a/x\` est maintenant autorisé. ${resume}`,
  );
  expect(RESUME_AFTER_ALLOW(["Bash(pnpm *)"], ["/Users/a/x"])).toBe(
    `Kibo : la règle \`Bash(pnpm *)\` et le dossier \`/Users/a/x\` sont maintenant autorisés. ${resume}`,
  );
  expect(RESUME_AFTER_ALLOW(["Bash(pnpm *)", "Bash(git *)"], ["/Users/a/x"])).toBe(
    `Kibo : les règles \`Bash(pnpm *)\`, \`Bash(git *)\` et le dossier \`/Users/a/x\` sont maintenant autorisés. ${resume}`,
  );
});
