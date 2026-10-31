import type { T3Status } from "@kibo/schema";
import { useEffect, useState } from "react";
import type { T3Api } from "../types";

const STATUS_CACHE_MS = 30_000;

type Cached = { at: number; status: Promise<T3Status> };
const cache = new WeakMap<T3Api["status"], Cached>();

function readStatus(read: T3Api["status"]): Promise<T3Status> {
  const cached = cache.get(read);
  if (cached && Date.now() - cached.at < STATUS_CACHE_MS) return cached.status;
  const status = read();
  cache.set(read, { at: Date.now(), status });
  status.catch(() => cache.delete(read));
  return status;
}

export function useT3Status(read: T3Api["status"]): T3Status | null {
  const [status, setStatus] = useState<T3Status | null>(null);
  useEffect(() => {
    let alive = true;
    readStatus(read).then(
      (next) => {
        if (alive) setStatus(next);
      },
      (e: unknown) => console.warn("[kibo] t3.status failed", e),
    );
    return () => {
      alive = false;
    };
  }, [read]);
  return status;
}
