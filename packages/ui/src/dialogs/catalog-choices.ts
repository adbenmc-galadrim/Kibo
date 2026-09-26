import type { ComponentSummary, ComponentVersionSummary } from "@kibo/schema";
import type { ComponentModule } from "@kibo/sdk";
import { fr } from "../i18n/fr";
import { componentRef } from "../registry";

export type Choice = {
  ref: string;
  id: string;
  title: string;
  description: string | undefined;
  version: string;
  reads: readonly string[];
  line: string;
  pending: ComponentVersionSummary | null;
};

const HOSTS: Record<string, string> = {
  "api.github.com": "GitHub",
  "gitlab.com": "GitLab",
  "linear.app": "Linear",
};

export function hostLabel(rule: string): string {
  const host = rule.split("/")[0] ?? rule;
  return HOSTS[host] ?? host;
}

export function builtinChoices(modules: ComponentModule[]): Choice[] {
  return modules.map(({ manifest: m }) => ({
    ref: componentRef(m),
    id: m.id,
    title: m.title,
    description: m.description,
    version: m.version,
    reads: m.reads,
    line: fr.addComponent.builtinTrust(m.reads, m.writes),
    pending: null,
  }));
}

function latestUsable(c: ComponentSummary): ComponentVersionSummary | null {
  return [...c.versions].reverse().find((v) => v.manifest !== null && !v.tampered) ?? null;
}

export function mineChoices(components: ComponentSummary[]): Choice[] {
  return components
    .filter((c) => !c.builtin)
    .flatMap((c) => {
      const v = latestUsable(c);
      if (!v?.manifest || v.manifest.kind === "adapter") return [];
      const trust = v.active && v.trust ? fr.components.trust[v.trust] : fr.addComponent.pendingTrust;
      const hosts = v.manifest.net.map(hostLabel);
      return [
        {
          ref: `${c.id}@${v.version}`,
          id: c.id,
          title: c.title,
          description: v.manifest.description,
          version: v.version,
          reads: v.manifest.reads,
          line: fr.addComponent.mineLine(fr.components.origin[v.origin], trust.toLowerCase(), hosts),
          pending: v.active ? null : v,
        },
      ];
    });
}

export const matches = (text: string, query: string): boolean =>
  text.toLowerCase().includes(query.trim().toLowerCase());
