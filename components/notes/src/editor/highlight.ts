import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { tags } from "@lezer/highlight";

const style = HighlightStyle.define([
  { tag: tags.heading1, class: "text-2xl font-bold" },
  { tag: tags.heading2, class: "text-xl font-semibold" },
  { tag: tags.heading3, class: "text-lg font-semibold" },
  { tag: tags.strong, fontWeight: "600" },
  { tag: tags.emphasis, fontStyle: "italic" },
  { tag: tags.strikethrough, textDecoration: "line-through" },
  { tag: tags.monospace, class: "rounded bg-muted px-1 font-mono text-[13px]" },
  { tag: tags.link, class: "underline" },
  { tag: tags.quote, class: "text-muted-foreground" },
  { tag: tags.comment, color: "var(--code-comment)" },
  { tag: [tags.keyword, tags.operatorKeyword, tags.controlKeyword], color: "var(--code-keyword)" },
  { tag: [tags.number, tags.bool, tags.atom, tags.null], color: "var(--code-constant)" },
  { tag: [tags.string, tags.special(tags.string)], color: "var(--code-string)" },
  { tag: tags.regexp, color: "var(--code-regexp)" },
  {
    tag: [tags.definition(tags.variableName), tags.function(tags.variableName)],
    color: "var(--code-definition)",
  },
  { tag: [tags.typeName, tags.className, tags.propertyName], color: "var(--code-type)" },
  { tag: tags.invalid, color: "var(--code-invalid)" },
]);

export const editorHighlight = syntaxHighlighting(style);
