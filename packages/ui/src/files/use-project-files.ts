import {
  type FilesInfo,
  KiboError,
  MAX_PROJECT_ASSET_BYTES,
  mimeOfName,
  type ProjectAsset,
  type ProjectAssetMime,
} from "@kibo/schema";
import { useCallback, useEffect, useRef, useState } from "react";
import { client } from "../api";
import { frFiles as t } from "../i18n/fr-files";
import { slugName } from "./slug";
import { uploadFile } from "./upload";

export type Sending = { key: number; name: string; ratio: number };
type Prepared = { ok: true; name: string; mime: ProjectAssetMime } | { ok: false; problem: string };

function prepare(file: File): Prepared {
  const name = slugName(file.name);
  const mime = name === null ? null : mimeOfName(name);
  if (name === null || mime === null)
    return { ok: false, problem: t.problem(file.name, t.unsupported(file.name)) };
  if (file.size === 0) return { ok: false, problem: t.problem(name, t.emptyFile) };
  if (file.size > MAX_PROJECT_ASSET_BYTES) return { ok: false, problem: t.problem(name, t.tooLarge) };
  return { ok: true, name, mime };
}

function sendFailure(name: string, e: unknown): string {
  if (!(e instanceof KiboError)) console.error(e);
  return t.problem(name, t.error(e instanceof KiboError ? e.code : null));
}

export function useProjectFiles(projectId: string) {
  const [assets, setAssets] = useState<ProjectAsset[] | null>(null);
  const [info, setInfo] = useState<FilesInfo | null>(null);
  const [failed, setFailed] = useState(false);
  const live = useRef(true);
  const reload = useCallback(async () => {
    const [list, dir] = await Promise.allSettled([
      client.rpc({ method: "listAssets", projectId }),
      client.rpc({ method: "getFilesDir", projectId }),
    ]);
    if (!live.current) return;
    if (list.status === "fulfilled") setAssets(list.value);
    else console.error(list.reason);
    if (dir.status === "fulfilled") setInfo(dir.value);
    else console.error(dir.reason);
    setFailed(list.status === "rejected");
  }, [projectId]);
  useEffect(() => {
    live.current = true;
    void reload();
    return () => {
      live.current = false;
    };
  }, [reload]);
  return { assets, info, failed, reload };
}

export function useImport(projectId: string, onSent: () => Promise<void>) {
  const [sending, setSending] = useState<Sending[]>([]);
  const [problems, setProblems] = useState<string[]>([]);
  const abort = useRef(new AbortController());
  const keys = useRef(0);
  useEffect(() => {
    const controller = new AbortController();
    abort.current = controller;
    return () => controller.abort();
  }, []);
  const send = async (name: string, mime: ProjectAssetMime, file: File) => {
    const key = ++keys.current;
    const progress = (ratio: number) =>
      setSending((list) => list.map((s) => (s.key === key ? { ...s, ratio } : s)));
    setSending((list) => [...list, { key, name, ratio: 0 }]);
    try {
      await uploadFile(client, projectId, name, mime, file, progress, abort.current.signal);
      return null;
    } catch (e) {
      return abort.current.signal.aborted ? null : sendFailure(name, e);
    } finally {
      setSending((list) => list.filter((s) => s.key !== key));
    }
  };
  const importFiles = async (files: File[]) => {
    if (files.length === 0) return;
    setProblems([]);
    let sent = false;
    for (const file of files) {
      const prepared = prepare(file);
      sent ||= prepared.ok;
      const problem = prepared.ok ? await send(prepared.name, prepared.mime, file) : prepared.problem;
      if (abort.current.signal.aborted) return;
      if (problem) setProblems((list) => [...list, problem]);
    }
    if (sent) await onSent();
  };
  return { sending, problems, importFiles };
}
