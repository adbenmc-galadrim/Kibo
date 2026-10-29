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
};

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
  }));
}

export const matches = (text: string, query: string): boolean =>
  text.toLowerCase().includes(query.trim().toLowerCase());
