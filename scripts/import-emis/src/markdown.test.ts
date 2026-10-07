import { expect, test } from "bun:test";
import {
  citedPlanIds,
  cutClaudeMd,
  firstSentence,
  parseTodo,
  renderDescription,
  slugify,
  splitPassation,
  stripInlineMarkup,
  truncate,
  withFrontmatter,
} from "./markdown";

test("inline markup is stripped, emojis are kept", () => {
  expect(stripInlineMarkup("**Dossier** `x` ⚠️ y")).toBe("Dossier x ⚠️ y");
});

test("first sentence and truncation", () => {
  expect(firstSentence("Liste à confirmer. Tout ajout passe par une migration.")).toBe("Liste à confirmer.");
  expect(firstSentence("Sans point final")).toBe("Sans point final");
  expect(truncate("abcdef", 4)).toBe("abc…");
  expect(truncate("abc", 4)).toBe("abc");
});

test("a pr description has a header line and only non empty sections", () => {
  const base = {
    phase: "P1",
    sprint: "S2",
    areas: ["api", "web"],
    why: "Parce que.",
    perimetre: ["Route `/login`"],
    tests: [],
    pieges: [],
  };
  expect(renderDescription({ ...base, note: undefined })).toBe(
    "Phase P1 · Sprint S2 · Zones api, web\n\n## Pourquoi\n\nParce que.\n\n## Périmètre\n\n- Route `/login`\n",
  );
  const full = renderDescription({ ...base, tests: ["t"], pieges: ["p"], note: "n" });
  expect(full).toContain("## Tests\n\n- t\n\n## Pièges\n\n- p\n\n## Note\n\nn\n");
  expect(renderDescription({ ...base, areas: [], perimetre: [], note: undefined })).toBe(
    "Phase P1 · Sprint S2\n\n## Pourquoi\n\nParce que.\n",
  );
});

test("todo items carry their level and pending decision", () => {
  const md = [
    "# TODO",
    "| Niveau | Quand |",
    "# P0 — Avant le lancement",
    "",
    "- **DATA-1** 🟡 Liste à confirmer. Ensuite migration.",
    "# P1 — Après",
    "# À trier",
    "- **DEV-1** Décaler le port.",
    "  suite du point",
  ].join("\n");
  expect(parseTodo(md)).toEqual([
    { code: "DATA-1", level: "p0", pending: true, text: "Liste à confirmer. Ensuite migration." },
    { code: "DEV-1", level: "unsorted", pending: false, text: "Décaler le port.\nsuite du point" },
  ]);
});

test("the passation is split by numbered section", () => {
  const md =
    "# Passation\n\nIntro.\n\n## 00. L'essentiel\n\nA\n\n## 01. Contexte projet\n\nB\n### 1.1 Sous\nC\n";
  expect(splitPassation(md)).toEqual({
    intro: "# Passation\n\nIntro.\n",
    sections: [
      { number: "00", slug: "l-essentiel", title: "L'essentiel", body: "## 00. L'essentiel\n\nA\n" },
      {
        number: "01",
        slug: "contexte-projet",
        title: "Contexte projet",
        body: "## 01. Contexte projet\n\nB\n### 1.1 Sous\nC\n",
      },
    ],
  });
  expect(slugify("Rôles et permissions (RBAC)")).toBe("roles-et-permissions-rbac");
});

test("cited plan ids are unique and sorted", () => {
  expect(citedPlanIds("voir C1-2 et C0-2, puis CE-1 et C1-2")).toEqual(["C0-2", "C1-2", "CE-1"]);
});

test("the pilotage section of CLAUDE.md is cut", () => {
  const md = "# T\n\n## 3. Git\n- a\n\n## 4. Fichiers de pilotage\n- b\n";
  expect(cutClaudeMd(md)).toBe("# T\n\n## 3. Git\n- a\n");
});

test("frontmatter lists the source, the date and the tickets", () => {
  expect(withFrontmatter({ source: "TODO.md", imported: "2026-10-06", tickets: [] }, "# A\n")).toBe(
    "---\nsource: TODO.md\nimported: 2026-10-06\n---\n\n# A\n",
  );
  expect(withFrontmatter({ source: "x", imported: "d", tickets: ["plan:C0-2", "plan:C1-1"] }, "B\n")).toBe(
    "---\nsource: x\nimported: d\ntickets: [plan:C0-2, plan:C1-1]\n---\n\nB\n",
  );
});
