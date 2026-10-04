import { Button } from "@kibo/sdk/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@kibo/sdk/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@kibo/sdk/ui/tooltip";
import {
  Bold,
  Code,
  Heading,
  Italic,
  Link,
  List,
  ListChecks,
  ListOrdered,
  type LucideIcon,
  Quote,
  SquareCode,
  Strikethrough,
  Table,
} from "lucide-react";
import type { ReactNode } from "react";
import { frEditor } from "../fr-editor";
import {
  type Command,
  insertCodeBlock,
  insertLink,
  insertTable,
  setHeading,
  toggleBlock,
  toggleInline,
} from "./commands";

type Props = { run(cmd: Command): void; focusEditor(): void };
type Action = { label: string; icon: LucideIcon; command: Command; shortcut?: string };

const INLINE: readonly Action[] = [
  { label: frEditor.bold, icon: Bold, command: toggleInline("bold"), shortcut: "⌘B" },
  { label: frEditor.italic, icon: Italic, command: toggleInline("italic"), shortcut: "⌘I" },
  { label: frEditor.strike, icon: Strikethrough, command: toggleInline("strike") },
  { label: frEditor.code, icon: Code, command: toggleInline("code"), shortcut: "⌘E" },
];

const BLOCKS: readonly Action[] = [
  { label: frEditor.bullet, icon: List, command: toggleBlock("bullet") },
  { label: frEditor.ordered, icon: ListOrdered, command: toggleBlock("ordered") },
  { label: frEditor.task, icon: ListChecks, command: toggleBlock("task") },
  { label: frEditor.quote, icon: Quote, command: toggleBlock("quote") },
];

const INSERTS: readonly Action[] = [
  { label: frEditor.link, icon: Link, command: insertLink },
  { label: frEditor.table, icon: Table, command: insertTable() },
];

const HEADING_LEVELS = [1, 2, 3] as const;

const keepEditorFocus = (e: { preventDefault(): void }) => e.preventDefault();

function Hint({ label, shortcut, children }: { label: string; shortcut?: string; children: ReactNode }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent>{shortcut ? `${label} · ${shortcut}` : label}</TooltipContent>
    </Tooltip>
  );
}

function ActionButton({ action, run }: { action: Action; run: Props["run"] }) {
  const Icon = action.icon;
  return (
    <Hint label={action.label} shortcut={action.shortcut}>
      <Button
        size="icon"
        variant="ghost"
        className="size-7"
        aria-label={action.label}
        onMouseDown={keepEditorFocus}
        onClick={() => run(action.command)}
      >
        <Icon className="size-3.5" />
      </Button>
    </Hint>
  );
}

function MenuButton({
  label,
  icon: Icon,
  focusEditor,
  children,
}: {
  label: string;
  icon: LucideIcon;
  focusEditor(): void;
  children: ReactNode;
}) {
  return (
    <DropdownMenu>
      <Hint label={label}>
        <DropdownMenuTrigger asChild>
          <Button
            size="icon"
            variant="ghost"
            className="size-7"
            aria-label={label}
            onMouseDown={keepEditorFocus}
          >
            <Icon className="size-3.5" />
          </Button>
        </DropdownMenuTrigger>
      </Hint>
      <DropdownMenuContent
        align="start"
        onCloseAutoFocus={(e) => {
          e.preventDefault();
          focusEditor();
        }}
      >
        {children}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

const Divider = () => <div aria-hidden className="mx-1 h-4 w-px bg-border" />;

export function EditorToolbar({ run, focusEditor }: Props) {
  return (
    <TooltipProvider>
      <div
        role="toolbar"
        aria-label={frEditor.toolbar}
        className="flex flex-wrap items-center gap-0.5 border-b px-2 py-1"
      >
        <MenuButton label={frEditor.heading} icon={Heading} focusEditor={focusEditor}>
          {HEADING_LEVELS.map((level) => (
            <DropdownMenuItem key={level} onSelect={() => run(setHeading(level))}>
              {frEditor.headingLevel(level)}
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => run(setHeading(0))}>{frEditor.paragraph}</DropdownMenuItem>
        </MenuButton>
        <Divider />
        {INLINE.map((action) => (
          <ActionButton key={action.label} action={action} run={run} />
        ))}
        <Divider />
        {BLOCKS.map((action) => (
          <ActionButton key={action.label} action={action} run={run} />
        ))}
        <Divider />
        {INSERTS.map((action) => (
          <ActionButton key={action.label} action={action} run={run} />
        ))}
        <MenuButton label={frEditor.codeBlock} icon={SquareCode} focusEditor={focusEditor}>
          <DropdownMenuItem onSelect={() => run(insertCodeBlock(""))}>{frEditor.noLanguage}</DropdownMenuItem>
          <DropdownMenuSeparator />
          {frEditor.languages.map((language) => (
            <DropdownMenuItem
              key={language}
              className="font-mono text-xs"
              onSelect={() => run(insertCodeBlock(language))}
            >
              {language}
            </DropdownMenuItem>
          ))}
        </MenuButton>
      </div>
    </TooltipProvider>
  );
}
