import type { Screen } from "@kibo/schema";
import { Bot, List, ListOrdered, type LucideIcon, Puzzle, Settings, SlidersHorizontal } from "lucide-react";
import { fr } from "../i18n/fr";

type ScreenInfo = { title: string; icon: LucideIcon; crumbs: string[] };

export const SCREENS: Record<Screen, ScreenInfo> = {
  agents: { title: fr.nav.agents, icon: Bot, crumbs: [fr.nav.agents] },
  queue: { title: fr.nav.queue, icon: ListOrdered, crumbs: [fr.nav.agents, fr.nav.queue] },
  general: { title: fr.nav.general, icon: SlidersHorizontal, crumbs: [fr.nav.settings, fr.nav.general] },
  domains: { title: fr.nav.domains, icon: Settings, crumbs: [fr.nav.settings, fr.nav.domains] },
  components: { title: fr.nav.components, icon: Puzzle, crumbs: [fr.nav.components] },
  mine: { title: fr.nav.mine, icon: List, crumbs: [fr.nav.mine] },
};
