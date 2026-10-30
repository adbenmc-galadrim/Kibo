import { describe, expect, test } from "bun:test";
import { Domain } from "@kibo/schema";
import fc from "fast-check";
import type { LoroDoc } from "loro-crdt";
import { listDomains } from "./agent-config";
import { applyDomainMove, type DomainUsageByProject, planDomainScopes } from "./domain-scope";
import { createProjectDoc } from "./project";
import { listProjectDomains } from "./project-domains";
import { createWorkspaceDoc } from "./workspace";

const PROJECTS = ["a", "b", "c"] as const;

const scenario = fc
  .uniqueArray(
    fc.record({
      n: fc.integer({ min: 0, max: 30 }),
      used: fc.dictionary(fc.constantFrom(...PROJECTS), fc.nat(3), { maxKeys: 4 }),
    }),
    { maxLength: 12, selector: (e) => e.n },
  )
  .map((entries) => ({
    domains: entries.map(({ n }) => Domain.parse({ id: `d${n}`, name: `D${n}`, color: "#14B8A6" })),
    usage: new Map<string, ReadonlyMap<string, number>>(
      entries.map(({ n, used }) => [`d${n}`, new Map(Object.entries(used))]),
    ),
  }));

const usersOf = (usage: DomainUsageByProject, domainId: string) =>
  [...(usage.get(domainId) ?? new Map<string, number>()).entries()].filter(([, n]) => n > 0).map(([p]) => p);

describe("planDomainScopes", () => {
  test("an empty workspace gives an empty plan", () => {
    expect(planDomainScopes([], new Map())).toEqual({ move: [], keep: [] });
  });

  test("every domain is planned once, a move targets the only user", () => {
    fc.assert(
      fc.property(scenario, ({ domains, usage }) => {
        const plan = planDomainScopes(domains, usage);
        const planned = [...plan.move, ...plan.keep].map((p) => p.domainId);
        expect(new Set(planned).size).toBe(planned.length);
        expect(planned.sort()).toEqual(domains.map((d) => d.id).sort());
        for (const move of plan.move) {
          expect(usersOf(usage, move.domainId)).toEqual([move.projectId]);
        }
      }),
    );
  });

  test("a plan applied then planned again moves nothing", () => {
    fc.assert(
      fc.property(scenario, ({ domains, usage }) => {
        const plan = planDomainScopes(domains, usage);
        const moved = new Map(plan.move.map((m) => [m.domainId, m.projectId]));
        const after = domains.map((d) => {
          const projectId = moved.get(d.id);
          return projectId ? Domain.parse({ ...d, owner: { scope: "project", projectId } }) : d;
        });
        expect(planDomainScopes(after, usage).move).toEqual([]);
      }),
    );
  });

  test("applied to real docs, every domain lives in exactly one doc", () => {
    fc.assert(
      fc.property(scenario, ({ domains, usage }) => {
        const ws = createWorkspaceDoc();
        for (const d of domains) ws.getMap("domains").set(d.id, d);
        ws.commit();
        const docs = new Map<string, LoroDoc>(
          PROJECTS.map((id) => [
            id,
            createProjectDoc({
              id,
              key: "KIB",
              name: id,
              folder: null,
              color: "#F97316",
              worktree: null,
              storybook: null,
              duplication: null,
              delivery: null,
              tracking: null,
              description: null,
              client: null,
            }),
          ]),
        );
        const apply = () => {
          const plan = planDomainScopes(listDomains(ws), usage);
          for (const m of plan.move) {
            const doc = docs.get(m.projectId);
            if (doc) applyDomainMove(ws, doc, m.projectId, m.domainId);
          }
        };
        apply();
        apply();
        const everywhere = [
          ...listDomains(ws).map((d) => d.id),
          ...[...docs.values()].flatMap((doc) => listProjectDomains(doc).map((d) => d.id)),
        ];
        expect(everywhere.sort()).toEqual(domains.map((d) => d.id).sort());
        expect(listProjectDomains(docs.get("ro") ?? ws)).toEqual([]);
      }),
      { numRuns: 40 },
    );
  });
});
