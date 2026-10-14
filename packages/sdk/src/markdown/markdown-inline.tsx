import { Fragment, type ReactNode } from "react";
import { ticketKeyNodes } from "../markdown-lite";
import type { MdInline } from "./markdown-blocks";

export type InlineContext = { onTicket?: (key: string) => void };

const CODE_CLASS = "rounded bg-muted px-1 font-mono text-[0.9em]";
const LINK_CLASS = "underline underline-offset-2 hover:text-foreground";

function inlineNode(node: MdInline, ctx: InlineContext, key: string): ReactNode {
  switch (node.kind) {
    case "text":
      return <Fragment key={key}>{ticketKeyNodes(node.text, key, ctx.onTicket)}</Fragment>;
    case "code":
      return (
        <code key={key} className={CODE_CLASS}>
          {node.text}
        </code>
      );
    case "break":
      return <br key={key} />;
    case "strong":
      return <strong key={key}>{renderInline(node.children, ctx, key)}</strong>;
    case "em":
      return <em key={key}>{renderInline(node.children, ctx, key)}</em>;
    case "s":
      return <s key={key}>{renderInline(node.children, ctx, key)}</s>;
    case "link":
      return node.href === null ? (
        <Fragment key={key}>{renderInline(node.children, ctx, key)}</Fragment>
      ) : (
        <a key={key} href={node.href} target="_blank" rel="noreferrer noopener" className={LINK_CLASS}>
          {renderInline(node.children, {}, key)}
        </a>
      );
  }
}

export function renderInline(nodes: readonly MdInline[], ctx: InlineContext, key = "i"): ReactNode[] {
  return nodes.map((node, i) => inlineNode(node, ctx, `${key}-${i}`));
}
