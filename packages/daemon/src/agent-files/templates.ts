import type { AgentTemplate } from "@kibo/schema";
import conductor from "../agents/templates/chef-orchestre.md" with { type: "text" };
import delivery from "../agents/templates/livraison.md" with { type: "text" };
import review from "../agents/templates/review.md" with { type: "text" };
import seo from "../agents/templates/seo.md" with { type: "text" };

export type AgentTemplateFile = { body: string; subagents: readonly string[] };
export type AgentTemplates = Record<AgentTemplate, AgentTemplateFile>;

export const CONDUCTOR_SUBAGENTS = ["livraison", "review", "seo"] as const;

export const AGENT_TEMPLATE_FILES: AgentTemplates = {
  blank: { body: "", subagents: [] },
  delivery: { body: delivery, subagents: [] },
  review: { body: review, subagents: [] },
  seo: { body: seo, subagents: [] },
  conductor: { body: conductor, subagents: CONDUCTOR_SUBAGENTS },
};
