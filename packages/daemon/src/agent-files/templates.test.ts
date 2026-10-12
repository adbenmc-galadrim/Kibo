import { expect, test } from "bun:test";
import { AGENT_TEMPLATES } from "@kibo/schema";
import { AGENT_TEMPLATE_FILES } from "./templates";

test("every template but blank has a French body", () => {
  for (const template of AGENT_TEMPLATES.filter((t) => t !== "blank")) {
    const { body } = AGENT_TEMPLATE_FILES[template];
    expect(body.length).toBeGreaterThan(100);
    expect(body).toContain("## Workflow");
    expect(body).toMatch(/\b(tu|le|les|un|une)\b/i);
  }
  expect(AGENT_TEMPLATE_FILES.blank.body).toBe("");
});

test("the conductor calls delivery, review and SEO", () => {
  expect(AGENT_TEMPLATE_FILES.conductor.subagents).toEqual(["livraison", "review", "seo"]);
  expect(AGENT_TEMPLATE_FILES.conductor.body).toContain("`livraison`");
  expect(AGENT_TEMPLATE_FILES.delivery.subagents).toEqual([]);
});
