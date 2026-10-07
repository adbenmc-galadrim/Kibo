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
import { raise } from "./smooth-progress";
import { uploadFile } from "./upload";

export type Sending = {
  key: number;
  name: string;
  ratio: number;
  done: boolean;
  shown: boolean;
  settled: boolean;
};
const queued = (key: number, name: string): Sending => ({
  key,
  name,
  ratio: 0,
  done: false,
  shown: false,
  settled: false,
});
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

const changed = (list: Sending[], keep: (s: Sending) => boolean, edit: (s: Sending) => Sending) =>
  list.map((s) => (keep(s) ? edit(s) : s)).filter((s) => !(s.shown && s.settled));

type Item = { problem: string } | { row: Sending; mime: ProjectAssetMime; file: File };

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
  const change = (keep: (s: Sending) => boolean, edit: (s: Sending) => Sending) =>
    setSending((list) => changed(list, keep, edit));
  const send = async ({ row, mime, file }: { row: Sending; mime: ProjectAssetMime; file: File }) => {
    const mine = (s: Sending) => s.key === row.key;
    const progress = (ratio: number) => change(mine, (s) => ({ ...s, ratio: raise(s.ratio, ratio) }));
    try {
      await uploadFile(client, projectId, row.name, mime, file, progress, abort.current.signal);
      change(mine, (s) => ({ ...s, ratio: 1, done: true }));
      return null;
    } catch (e) {
      setSending((list) => list.filter((s) => !mine(s)));
      return abort.current.signal.aborted ? null : sendFailure(row.name, e);
    }
  };
  const itemOf = (file: File): Item => {
    const prepared = prepare(file);
    if (!prepared.ok) return { problem: prepared.problem };
    return { row: queued(++keys.current, prepared.name), mime: prepared.mime, file };
  };
  const importFiles = async (files: File[]) => {
    if (files.length === 0) return;
    setProblems([]);
    const items = files.map(itemOf);
    const rows = items.flatMap((item) => ("row" in item ? [item.row] : []));
    setSending((list) => [...list, ...rows]);
    for (const item of items) {
      const problem = "row" in item ? await send(item) : item.problem;
      if (abort.current.signal.aborted) return;
      if (problem) setProblems((list) => [...list, problem]);
    }
    if (rows.length > 0) await onSent();
    const ours = new Set(rows.map((r) => r.key));
    change(
      (s) => ours.has(s.key),
      (s) => ({ ...s, settled: true }),
    );
  };
  const markShown = useCallback(
    (key: number) =>
      setSending((list) =>
        changed(
          list,
          (s) => s.key === key,
          (s) => ({ ...s, shown: true }),
        ),
      ),
    [],
  );
  return { sending, problems, importFiles, markShown };
}
