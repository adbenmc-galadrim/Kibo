import { KiboError, type RunMoment, type RunMomentsPage } from "@kibo/schema";
import { useEffect, useState } from "react";
import { client } from "../../api";
import { mergeMoments } from "../../moments/use-run-moments";

export type RunsMoments = { pages: ReadonlyMap<string, RunMomentsPage>; error: KiboError | null };

const asKiboError = (e: unknown): KiboError =>
  e instanceof KiboError ? e : new KiboError("INTERNAL", String(e));

function withMoments(page: RunMomentsPage, moments: readonly RunMoment[]): RunMomentsPage {
  return moments.length === 0 ? page : { ...page, moments: mergeMoments(page.moments, moments) };
}

export function useRunsMoments(runIds: readonly string[]): RunsMoments {
  const key = runIds.join("\n");
  const [state, setState] = useState<RunsMoments>({ pages: new Map(), error: null });
  useEffect(() => {
    const ids = key === "" ? [] : key.split("\n");
    if (ids.length === 0) return;
    let alive = true;
    const wanted = new Set(ids);
    const early = new Map<string, RunMoment[]>();
    const off = client.subscribeMoments((event) => {
      if (!wanted.has(event.runId)) return;
      early.set(event.runId, mergeMoments(early.get(event.runId) ?? [], event.moments));
      setState((s) => {
        const page = s.pages.get(event.runId);
        if (!page) return s;
        return { ...s, pages: new Map(s.pages).set(event.runId, withMoments(page, event.moments)) };
      });
    });
    Promise.all(ids.map((runId) => client.rpc({ method: "runMoments", runId }))).then(
      (loaded) => {
        if (!alive) return;
        setState((s) => {
          const pages = new Map(s.pages);
          loaded.forEach((page, i) => {
            const runId = ids[i];
            if (page && runId) pages.set(runId, withMoments(page, early.get(runId) ?? []));
          });
          return { pages, error: null };
        });
      },
      (e: unknown) => {
        if (alive) setState((s) => ({ ...s, error: asKiboError(e) }));
      },
    );
    return () => {
      alive = false;
      off();
    };
  }, [key]);
  return state;
}
