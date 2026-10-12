import type { Batch, Signal } from "@kibo/schema";
import { useState } from "react";
import { client } from "../../api";
import { frSignals } from "../../i18n/fr-signals";
import { SignalRow } from "./SignalRow";
import { boxSections, signalOutcome } from "./signal-sections";
import type { SignalsState } from "./use-signals";
import { WakeupLine } from "./WakeupLine";

type Props = {
  projectId: string;
  signals: SignalsState;
  batches: readonly Batch[];
  onTicket(key: string): void;
};

const t = frSignals.box;

type ListProps = {
  name: string;
  signals: readonly Signal[];
  batches: readonly Batch[];
  busy: string | null;
  onTicket(key: string): void;
  onIgnore(signal: Signal): void;
};

function SignalList({ name, signals, batches, busy, onTicket, onIgnore }: ListProps) {
  return (
    <section aria-label={name} className="grid gap-1.5">
      <h3 className="text-xs font-medium text-muted-foreground uppercase">{name}</h3>
      <ul className="grid gap-1.5">
        {signals.map((signal) => (
          <SignalRow
            key={signal.id}
            signal={signal}
            outcome={signalOutcome(signal, batches)}
            busy={busy === signal.id}
            onTicket={onTicket}
            onIgnore={onIgnore}
          />
        ))}
      </ul>
    </section>
  );
}

export function SignalBox({ projectId, signals, batches, onTicket }: Props) {
  const [busy, setBusy] = useState<string | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const { view, error, reload } = signals;
  const ignore = async (signal: Signal) => {
    setBusy(signal.id);
    setFailed(null);
    try {
      await client.rpc({ method: "ignoreSignal", projectId, signalId: signal.id });
      reload();
    } catch (e) {
      console.error(e);
      setFailed(t.ignoreFailed);
    } finally {
      setBusy(null);
    }
  };
  if (error)
    return (
      <p role="alert" className="px-3 py-2 text-xs text-destructive">
        {t.loadFailed}
      </p>
    );
  if (!view) return null;
  const sections = boxSections(view);
  const list = { batches, busy, onTicket, onIgnore: (s: Signal) => void ignore(s) };
  return (
    <div className="grid min-h-0 flex-1 content-start gap-4 overflow-y-auto px-3 py-3">
      {failed && (
        <p role="alert" className="text-xs text-destructive">
          {failed}
        </p>
      )}
      {sections.open.length === 0 ? (
        <p className="py-4 text-center text-sm text-muted-foreground">{t.empty}</p>
      ) : (
        <SignalList name={t.title(sections.open.length)} signals={sections.open} {...list} />
      )}
      <WakeupLine wakeup={sections.wakeup} />
      {sections.closed.length > 0 && <SignalList name={t.closed} signals={sections.closed} {...list} />}
    </div>
  );
}
