import { type Layout, Page, type StarterPage } from "@kibo/schema";
import type { KiboClient } from "@kibo/sdk";
import { nextLayout } from "../lib/next-layout";

export type ApplyFailure = { title: string; message: string };

export async function applyStarterPlan(
  client: Pick<KiboClient, "rpc">,
  projectId: string,
  pages: StarterPage[],
  refs: ReadonlyMap<string, string>,
): Promise<ApplyFailure[]> {
  const failures: ApplyFailure[] = [];
  for (const page of pages) {
    try {
      const created = Page.parse(
        await client.rpc({
          method: "command",
          projectId,
          command: { method: "addPage", title: page.title, kind: page.kind },
        }),
      );
      const taken: Layout[] = [];
      for (const c of page.components) {
        const ref = refs.get(c.id);
        if (!ref) continue;
        const layout = page.kind === "dashboard" ? nextLayout(taken) : null;
        if (layout) taken.push(layout);
        await client.rpc({
          method: "command",
          projectId,
          command: {
            method: "addInstance",
            pageId: created.id,
            component: ref,
            config: c.config,
            ...(layout ? { layout } : {}),
          },
        });
      }
    } catch (e) {
      failures.push({ title: page.title, message: e instanceof Error ? e.message : String(e) });
    }
  }
  return failures;
}
