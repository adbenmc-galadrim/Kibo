import type { Screen } from "@kibo/schema";
import { Bot, ListOrdered, type LucideIcon, Settings } from "lucide-react";
import { fr } from "../i18n/fr";

type ScreenInfo = { title: string; icon: LucideIcon; crumbs: string[] };

export const SCREENS: Record<Screen, ScreenInfo> = {
  agents: { title: fr.nav.agents, icon: Bot, crumbs: [fr.nav.agents] },
  queue: { title: fr.nav.queue, icon: ListOrdered, crumbs: [fr.nav.agents, fr.nav.queue] },
  domains: { title: fr.nav.domains, icon: Settings, crumbs: [fr.nav.settings, fr.nav.domains] },
};
