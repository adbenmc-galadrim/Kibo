import type { Screen } from "@kibo/schema";
import {
  Building2,
  Inbox,
  Keyboard,
  List,
  type LucideIcon,
  Package,
  Palette,
  Plug,
  Puzzle,
  Settings,
  SlidersHorizontal,
} from "lucide-react";
import { fr } from "../i18n/fr";

type ScreenInfo = { title: string; icon: LucideIcon; crumbs: string[]; parent?: Screen };

export const SCREENS: Record<Screen, ScreenInfo> = {
  general: { title: fr.nav.general, icon: SlidersHorizontal, crumbs: [fr.nav.settings, fr.nav.general] },
  domains: { title: fr.nav.domains, icon: Settings, crumbs: [fr.nav.settings, fr.nav.domains] },
  components: { title: fr.nav.components, icon: Puzzle, crumbs: [fr.nav.components] },
  mine: { title: fr.nav.mine, icon: List, crumbs: [fr.nav.mine] },
  inbox: { title: fr.nav.inbox, icon: Inbox, crumbs: [fr.nav.inbox] },
  integrations: {
    title: fr.settings.integrations,
    icon: Plug,
    crumbs: [fr.nav.settings, fr.settings.integrations],
  },
  appearance: {
    title: fr.settings.appearance,
    icon: Palette,
    crumbs: [fr.nav.settings, fr.settings.appearance],
  },
  sources: {
    title: fr.marketSources.title,
    icon: Package,
    crumbs: [fr.nav.settings, fr.marketSources.title],
  },
  shortcuts: {
    title: fr.settings.shortcuts,
    icon: Keyboard,
    crumbs: [fr.nav.settings, fr.settings.shortcuts],
  },
  workspace: {
    title: fr.settings.workspace,
    icon: Building2,
    crumbs: [fr.nav.settings, fr.settings.workspace],
  },
};
