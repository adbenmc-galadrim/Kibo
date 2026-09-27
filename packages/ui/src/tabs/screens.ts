import type { Screen } from "@kibo/schema";
import {
  Bot,
  Cloud,
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
} from "lucide-react";
import { fr } from "../i18n/fr";

type ScreenInfo = { title: string; icon: LucideIcon; crumbs: string[] };

export const SCREENS: Record<Screen, ScreenInfo> = {
  agents: { title: fr.nav.agents, icon: Bot, crumbs: [fr.nav.agents] },
  queue: { title: fr.nav.queue, icon: ListOrdered, crumbs: [fr.nav.agents, fr.nav.queue] },
  general: { title: fr.nav.general, icon: SlidersHorizontal, crumbs: [fr.nav.settings, fr.nav.general] },
  domains: { title: fr.nav.domains, icon: Settings, crumbs: [fr.nav.settings, fr.nav.domains] },
  components: { title: fr.nav.components, icon: Puzzle, crumbs: [fr.nav.components] },
  mine: { title: fr.nav.mine, icon: List, crumbs: [fr.nav.mine] },
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
    crumbs: [fr.nav.settings, fr.marketSources.crumb],
  },
  sync: { title: fr.sync.title, icon: Cloud, crumbs: [fr.nav.settings, fr.sync.title] },
};
