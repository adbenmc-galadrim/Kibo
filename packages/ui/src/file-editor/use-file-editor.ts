import { KiboError, type SaveConflict, type SaveResult, type Topic } from "@kibo/schema";
import { useCallback, useEffect, useRef, useState } from "react";
import { client } from "../api";

export type FileEditorInput = {
  read(): Promise<{ content: string; hash: string }>;
  save(content: string, baseHash: string | null): Promise<SaveResult<{ hash: string }>>;
  topic: Topic;
  externalHash?: string | null;
};

export type FileEditor = {
  ready: boolean;
  error: unknown;
  revision: number;
  content: string;
  setContent(content: string): void;
  dirty: boolean;
  baseHash: string | null;
  draft: string | null;
  conflict: SaveConflict | null;
  changedOnDisk: boolean;
  missing: boolean;
  saving: boolean;
  save(): Promise<boolean>;
  reload(): Promise<void>;
  overwrite(): Promise<boolean>;
  recreate(): Promise<boolean>;
  dismissConflict(): void;
};

const isMissing = (e: unknown) => e instanceof KiboError && e.code === "NOT_FOUND";

export function useFileEditor(input: FileEditorInput): FileEditor {
  const source = useRef(input);
  source.current = input;
  const [content, setContentState] = useState("");
  const latest = useRef("");
  const [saved, setSaved] = useState("");
  const [baseHash, setBaseHash] = useState<string | null>(null);
  const [diskHash, setDiskHash] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [revision, setRevision] = useState(0);
  const [draft, setDraft] = useState<string | null>(null);
  const [conflict, setConflict] = useState<SaveConflict | null>(null);
  const [missing, setMissing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<unknown>(null);

  const setContent = useCallback((next: string) => {
    latest.current = next;
    setContentState(next);
  }, []);

  const load = useCallback(async () => {
    const disk = await source.current.read();
    latest.current = disk.content;
    setContentState(disk.content);
    setSaved(disk.content);
    setBaseHash(disk.hash);
    setDiskHash(disk.hash);
    setConflict(null);
    setMissing(false);
    setError(null);
    setReady(true);
    setRevision((n) => n + 1);
  }, []);

  useEffect(() => {
    load().catch((e: unknown) => {
      setError(e);
      setReady(true);
    });
  }, [load]);

  const tracksDisk = input.externalHash === undefined;
  useEffect(() => {
    if (!tracksDisk) return;
    return client.subscribeTopic(source.current.topic, () => {
      source.current.read().then(
        (disk) => setDiskHash(disk.hash),
        (e: unknown) => setError(e),
      );
    });
  }, [tracksDisk]);

  const write = useCallback(async (base: string | null): Promise<boolean> => {
    const text = latest.current;
    setSaving(true);
    try {
      const result = await source.current.save(text, base);
      if (!result.ok) {
        setConflict(result.conflict);
        return false;
      }
      setSaved(text);
      setBaseHash(result.value.hash);
      setDiskHash(result.value.hash);
      setConflict(null);
      setMissing(false);
      setError(null);
      return true;
    } catch (e) {
      if (isMissing(e)) setMissing(true);
      else setError(e);
      return false;
    } finally {
      setSaving(false);
    }
  }, []);

  const reload = useCallback(async () => {
    const mine = latest.current;
    const kept = mine !== saved || conflict !== null ? mine : null;
    try {
      await load();
      setDraft(kept);
    } catch (e) {
      setError(e);
    }
  }, [load, saved, conflict]);

  const external = input.externalHash === undefined ? diskHash : input.externalHash;
  return {
    ready,
    error,
    revision,
    content,
    setContent,
    dirty: content !== saved,
    baseHash,
    draft,
    conflict,
    changedOnDisk: conflict === null && external != null && baseHash !== null && external !== baseHash,
    missing,
    saving,
    save: () => write(baseHash),
    reload,
    overwrite: () => (conflict ? write(conflict.hash) : write(baseHash)),
    recreate: () => write(null),
    dismissConflict: () => setConflict(null),
  };
}
