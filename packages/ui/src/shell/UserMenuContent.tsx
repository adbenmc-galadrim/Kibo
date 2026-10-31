import type { TabTarget } from "@kibo/schema";
import {
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from "@kibo/sdk/ui/dropdown-menu";
import { Bug, CircleHelp, Info, Keyboard, type LucideIcon, Settings, Sparkles, SunMoon } from "lucide-react";
import { fr } from "../i18n/fr";
import { frAppearance } from "../i18n/fr-appearance";
import { isMac, shortcutLabel } from "../lib/shortcut-label";
import { setThemePreference, THEME_PREFERENCES, type ThemePreference, useThemePreference } from "../theme";
import { HELP_DIALOGS, type HelpDialog } from "./help-dialogs";
import { helpLabel } from "./help-labels";

type Props = { viewer: string; onOpen(target: TabTarget): void; onHelp(key: HelpDialog): void };
const HELP_ICONS: Record<HelpDialog, LucideIcon> = {
  shortcutsHelp: Keyboard,
  whatsNew: Sparkles,
  report: Bug,
  about: Info,
};
const isPreference = (v: string): v is ThemePreference => THEME_PREFERENCES.some((p) => p === v);

function HelpSubmenu({ onHelp }: Pick<Props, "onHelp">) {
  return (
    <DropdownMenuSub>
      <DropdownMenuSubTrigger>
        <CircleHelp aria-hidden />
        {fr.header.help}
      </DropdownMenuSubTrigger>
      <DropdownMenuSubContent className="w-56">
        {HELP_DIALOGS.map((key) => {
          const Icon = HELP_ICONS[key];
          return (
            <DropdownMenuItem key={key} onSelect={() => onHelp(key)}>
              <Icon aria-hidden />
              {helpLabel(key)}
              {key === "shortcutsHelp" && (
                <DropdownMenuShortcut>{shortcutLabel(["/"], isMac())}</DropdownMenuShortcut>
              )}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuSubContent>
    </DropdownMenuSub>
  );
}

export function UserMenuContent({ viewer, onOpen, onHelp }: Props) {
  const preference = useThemePreference();
  return (
    <>
      <DropdownMenuLabel>{viewer}</DropdownMenuLabel>
      <DropdownMenuSeparator />
      <DropdownMenuSub>
        <DropdownMenuSubTrigger>
          <SunMoon aria-hidden />
          {fr.header.theme}
        </DropdownMenuSubTrigger>
        <DropdownMenuSubContent>
          <DropdownMenuRadioGroup
            value={preference}
            onValueChange={(v) => {
              if (isPreference(v)) setThemePreference(v);
            }}
          >
            {THEME_PREFERENCES.map((p) => (
              <DropdownMenuRadioItem key={p} value={p}>
                {frAppearance[p]}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuSubContent>
      </DropdownMenuSub>
      <DropdownMenuSeparator />
      <DropdownMenuItem onSelect={() => onOpen({ kind: "screen", screen: "general" })}>
        <Settings aria-hidden />
        {fr.header.settings}
      </DropdownMenuItem>
      <DropdownMenuSeparator />
      <HelpSubmenu onHelp={onHelp} />
    </>
  );
}
