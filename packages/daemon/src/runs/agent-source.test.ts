import { expect, test } from "bun:test";
import { catalogAgentSource, lateAgentSource } from "./agent-source";
import { memoryAgent, NEUTRAL_SYSTEM_AGENTS } from "./neutral-agents";

const livraison = memoryAgent({ ref: "global:livraison", scope: "global", name: "livraison" });

test("the daemon source serves the neutral agents until the catalog is bound, and again once unbound", () => {
  const late = lateAgentSource();
  expect(late.source.agents(null)).toEqual([...NEUTRAL_SYSTEM_AGENTS]);
  const unbind = late.bind(
    catalogAgentSource(
      { list: () => [livraison], byRef: (ref) => (ref === livraison.ref ? livraison : null) },
      { list: () => ({ skills: [], partialWatch: false }) },
    ),
  );
  expect(late.source.agents("p1")).toEqual([livraison]);
  expect(late.source.agentOf("global:livraison")).toBe(livraison);
  expect(late.source.skills?.("p1")).toEqual([]);
  unbind();
  expect(late.source.agentOf("global:livraison")).toBeNull();
});
