import { expect, test } from "bun:test";
import fc from "fast-check";
import { parseAgentFile, renderAgentFile } from "./frontmatter";

type Entry = { known: boolean; lines: string };

const word = fc.stringMatching(/^[a-z][a-z0-9-]{0,10}$/);
const tool = fc.stringMatching(/^[A-Z][a-zA-Z]{0,8}$/);
const plainText = fc.stringMatching(/^[A-Za-z][A-Za-z0-9]{0,6}( [A-Za-z0-9]{1,6}){0,4}$/);
const anyLine = fc
  .string({ minLength: 1, maxLength: 40 })
  .filter((s) => !s.includes("\n") && !s.includes("\r"));

const scalar = (key: string): fc.Arbitrary<string> =>
  fc.oneof(
    plainText.map((v) => `${key}: ${v}`),
    anyLine.map((v) => `${key}: ${JSON.stringify(v)}`),
    anyLine.map((v) => `${key}: '${v.replaceAll("'", "''")}'`),
    plainText.map((v) => `${key}: |\n  ${v}`),
  );

const list = (key: string, item: fc.Arbitrary<string>, comma: boolean): fc.Arbitrary<string> =>
  fc
    .array(item, { minLength: 1, maxLength: 4 })
    .chain((items) =>
      fc.constantFrom(
        `${key}:\n${items.map((i) => `  - ${i}`).join("\n")}`,
        `${key}: [${items.join(", ")}]`,
        ...(comma ? [`${key}: ${items.join(", ")}`] : []),
      ),
    );

const unknownValue = fc.oneof(
  plainText,
  fc
    .array(fc.tuple(word, plainText), { minLength: 1, maxLength: 3 })
    .map((pairs) => `\n${pairs.map(([k, v]) => `  ${k}:\n    - ${v}`).join("\n")}`),
);

const unknown = fc
  .uniqueArray(fc.stringMatching(/^x[a-z]{0,6}$/), { maxLength: 4 })
  .chain((keys) =>
    fc.tuple(
      ...keys.map((k) =>
        unknownValue.map((v): Entry => ({ known: false, lines: `${k}:${v.startsWith("\n") ? v : ` ${v}`}` })),
      ),
    ),
  );

const known = fc
  .tuple(
    word.map((n) => `name: ${n}`),
    scalar("description"),
    fc.option(fc.constantFrom("model: opus", "model: sonnet", "model: claude-opus-4-1", "model: inherit")),
    fc.option(list("tools", tool, true)),
    fc.option(list("disallowedTools", tool, true)),
    fc.option(list("skills", word, false)),
  )
  .map((lines) => lines.flatMap((l): Entry[] => (l === null ? [] : [{ known: true, lines: l }])));

const frontmatter = fc.tuple(known, unknown).chain(([k, u]) => {
  const all = [...k, ...u];
  return fc.shuffledSubarray(all, { minLength: all.length, maxLength: all.length });
});

test("reading then writing an agent file keeps its meaning, its body and its other keys", () => {
  fc.assert(
    fc.property(frontmatter, fc.string(), (entries, body) => {
      const text = `---\n${entries.map((e) => e.lines).join("\n")}\n---\n\n${body}`;
      const first = parseAgentFile(text);
      if (!("file" in first)) throw new Error(`${first.problem}\n${text}`);
      expect(first.file.body).toBe(body);
      const extra = entries.filter((e) => !e.known).map((e) => e.lines);
      expect(first.file.frontmatter.extra).toBe(extra.join("\n"));
      const second = parseAgentFile(renderAgentFile(first.file));
      expect(second).toEqual(first);
    }),
    { numRuns: 300 },
  );
});

test("any text is read without throwing", () => {
  fc.assert(
    fc.property(fc.string(), (text) => {
      const parsed = parseAgentFile(`---\n${text}`);
      expect("file" in parsed || "problem" in parsed).toBe(true);
    }),
  );
});
