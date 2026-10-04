import { EditorSelection, type EditorState, type Line, type TransactionSpec } from "@codemirror/state";
import { frEditor } from "../fr-editor";

export type Command = (state: EditorState) => TransactionSpec | null;
export type InlineMark = "bold" | "italic" | "strike" | "code";

const MARKS: Record<InlineMark, string> = { bold: "**", italic: "*", strike: "~~", code: "`" };

const leadingRun = (text: string, char: string): number => {
  let n = 0;
  while (text[n] === char) n++;
  return n;
};
const trailingRun = (text: string, char: string): number => leadingRun([...text].reverse().join(""), char);

const hasMark = (mark: InlineMark, before: number, after: number): boolean => {
  const run = Math.min(before, after);
  if (mark === "bold") return run >= 2;
  if (mark === "italic") return run % 2 === 1;
  return run >= MARKS[mark].length;
};

const markChar = (mark: InlineMark): string => MARKS[mark].charAt(0);

export function toggleInline(mark: InlineMark): Command {
  return (state) => {
    const m = MARKS[mark];
    const char = markChar(mark);
    const { from, to } = state.selection.main;
    const text = state.sliceDoc(from, to);
    const before = trailingRun(state.sliceDoc(Math.max(0, from - 3), from), char);
    const after = leadingRun(state.sliceDoc(to, to + 3), char);
    if (hasMark(mark, before, after)) {
      return {
        changes: [
          { from: from - m.length, to: from },
          { from: to, to: to + m.length },
        ],
        selection: EditorSelection.range(from - m.length, to - m.length),
      };
    }
    const innerRun = Math.min(
      leadingRun(text, char),
      trailingRun(text, char),
      Math.floor((text.length - 1) / 2),
    );
    if (hasMark(mark, innerRun, innerRun)) {
      const inner = text.slice(m.length, -m.length);
      return {
        changes: { from, to, insert: inner },
        selection: EditorSelection.range(from, from + inner.length),
      };
    }
    const body = text === "" ? frEditor.placeholder : text;
    return {
      changes: { from, to, insert: `${m}${body}${m}` },
      selection: EditorSelection.range(from + m.length, from + m.length + body.length),
    };
  };
}

const selectedLines = (state: EditorState): Line[] => {
  const { from, to } = state.selection.main;
  const lines: Line[] = [];
  for (let n = state.doc.lineAt(from).number; n <= state.doc.lineAt(to).number; n++)
    lines.push(state.doc.line(n));
  return lines;
};

const commonSuffix = (a: string, b: string): number => {
  let n = 0;
  while (n < a.length && n < b.length && a[a.length - 1 - n] === b[b.length - 1 - n]) n++;
  return n;
};

const rewriteLines = (
  state: EditorState,
  rewrite: (text: string, index: number) => string,
): TransactionSpec => ({
  changes: selectedLines(state).map((line, index) => {
    const next = rewrite(line.text, index);
    const kept = commonSuffix(line.text, next);
    return { from: line.from, to: line.to - kept, insert: next.slice(0, next.length - kept) };
  }),
});

const HEADING = /^#{1,6} /;

export function setHeading(level: 0 | 1 | 2 | 3): Command {
  return (state) =>
    rewriteLines(state, (text) => {
      const bare = text.replace(HEADING, "");
      return level === 0 ? bare : `${"#".repeat(level)} ${bare}`;
    });
}

type BlockKind = "bullet" | "ordered" | "task" | "quote";

const BLOCK: Record<BlockKind, { test: RegExp; prefix: (index: number) => string }> = {
  task: { test: /^[-*] \[[ xX]\] /, prefix: () => "- [ ] " },
  bullet: { test: /^[-*] (?!\[[ xX]\] )/, prefix: () => "- " },
  ordered: { test: /^\d+\. /, prefix: (index) => `${index + 1}. ` },
  quote: { test: /^> /, prefix: () => "> " },
};

const stripBlock = (text: string): string =>
  Object.values(BLOCK).reduce((acc, { test }) => acc.replace(test, ""), text);

export function toggleBlock(kind: BlockKind): Command {
  return (state) => {
    const allSet = selectedLines(state).every((line) => BLOCK[kind].test.test(line.text));
    return rewriteLines(state, (text, index) =>
      allSet ? stripBlock(text) : `${BLOCK[kind].prefix(index)}${stripBlock(text)}`,
    );
  };
}

const leadFor = (state: EditorState, from: number): string =>
  state.doc.lineAt(from).from === from ? "" : "\n";

export function insertCodeBlock(language: string): Command {
  return (state) => {
    const { from, to } = state.selection.main;
    const text = state.sliceDoc(from, to);
    const lead = leadFor(state, from);
    const fence = `\`\`\`${language}\n`;
    const insert = `${lead}${fence}${text}\n\`\`\``;
    const cursor = from + lead.length + fence.length;
    return { changes: { from, to, insert }, selection: EditorSelection.range(cursor, cursor + text.length) };
  };
}

const URL_PLACEHOLDER = "url";

export const insertLink: Command = (state) => {
  const { from, to } = state.selection.main;
  const text = state.sliceDoc(from, to) || frEditor.placeholder;
  const urlFrom = from + text.length + 3;
  return {
    changes: { from, to, insert: `[${text}](${URL_PLACEHOLDER})` },
    selection: EditorSelection.range(urlFrom, urlFrom + URL_PLACEHOLDER.length),
  };
};

const tableRow = (cells: readonly string[]): string => `| ${cells.join(" | ")} |`;

export function insertTable(columns = 3, rows = 2): Command {
  return (state) => {
    const { from, to } = state.selection.main;
    const indexes = Array.from({ length: columns }, (_, i) => i + 1);
    const header = tableRow(indexes.map(frEditor.column));
    const separator = tableRow(indexes.map(() => "---"));
    const empty = tableRow(indexes.map(() => ""));
    const lead = leadFor(state, from);
    const insert = `${lead}${[header, separator, ...Array.from({ length: rows }, () => empty)].join("\n")}`;
    return { changes: { from, to, insert }, selection: EditorSelection.cursor(from + lead.length + 2) };
  };
}

const TASK = /^([-*] \[)([ xX])(\] )/;

export function toggleTaskAt(pos: number): Command {
  return (state) => {
    const line = state.doc.lineAt(pos);
    const match = TASK.exec(line.text);
    if (!match) return null;
    const at = line.from + (match[1]?.length ?? 0);
    return { changes: { from: at, to: at + 1, insert: match[2] === " " ? "x" : " " } };
  };
}
