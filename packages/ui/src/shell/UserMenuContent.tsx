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
import {
  Bug,
  CircleHelp,
  GraduationCap,
  Info,
  Keyboard,
  type LucideIcon,
  Settings,
  Shield,
  Sparkles,
  SunMoon,
} from "lucide-react";
import { fr } from "../i18n/fr";
import { isMac, shortcutLabel } from "../lib/shortcut-label";
import { useSyncServerStatus } from "../state/use-sync-server";
import { setThemePreference, THEME_PREFERENCES, type ThemePreference, useThemePreference } from "../theme";
import { HELP_DIALOGS, type HelpDialog } from "./help-dialogs";
import { helpLabel } from "./help-labels";

type Props = { viewer: string; onOpen(target: TabTarget): void; onHelp(key: HelpDialog): void };
const HELP_ICONS: Record<HelpDialog, LucideIcon> = {
  shortcutsHelp: Keyboard,
  tutorial: GraduationCap,
  whatsNew: Sparkles,
  report: Bug,
  about: Info,
};
const isPreference = (v: string): v is ThemePreference => THEME_PREFERENCES.some((p) => p === v);
const hostOf = (url: string): string => {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
};

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
  const { status } = useSyncServerStatus();
  const account =
    status?.user && status.serverUrl ? fr.header.account(status.user.name, hostOf(status.serverUrl)) : null;
  return (
    <>
      <DropdownMenuLabel className="grid gap-0.5">
        <span>{viewer}</span>
        {account && <span className="text-xs font-normal text-muted-foreground">{account}</span>}
      </DropdownMenuLabel>
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
                {fr.security.appearance[p]}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuSubContent>
      </DropdownMenuSub>
      <DropdownMenuSeparator />
      <DropdownMenuItem onSelect={() => onOpen({ kind: "screen", screen: "security" })}>
        <Shield aria-hidden />
        {fr.header.sessions}
      </DropdownMenuItem>
      <DropdownMenuItem onSelect={() => onOpen({ kind: "screen", screen: "general" })}>
        <Settings aria-hidden />
        {fr.header.settings}
      </DropdownMenuItem>
      <DropdownMenuSeparator />
      <HelpSubmenu onHelp={onHelp} />
    </>
  );
}
