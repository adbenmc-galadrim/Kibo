import { type AgentsState, HostSettings, type HostView, runSubject } from "@kibo/schema";
import { RunDot } from "@kibo/sdk";
import { cn } from "@kibo/sdk/lib/utils";
import { Button } from "@kibo/sdk/ui/button";
import { Input } from "@kibo/sdk/ui/input";
import { Progress } from "@kibo/sdk/ui/progress";
import { type FormEvent, useId, useState } from "react";
import { fr } from "../i18n/fr";
import { elapsed, formatDuration, formatGb } from "./format";
import { byStart, holdsSlot } from "./queue-runs";

function Gauge({
  label,
  value,
  threshold,
  text,
  tone,
}: {
  label: string;
  value: number;
  threshold: number;
  text: string;
  tone: string;
}) {
  const over = value >= threshold;
  return (
    <div className="grid gap-1.5">
      <div className="flex items-baseline gap-2 text-sm">
        <span>{label}</span>
        <span className="flex-1" />
        <span className="font-mono text-xs text-muted-foreground">{`${text} · ${fr.queue.threshold(threshold)}`}</span>
      </div>
      <div className="relative">
        <Progress
          value={Math.min(100, value)}
          aria-label={label}
          className={cn("h-1.5", over ? "[&_[data-slot=progress-indicator]]:bg-red-500" : tone)}
        />
        <span
          aria-hidden
          className="absolute -top-0.5 h-2.5 w-0.5 bg-foreground"
          style={{ left: `${threshold}%` }}
        />
      </div>
    </div>
  );
}

function HostSlotsEditor({ host, onSave }: { host: HostView; onSave: (slots: number) => void }) {
  const id = useId();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(String(host.hostSlots));
  const parsed = HostSettings.shape.hostSlots.safeParse(Number(value));
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!parsed.success) return;
    onSave(parsed.data);
    setEditing(false);
  };
  if (!editing) {
    return (
      <p className="text-xs text-muted-foreground">
        <span>
          {host.slotsFixed
            ? fr.queue.hostSlotsFixed(host.hostSlots, host.autoSlots)
            : fr.queue.hostSlots(host.hostSlots, host.cores, host.ramGb)}
        </span>
        {" · "}
        <button type="button" className="underline-offset-2 hover:underline" onClick={() => setEditing(true)}>
          {fr.queue.edit}
        </button>
      </p>
    );
  }
  return (
    <form onSubmit={submit} className="flex items-center gap-2 text-xs">
      <label htmlFor={id}>{fr.queue.slotsLabel}</label>
      <Input
        id={id}
        type="number"
        min={1}
        max={32}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className="h-7 w-16"
      />
      <Button type="submit" size="sm" className="h-7" disabled={!parsed.success}>
        {fr.queue.save}
      </Button>
    </form>
  );
}

export function QueueCapacity({
  state,
  now,
  onSlots,
}: {
  state: AgentsState;
  now: number;
  onSlots: (n: number) => void;
}) {
  const { host } = state;
  const holders = state.runs.filter(holdsSlot).sort(byStart);
  const slots = Array.from({ length: Math.max(host.hostSlots, holders.length) }, (_, i) => i + 1);
  const ramUsed = formatGb((host.ram * host.ramGb) / 100);
  const titleId = useId();
  return (
    <section aria-labelledby={titleId} className="grid gap-3 rounded-lg border bg-card p-4">
      <div>
        <h2 id={titleId} className="font-semibold">
          {fr.queue.capacity}
        </h2>
        <p className="text-sm text-muted-foreground">{fr.queue.capacityHelp}</p>
      </div>
      <div className="grid gap-4 lg:grid-cols-[1fr_20rem]">
        <ul className="grid grid-cols-[repeat(auto-fill,minmax(10rem,1fr))] gap-3">
          {slots.map((slot) => {
            const run = holders[slot - 1];
            return (
              <li
                key={slot}
                className={cn(
                  "relative grid gap-0.5 rounded-md border p-2.5",
                  run ? "border-blue-500/70" : "border-dashed",
                )}
              >
                <span className="text-[11px] text-muted-foreground">{fr.queue.slot(slot)}</span>
                {run ? (
                  <>
                    <RunDot state={run.state} className="absolute top-2.5 right-2.5" />
                    <span className="font-mono text-sm">{run.label}</span>
                    <span className="text-xs text-muted-foreground">
                      {runSubject(run, formatDuration(elapsed(run, now)))}
                    </span>
                  </>
                ) : (
                  <span className="text-sm text-muted-foreground">{fr.queue.free}</span>
                )}
              </li>
            );
          })}
        </ul>
        <div className="grid content-start gap-3">
          <Gauge
            label={fr.queue.cpu}
            value={host.cpu}
            threshold={host.cpuThreshold}
            text={fr.queue.percent(host.cpu)}
            tone="[&_[data-slot=progress-indicator]]:bg-blue-500"
          />
          <Gauge
            label={fr.queue.ram}
            value={host.ram}
            threshold={host.ramThreshold}
            text={fr.queue.ramUsage(ramUsed, host.ramGb)}
            tone="[&_[data-slot=progress-indicator]]:bg-amber-500"
          />
          <HostSlotsEditor key={host.hostSlots} host={host} onSave={onSlots} />
        </div>
      </div>
    </section>
  );
}
