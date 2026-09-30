import type { Screen } from "@kibo/schema";
import { cn } from "@kibo/sdk/lib/utils";
import {
  Cloud,
  FileText,
  Keyboard,
  type LucideIcon,
  Package,
  Palette,
  Plug,
  Shield,
  SlidersHorizontal,
} from "lucide-react";
import { fr } from "../i18n/fr";
import { targetToHash } from "../tabs/target-hash";

type SettingsScreen = Extract<
  Screen,
  "general" | "appearance" | "domains" | "integrations" | "sync" | "security" | "sources" | "shortcuts"
>;
type Item = { id: string; label: string; icon: LucideIcon; screen: SettingsScreen };

const ITEMS: Item[] = [
  { id: "general", label: fr.settings.general, icon: SlidersHorizontal, screen: "general" },
  { id: "appearance", label: fr.settings.appearance, icon: Palette, screen: "appearance" },
  { id: "domains", label: fr.settings.domains, icon: FileText, screen: "domains" },
  { id: "integrations", label: fr.settings.integrations, icon: Plug, screen: "integrations" },
  { id: "sync", label: fr.sync.section, icon: Cloud, screen: "sync" },
  { id: "security", label: fr.settings.security, icon: Shield, screen: "security" },
  { id: "components", label: fr.settings.components, icon: Package, screen: "sources" },
  { id: "shortcuts", label: fr.settings.shortcuts, icon: Keyboard, screen: "shortcuts" },
];

const ENTRY = "flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm";

function Entry({ item, active }: { item: Item; active: SettingsScreen }) {
  const { label, icon: Icon, screen } = item;
  const content = (
    <>
      <Icon aria-hidden className="size-4" />
      {label}
    </>
  );
  const current = screen === active;
  return (
    <a
      href={targetToHash({ kind: "screen", screen })}
      aria-current={current ? "page" : undefined}
      className={cn(ENTRY, "hover:bg-accent/60", current && "bg-accent font-medium hover:bg-accent")}
    >
      {content}
    </a>
  );
}

export function SettingsNav({ active }: { active: SettingsScreen }) {
  return (
    <nav aria-label={fr.settings.title} className="grid content-start gap-0.5 border-r p-3">
      <p className="px-2 pb-1 text-3xs font-medium uppercase tracking-wide text-muted-foreground">
        {fr.settings.workspace}
      </p>
      {ITEMS.map((item) => (
        <Entry key={item.id} item={item} active={active} />
      ))}
    </nav>
  );
}
