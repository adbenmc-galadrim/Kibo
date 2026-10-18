import type { ComponentSummary, ComponentVersionSummary } from "@kibo/schema";
import type { ComponentModule } from "@kibo/sdk";
import { frComponentsManage } from "../i18n/fr-components-manage";
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

const NOT_FOR_TRACKING = new Set(["mcp-source", "viewer-3d"]);

export const offeredBuiltins = (modules: ComponentModule[]): ComponentModule[] =>
  modules.filter(({ manifest }) => !NOT_FOR_TRACKING.has(manifest.id));

export function builtinChoices(modules: ComponentModule[]): Choice[] {
  return modules.map(({ manifest: m }) => ({
    ref: componentRef(m),
    id: m.id,
    title: m.title,
    description: m.description,
    version: m.version,
    reads: m.reads,
    line: frComponentsManage.addComponent.builtinTrust(
      m.reads.map(frComponentsManage.trust.entityName),
      m.writes.map(frComponentsManage.trust.entityName),
    ),
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
      const trust =
        v.active && v.trust
          ? frComponentsManage.components.trust[v.trust]
          : frComponentsManage.addComponent.pendingTrust;
      const hosts = v.manifest.net.map(hostLabel);
      return [
        {
          ref: `${c.id}@${v.version}`,
          id: c.id,
          title: c.title,
          description: v.manifest.description,
          version: v.version,
          reads: v.manifest.reads,
          line: frComponentsManage.addComponent.mineLine(
            frComponentsManage.components.origin[v.origin],
            trust.toLowerCase(),
            hosts,
          ),
          pending: v.active ? null : v,
        },
      ];
    });
}

export const matches = (text: string, query: string): boolean =>
  text.toLowerCase().includes(query.trim().toLowerCase());
