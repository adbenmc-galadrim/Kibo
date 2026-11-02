import { cn } from "@kibo/sdk/lib/utils";
import { Button } from "@kibo/sdk/ui/button";
import { Trash2 } from "lucide-react";
import { frAppearance as t } from "../i18n/fr-appearance";
import type { ThemeDef } from "./palette-presets";
import type { Roles } from "./palette-roles";
import { deleteTheme, selectTheme } from "./palette-state";
import { usePalette } from "./use-palette";

function Swatch({ roles }: { roles: Roles }) {
  return (
    <span
      aria-hidden
      className="flex h-16 w-full gap-1.5 overflow-hidden rounded-md border p-1.5"
      style={{ backgroundColor: roles.bg, borderColor: roles.border }}
    >
      <span className="flex w-1/4 flex-col gap-1 rounded-sm p-1" style={{ backgroundColor: roles.panel }}>
        <span className="h-1 rounded-full" style={{ backgroundColor: roles.fg }} />
        <span className="h-1 rounded-full" style={{ backgroundColor: roles.dim }} />
      </span>
      <span
        className="flex flex-1 flex-col gap-1 rounded-sm border p-1.5"
        style={{ backgroundColor: roles.card, borderColor: roles.border }}
      >
        <span className="h-1 w-3/4 rounded-full" style={{ backgroundColor: roles.fg }} />
        <span className="flex gap-1">
          {(["blue", "purple", "green", "accent", "agent"] as const).map((role) => (
            <span key={role} className="size-2 rounded-full" style={{ backgroundColor: roles[role] }} />
          ))}
        </span>
      </span>
    </span>
  );
}

function ThemeCard({ theme, selected, modified }: { theme: ThemeDef; selected: boolean; modified: boolean }) {
  const { palette, scheme, commit } = usePalette();
  return (
    <div className="relative">
      <button
        type="button"
        aria-pressed={selected}
        onClick={() => commit(selectTheme(palette, scheme, theme.id))}
        className={cn(
          "flex w-full flex-col gap-1.5 rounded-lg border p-1.5 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring",
          selected ? "border-foreground" : "border-transparent hover:border-border",
        )}
      >
        <Swatch roles={{ ...theme.roles, ...palette.drafts[theme.id] }} />
        <span className="flex items-center gap-1.5 px-0.5 text-xs font-medium">
          <span className="truncate">{theme.name}</span>
          {theme.custom && <span className="text-muted-foreground">{t.ownBadge}</span>}
          {modified && <span className="text-muted-foreground">{t.modifiedBadge}</span>}
        </span>
      </button>
      {theme.custom && (
        <Button
          variant="ghost"
          size="icon"
          aria-label={t.deleteTheme(theme.name)}
          className="absolute right-0.5 bottom-0 size-6"
          onClick={() => commit(deleteTheme(palette, theme.id))}
        >
          <Trash2 className="size-3" aria-hidden />
        </Button>
      )}
    </div>
  );
}

export function ThemeGallery() {
  const { themes, active } = usePalette();
  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-2">
      {themes.map((theme) => {
        const selected = theme.id === active.theme.id;
        return (
          <ThemeCard
            key={theme.id}
            theme={theme}
            selected={selected}
            modified={selected && active.modified}
          />
        );
      })}
    </div>
  );
}
