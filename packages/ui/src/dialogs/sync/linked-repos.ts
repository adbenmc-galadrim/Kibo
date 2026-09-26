import type { ProjectSnapshot } from "@kibo/schema";
import { readSource } from "@kibo/sdk";
import { fr } from "../../i18n/fr";
import { findComponent } from "../../registry";

export type LinkedRepos = ReadonlyMap<string, string>;
type Scope = Pick<ProjectSnapshot, "bindings" | "pages" | "instances">;

export const repoKey = (repo: string) => repo.toLowerCase();

function holderName(scope: Scope, bindingId: string): string {
  const instance = scope.instances.find((i) => readSource(i.config)?.bindingId === bindingId);
  const page = scope.pages.find((p) => p.id === instance?.pageId);
  if (!instance || !page) return fr.integrations.rows["github-issues"].title;
  if (page.kind === "view") return page.title;
  const title = findComponent(instance.component)?.manifest.title ?? instance.component;
  return `${title} · ${page.title}`;
}

export function linkedRepos(scope: Scope): LinkedRepos {
  return new Map(scope.bindings.map((b) => [repoKey(b.config.repo), holderName(scope, b.id)]));
}
