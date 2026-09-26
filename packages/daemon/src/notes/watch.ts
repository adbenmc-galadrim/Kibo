import { watch as fsWatch } from "node:fs";
import { readdir, stat } from "node:fs/promises";
import { join } from "node:path";

export type WatchFn = (dir: string, onEvent: () => void, onError: (e: unknown) => void) => { close(): void };
export type NotesWatcher = { close(): void; readonly polling: boolean; readonly ready: Promise<void> };
export type WatchNotesOptions = {
  debounceMs?: number;
  pollMs?: number;
  watch?: WatchFn;
  log?: (line: string) => void;
};

const defaultWatch: WatchFn = (dir, onEvent, onError) => {
  const w = fsWatch(dir, { recursive: true }, onEvent);
  w.on("error", onError);
  return { close: () => w.close() };
};

const isMissing = (e: unknown) => e instanceof Error && "code" in e && e.code === "ENOENT";
const message = (e: unknown) => (e instanceof Error ? e.message : String(e));

async function signature(dir: string): Promise<string> {
  const parts: string[] = [];
  const walk = async (abs: string) => {
    for (const entry of await readdir(abs, { withFileTypes: true })) {
      if (entry.name.startsWith(".") || entry.isSymbolicLink()) continue;
      const child = join(abs, entry.name);
      if (entry.isDirectory()) await walk(child);
      else if (entry.name.endsWith(".md")) parts.push(`${child}:${(await stat(child)).mtimeMs}`);
    }
  };
  try {
    await walk(dir);
  } catch (e) {
    if (!isMissing(e)) throw e;
    return "";
  }
  return parts.sort().join("\n");
}

export function watchNotes(dir: string, onChange: () => void, opts: WatchNotesOptions = {}): NotesWatcher {
  const pollMs = opts.pollMs ?? 3_000;
  const log = opts.log ?? ((line: string) => console.error(`[kibo-daemon] ${line}`));
  let timer: ReturnType<typeof setTimeout> | null = null;
  let handle: { close(): void } | null = null;
  let fellBack = false;
  let closed = false;
  let last: string | null = null;
  let running: Promise<void> | null = null;
  let again = false;

  const compare = async () => {
    try {
      const sig = await signature(dir);
      if (closed) return;
      if (last !== null && sig !== last) onChange();
      last = sig;
    } catch (e) {
      log(`scanning ${dir} failed: ${message(e)}`);
    }
  };

  const check = (): Promise<void> => {
    if (running) {
      again = true;
      return running;
    }
    running = (async () => {
      do {
        again = false;
        await compare();
      } while (again && !closed);
    })().finally(() => {
      running = null;
    });
    return running;
  };

  const fire = () => {
    if (closed) return;
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      void check();
    }, opts.debounceMs ?? 200);
  };

  const fallBack = (e: unknown) => {
    if (closed || fellBack) return;
    fellBack = true;
    log(`fs.watch unavailable on ${dir} (${message(e)}): polling every ${pollMs} ms`);
    handle?.close();
    handle = null;
  };

  try {
    handle = (opts.watch ?? defaultWatch)(dir, fire, fallBack);
  } catch (e) {
    fallBack(e);
  }
  const ready = check();
  const sweep = setInterval(() => void check(), pollMs);

  return {
    ready,
    get polling() {
      return fellBack;
    },
    close: () => {
      closed = true;
      if (timer) clearTimeout(timer);
      clearInterval(sweep);
      handle?.close();
      handle = null;
    },
  };
}
