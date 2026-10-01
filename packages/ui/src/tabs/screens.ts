import type { Screen } from "@kibo/schema";
import {
  Bot,
  Building2,
  Cloud,
  Inbox,
  Keyboard,
  List,
  ListOrdered,
  type LucideIcon,
  Package,
  Palette,
  Plug,
  Puzzle,
  Settings,
  Shield,
  SlidersHorizontal,
  Sparkles,
} from "lucide-react";
import { fr } from "../i18n/fr";

type ScreenInfo = { title: string; icon: LucideIcon; crumbs: string[]; parent?: Screen };

export const SCREENS: Record<Screen, ScreenInfo> = {
  agents: { title: fr.nav.agents, icon: Bot, crumbs: [fr.nav.agents] },
  queue: { title: fr.nav.queue, icon: ListOrdered, crumbs: [fr.nav.agents, fr.nav.queue] },
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
  security: { title: fr.settings.security, icon: Shield, crumbs: [fr.nav.settings, fr.settings.security] },
  sources: {
    title: fr.marketSources.title,
    icon: Package,
    crumbs: [fr.nav.settings, fr.marketSources.title],
  },
  sync: { title: fr.sync.title, icon: Cloud, crumbs: [fr.nav.settings, fr.sync.title] },
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
  creations: {
    title: fr.nav.creations,
    icon: Sparkles,
    crumbs: [fr.nav.components, fr.nav.creations],
    parent: "components",
  },
};
