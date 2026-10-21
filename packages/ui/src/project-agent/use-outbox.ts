import type { RunLogEntry } from "@kibo/schema";
import { useEffect, useMemo, useRef, useState } from "react";
import { type OutboxItem, settleOutbox } from "./outbox";

export function useOutbox(deliver: (text: string) => Promise<void>, log: readonly RunLogEntry[]) {
  const [items, setItems] = useState<OutboxItem[]>([]);
  const seq = useRef(0);
  useEffect(() => {
    setItems((prev) => {
      const next = settleOutbox(prev, log);
      return next.length === prev.length ? prev : next;
    });
  }, [log]);

  const attempt = async (item: OutboxItem) => {
    try {
      await deliver(item.text);
    } catch (e) {
      setItems((prev) => prev.map((o) => (o.id === item.id ? { ...o, state: "failed" } : o)));
      throw e;
    }
  };
  const send = (text: string) => {
    seq.current += 1;
    const item: OutboxItem = { id: `outbox-${seq.current}`, text, at: Date.now(), state: "sending" };
    setItems((prev) => [...prev, item]);
    return attempt(item);
  };
  const retry = (id: string) => {
    const failed = items.find((o) => o.id === id);
    if (!failed) return;
    const item: OutboxItem = { ...failed, at: Date.now(), state: "sending" };
    setItems((prev) => prev.map((o) => (o.id === id ? item : o)));
    attempt(item).catch((e: unknown) => console.error(e));
  };

  const outbox = useMemo(() => settleOutbox(items, log), [items, log]);
  return { outbox, send, retry };
}
