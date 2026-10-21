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

  const inFlight = useRef(new Set<string>());
  const attempt = async (item: OutboxItem) => {
    inFlight.current.add(item.id);
    try {
      await deliver(item.text);
    } catch (e) {
      console.error(e);
      setItems((prev) => prev.map((o) => (o.id === item.id ? { ...o, state: "failed" } : o)));
    } finally {
      inFlight.current.delete(item.id);
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
    if (!failed || inFlight.current.has(id)) return;
    const item: OutboxItem = { ...failed, at: Date.now(), state: "sending" };
    setItems((prev) => prev.map((o) => (o.id === id ? item : o)));
    void attempt(item);
  };

  const outbox = useMemo(() => settleOutbox(items, log), [items, log]);
  return { outbox, send, retry };
}
