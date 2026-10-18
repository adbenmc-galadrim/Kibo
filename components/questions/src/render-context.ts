import { renderMarkdownLite } from "@kibo/sdk";
import { Children, cloneElement, createElement, isValidElement, type ReactNode } from "react";

const ITALIC = /(?<![\p{L}\p{N}*_])([*_])(?![\s*_])(.+?)(?<![\s*_])\1(?![\p{L}\p{N}*_])/gu;

function italicText(text: string, key: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  let last = 0;
  for (const match of text.matchAll(ITALIC)) {
    if (match.index > last) nodes.push(text.slice(last, match.index));
    nodes.push(createElement("em", { key: `${key}-${match.index}` }, match[2]));
    last = match.index + match[0].length;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

function withItalics(node: ReactNode, key: string): ReactNode {
  if (typeof node === "string") return italicText(node, key);
  if (!isValidElement<{ children?: ReactNode }>(node) || node.type === "code") return node;
  const children = Children.toArray(node.props.children).map((child, i) => withItalics(child, `${key}-${i}`));
  return children.length === 0 ? node : cloneElement(node, undefined, ...children);
}

export const renderContext = (markdown: string): ReactNode => {
  const rendered = renderMarkdownLite(markdown);
  return rendered === null
    ? null
    : Children.toArray(rendered).map((block, i) => withItalics(block, String(i)));
};
