import { cn } from "@kibo/sdk/lib/utils";
import { FileText, Keyboard, Palette, Plug, Shield, SlidersHorizontal } from "lucide-react";
import { fr } from "../i18n/fr";

const ITEMS = [
  { id: "general", label: fr.settings.general, icon: SlidersHorizontal },
  { id: "appearance", label: fr.settings.appearance, icon: Palette },
  { id: "domains", label: fr.settings.domains, icon: FileText },
  { id: "integrations", label: fr.settings.integrations, icon: Plug },
  { id: "security", label: fr.settings.security, icon: Shield },
  { id: "shortcuts", label: fr.settings.shortcuts, icon: Keyboard },
] as const;

export function SettingsNav({ active }: { active: "domains" }) {
  return (
    <nav aria-label={fr.settings.title} className="grid content-start gap-0.5 border-r p-3">
      <p className="px-2 pb-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {fr.settings.workspace}
      </p>
      {ITEMS.map(({ id, label, icon: Icon }) => {
        const current = id === active;
        return (
          <button
            key={id}
            type="button"
            disabled={!current}
            title={current ? undefined : fr.settings.soon}
            aria-current={current ? "page" : undefined}
            className={cn(
              "flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm disabled:opacity-60",
              current && "bg-accent font-medium",
            )}
          >
            <Icon aria-hidden className="size-4" />
            {label}
          </button>
        );
      })}
    </nav>
  );
}
