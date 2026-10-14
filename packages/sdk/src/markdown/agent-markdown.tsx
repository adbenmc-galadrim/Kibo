import type { ReactNode } from "react";
import { cn } from "../lib/utils";
import { type MdBlock, parseAgentMarkdown } from "./markdown-blocks";
import { type InlineContext, renderInline } from "./markdown-inline";
import { MarkdownTable, type MarkdownTableLabels } from "./markdown-table";

export type MarkdownLabels = MarkdownTableLabels;

export type AgentMarkdownProps = {
  text: string;
  labels: MarkdownLabels;
  onTicket?: (key: string) => void;
  className?: string;
  children?: ReactNode;
};

type BlockProps = { block: MdBlock; ctx: InlineContext; labels: MarkdownLabels; path: string };

function Blocks({ blocks, ctx, labels, path }: Omit<BlockProps, "block"> & { blocks: readonly MdBlock[] }) {
  return blocks.map((block, i) => {
    const key = `${path}-${i}`;
    return <Block key={key} path={key} block={block} ctx={ctx} labels={labels} />;
  });
}

function Block({ block, ctx, labels, path }: BlockProps) {
  switch (block.kind) {
    case "p":
      return <p>{renderInline(block.children, ctx, path)}</p>;
    case "heading":
      return <p className="font-semibold">{renderInline(block.children, ctx, path)}</p>;
    case "list": {
      const items = block.items.map((item, i) => {
        const key = `${path}-${i}`;
        return (
          <li key={key} className="grid gap-1">
            <Blocks blocks={item} ctx={ctx} labels={labels} path={key} />
          </li>
        );
      });
      return block.ordered ? (
        <ol start={block.start} className="grid list-decimal gap-0.5 pl-5">
          {items}
        </ol>
      ) : (
        <ul className="grid list-disc gap-0.5 pl-5">{items}</ul>
      );
    }
    case "quote":
      return (
        <blockquote className="grid gap-2 border-l-2 pl-3 text-muted-foreground">
          <Blocks blocks={block.children} ctx={ctx} labels={labels} path={path} />
        </blockquote>
      );
    case "code":
      return (
        <pre className="overflow-x-auto rounded-md bg-muted p-2 font-mono text-xs">
          <code>{block.text}</code>
        </pre>
      );
    case "hr":
      return <hr className="border-border" />;
    case "table":
      return <MarkdownTable table={block} labels={labels} ctx={ctx} />;
  }
}

export function AgentMarkdownView({ text, labels, onTicket, className }: AgentMarkdownProps) {
  const ctx: InlineContext = onTicket ? { onTicket } : {};
  return (
    <div className={cn("grid min-w-0 gap-2 break-words", className)}>
      <Blocks blocks={parseAgentMarkdown(text)} ctx={ctx} labels={labels} path="b" />
    </div>
  );
}
