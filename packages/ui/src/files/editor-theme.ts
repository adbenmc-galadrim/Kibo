import { defaultHighlightStyle, HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { EditorView } from "@codemirror/view";

const TOKEN_COLORS: Record<string, string> = {
  "#404740": "var(--code-comment)",
  "#708": "var(--code-keyword)",
  "#219": "var(--code-constant)",
  "#164": "var(--code-constant)",
  "#a11": "var(--code-string)",
  "#e40": "var(--code-regexp)",
  "#00f": "var(--code-definition)",
  "#30a": "var(--code-variable)",
  "#085": "var(--code-type)",
  "#167": "var(--code-type)",
  "#256": "var(--code-constant)",
  "#00c": "var(--code-constant)",
  "#940": "var(--code-comment)",
  "#f00": "var(--code-invalid)",
};

const kiboHighlightStyle = HighlightStyle.define(
  defaultHighlightStyle.specs.map((spec) =>
    typeof spec.color === "string" ? { ...spec, color: TOKEN_COLORS[spec.color] ?? spec.color } : spec,
  ),
);

export const kiboEditorTheme = [
  EditorView.theme({
    "&": { backgroundColor: "var(--background)", color: "var(--foreground)", height: "100%" },
    ".cm-scroller": { fontFamily: "var(--font-mono)", lineHeight: "1.5rem" },
    ".cm-gutters": { backgroundColor: "var(--background)", color: "var(--muted-foreground)", border: "none" },
    ".cm-activeLine, .cm-activeLineGutter": {
      backgroundColor: "color-mix(in oklab, var(--accent) 60%, transparent)",
    },
    ".cm-cursor, .cm-dropCursor": { borderLeftColor: "var(--foreground)" },
    "&.cm-focused": { outline: "none" },
    ".cm-tooltip, .cm-panels": {
      backgroundColor: "var(--popover)",
      color: "var(--popover-foreground)",
      borderColor: "var(--border)",
    },
  }),
  syntaxHighlighting(kiboHighlightStyle),
];
