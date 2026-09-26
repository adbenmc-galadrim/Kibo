import type { Binding } from "@kibo/schema";
import { useCallback, useEffect, useState } from "react";
import { client } from "../../api";
import { fr } from "../../i18n/fr";
import { failureOf, syncErrorText } from "../../lib/sync-error-text";

export type SyncProgress = { imported: number; running: boolean };
export type FirstSync = {
  binding: Binding | null;
  progress: SyncProgress | null;
  error: string | null;
  start(b: Binding): void;
  retry(): Promise<void>;
};

const failedText = (text: string) => `${fr.integrations.source.failed} ${text}`;

function useBindingProgress(projectId: string, bindingId: string | null) {
  const [progress, setProgress] = useState<SyncProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    setProgress(null);
    if (bindingId === null) return;
    let heard = false;
    let live = true;
    const off = client.subscribeIntegrations((e) => {
      if (e.type !== "sync" || e.bindingId !== bindingId) return;
      heard = true;
      setProgress({ imported: e.imported, running: e.running });
    });
    client.rpc({ method: "getSyncState", projectId }).then(
      (s) => {
        const b = s.bindings.find((x) => x.bindingId === bindingId);
        if (live && !heard && b) setProgress({ imported: b.imported, running: b.running });
      },
      (e: unknown) => {
        if (live) setError(syncErrorText(failureOf(e), { repo: "", resumeAt: null }));
      },
    );
    return () => {
      live = false;
      off();
    };
  }, [projectId, bindingId]);
  return { progress, setProgress, error };
}

export function useFirstSync(projectId: string, onSynced: () => void): FirstSync {
  const [binding, setBinding] = useState<Binding | null>(null);
  const [manual, setManual] = useState(false);
  const [outcome, setOutcome] = useState<string | null>(null);
  const { progress, setProgress, error } = useBindingProgress(projectId, binding?.id ?? null);

  const settle = useCallback(
    async (b: Binding, thrown: unknown) => {
      try {
        const s = await client.rpc({ method: "getSyncState", projectId });
        const state = s.bindings.find((x) => x.bindingId === b.id);
        const failure = state?.lastError ?? (thrown === null ? null : failureOf(thrown));
        if (failure === null) return onSynced();
        const ctx = { repo: b.config.repo, resumeAt: state?.resumeAt ?? null };
        setOutcome(failedText(syncErrorText(failure, ctx)));
      } catch (e) {
        setOutcome(syncErrorText(failureOf(e), { repo: b.config.repo, resumeAt: null }));
      }
    },
    [projectId, onSynced],
  );

  const ended = progress !== null && !progress.running;
  useEffect(() => {
    if (binding && ended && !manual) void settle(binding, null);
  }, [binding, ended, manual, settle]);

  const retry = async () => {
    if (!binding) return;
    setManual(true);
    setOutcome(null);
    setProgress((p) => ({ imported: p?.imported ?? 0, running: true }));
    let thrown: unknown = null;
    try {
      await client.rpc({ method: "syncBinding", projectId, bindingId: binding.id });
    } catch (e) {
      thrown = e;
    }
    setProgress((p) => ({ imported: p?.imported ?? 0, running: false }));
    await settle(binding, thrown);
  };

  return { binding, progress, error: outcome ?? error, start: setBinding, retry };
}
