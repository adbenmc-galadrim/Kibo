import { Button } from "@kibo/sdk/ui/button";
import { Bold, Code, Italic, Link, type LucideIcon, Strikethrough } from "lucide-react";
import { frEditor } from "../fr-editor";
import { type Command, insertLink, toggleInline } from "./commands";

export type BubbleAnchor = { left: number; top: number };
export type BubbleProps = { at: BubbleAnchor | null; run(cmd: Command): void };

const ITEMS: readonly { label: string; icon: LucideIcon; command: Command }[] = [
  { label: frEditor.bold, icon: Bold, command: toggleInline("bold") },
  { label: frEditor.italic, icon: Italic, command: toggleInline("italic") },
  { label: frEditor.strike, icon: Strikethrough, command: toggleInline("strike") },
  { label: frEditor.code, icon: Code, command: toggleInline("code") },
  { label: frEditor.link, icon: Link, command: insertLink },
];

const keepEditorFocus = (e: { preventDefault(): void }) => e.preventDefault();

export function BubbleMenu({ at, run }: BubbleProps) {
  if (!at) return null;
  return (
    <div
      role="toolbar"
      aria-label={frEditor.bubble}
      className="absolute z-20 flex -translate-y-full items-center gap-0.5 rounded-md border bg-popover p-0.5 text-popover-foreground shadow-md"
      style={{ left: at.left, top: at.top - 6 }}
    >
      {ITEMS.map(({ label, icon: Icon, command }) => (
        <Button
          key={label}
          size="icon"
          variant="ghost"
          className="size-7"
          aria-label={label}
          title={label}
          onMouseDown={keepEditorFocus}
          onClick={() => run(command)}
        >
          <Icon aria-hidden className="size-3.5" />
        </Button>
      ))}
    </div>
  );
}
