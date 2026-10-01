import type { TabTarget } from "@kibo/schema";
import {
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from "@kibo/sdk/ui/dropdown-menu";
import { Settings, Shield, SunMoon } from "lucide-react";
import { fr } from "../i18n/fr";
import { useSyncServerStatus } from "../state/use-sync-server";
import { setThemePreference, THEME_PREFERENCES, type ThemePreference, useThemePreference } from "../theme";

type Props = { viewer: string; onOpen(target: TabTarget): void };
const isPreference = (v: string): v is ThemePreference => THEME_PREFERENCES.some((p) => p === v);
const hostOf = (url: string): string => {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
};

export function UserMenuContent({ viewer, onOpen }: Props) {
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
    </>
  );
}
