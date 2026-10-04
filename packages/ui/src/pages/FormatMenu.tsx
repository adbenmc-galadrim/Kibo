import { type ComponentFormat, FORMAT_SIZES, ComponentFormat as FormatSchema } from "@kibo/schema";
import { Button } from "@kibo/sdk/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@kibo/sdk/ui/dropdown-menu";
import { ChevronDown } from "lucide-react";
import { frLayout } from "../i18n/fr-layout";

export type FormatMenuProps = {
  title: string;
  current: ComponentFormat;
  formats: readonly ComponentFormat[];
  onPick(format: ComponentFormat): void;
};

export function FormatMenu({ title, current, formats, onPick }: FormatMenuProps) {
  const pick = (value: string) => {
    const parsed = FormatSchema.safeParse(value);
    if (parsed.success && parsed.data !== current) onPick(parsed.data);
  };
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 shrink-0 px-2 text-xs"
          aria-label={frLayout.format(title)}
        >
          {frLayout.current(frLayout.formats[current])}
          <ChevronDown aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
          {frLayout.shortcuts}
        </DropdownMenuLabel>
        <DropdownMenuRadioGroup value={current} onValueChange={pick}>
          {formats.map((f) => (
            <DropdownMenuRadioItem key={f} value={f}>
              {frLayout.formats[f]} · {frLayout.size(FORMAT_SIZES[f].w, FORMAT_SIZES[f].h)}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
        <DropdownMenuSeparator />
        <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
          {frLayout.help}
        </DropdownMenuLabel>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
