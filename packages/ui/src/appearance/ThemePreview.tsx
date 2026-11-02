import { cn } from "@kibo/sdk/lib/utils";
import type { ReactNode } from "react";
import { useState } from "react";
import { frAppearance as t } from "../i18n/fr-appearance";
import type { Role } from "./palette-roles";

const s = t.sample;
type Pick = { selected: Role | null; onPick: (tone: Role) => void };
const RING = "outline-none hover:ring-1 hover:ring-(--ring) focus-visible:ring-2 focus-visible:ring-(--ring)";
const ON = "ring-2 ring-(--ring)";

function Surface({
  tone: role,
  className,
  children,
  pick,
}: Pick2 & { tone: Role; className?: string; children: ReactNode }) {
  return (
    <div className={cn("relative", className)}>
      <button
        type="button"
        aria-label={t.roles[role]}
        aria-pressed={pick.selected === role}
        onClick={() => pick.onPick(role)}
        className={cn(
          "pointer-events-auto absolute inset-0 rounded-[inherit]",
          RING,
          pick.selected === role && ON,
        )}
      />
      <div className="pointer-events-none relative flex flex-col gap-2">{children}</div>
    </div>
  );
}
type Pick2 = { pick: Pick };

function Spot({
  tone: role,
  className,
  children,
  pick,
}: Pick2 & { tone: Role; className?: string; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-label={`${t.roles[role]} : ${typeof children === "string" ? children : ""}`}
      aria-pressed={pick.selected === role}
      onClick={() => pick.onPick(role)}
      className={cn(
        "pointer-events-auto w-fit rounded-sm text-left",
        RING,
        pick.selected === role && ON,
        className,
      )}
    >
      {children}
    </button>
  );
}

function Status({ tone: role, label, pick }: Pick2 & { tone: Role; label: string }) {
  return (
    <Spot tone={role} pick={pick} className="flex items-center gap-1.5 text-[11px]">
      <span
        aria-hidden
        className="size-2 rounded-full"
        style={{ backgroundColor: `var(--tracking-${role})` }}
      />
      <span style={{ color: `var(--tracking-${role})` }}>{label}</span>
    </Spot>
  );
}

function Ticket({ title, tone: role, status, pick }: Pick2 & { title: string; tone: Role; status: string }) {
  return (
    <div className="flex flex-col gap-1 rounded-md border border-(--tracking-border) bg-(--tracking-muted) p-2">
      <Spot tone="fg" pick={pick} className="text-xs font-medium text-(--tracking-fg)">
        {title}
      </Spot>
      <Status tone={role} label={status} pick={pick} />
    </div>
  );
}

type KanbanColumn = {
  title: string;
  tone: Role;
  status: string;
  ticket2: string;
  tone2: Role;
  status2: string;
};

function KanbanView({ pick }: Pick2) {
  const columns: KanbanColumn[] = [
    {
      title: s.ticketA,
      tone: "blue",
      status: s.progress,
      ticket2: s.ticketC,
      tone2: "purple",
      status2: s.review,
    },
    { title: s.ticketB, tone: "green", status: s.done, ticket2: s.ticketD, tone2: "red", status2: s.blocked },
  ];
  return (
    <div className="grid grid-cols-2 gap-2">
      {columns.map((c) => (
        <Surface
          key={c.title}
          tone="card"
          pick={pick}
          className="rounded-lg border border-(--tracking-border) bg-(--tracking-card) p-2"
        >
          <Ticket title={c.title} tone={c.tone} status={c.status} pick={pick} />
          <Ticket title={c.ticket2} tone={c.tone2} status={c.status2} pick={pick} />
        </Surface>
      ))}
    </div>
  );
}

function GraphView({ pick }: Pick2) {
  const steps = [
    { tone: "green", label: s.ticketA },
    { tone: "blue", label: s.ticketB },
    { tone: "hold", label: s.ticketD },
  ] as const;
  return (
    <Surface
      tone="card"
      pick={pick}
      className="rounded-lg border border-(--tracking-border) bg-(--tracking-frame) p-2"
    >
      <Spot tone="dim" pick={pick} className="font-mono text-[11px] text-(--tracking-dim)">
        F4 · 1/3
      </Spot>
      <Spot tone="fg" pick={pick} className="text-xs font-semibold text-(--tracking-fg)">
        {s.ticketC}
      </Spot>
      {steps.map((step) => (
        <div
          key={step.label}
          className="flex items-center gap-1.5 rounded-md border border-(--tracking-border) bg-(--tracking-card) px-2 py-1"
        >
          <Status tone={step.tone} label={step.label} pick={pick} />
        </div>
      ))}
      <Status tone="amber" label={s.attention} pick={pick} />
    </Surface>
  );
}

function TicketView({ pick }: Pick2) {
  return (
    <Surface
      tone="card"
      pick={pick}
      className="rounded-lg border border-(--tracking-border) bg-(--tracking-card) p-3"
    >
      <Spot tone="fg" pick={pick} className="text-sm font-semibold text-(--tracking-fg)">
        {s.ticketD}
      </Spot>
      <Spot tone="mfg" pick={pick} className="text-xs text-(--tracking-mfg)">
        {s.meta}
      </Spot>
      <Spot tone="agent" pick={pick} className="text-xs text-(--tracking-brand-text)">
        {s.agent}
      </Spot>
      <Spot
        tone="border"
        pick={pick}
        className="w-full rounded-md border border-input bg-(--tracking-bg) px-2 py-1 text-xs text-(--tracking-dim)"
      >
        {s.field}
      </Spot>
      <Spot
        tone="accent"
        pick={pick}
        className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground"
      >
        {s.action}
      </Spot>
    </Surface>
  );
}

const TABS = { kanban: KanbanView, graph: GraphView, ticket: TicketView } as const;
type Tab = keyof typeof TABS;
const TAB_IDS: readonly Tab[] = ["kanban", "graph", "ticket"];

export function ThemePreview({ selected, onPick }: Pick) {
  const [tab, setTab] = useState<Tab>("kanban");
  const View = TABS[tab];
  const pick = { selected, onPick };
  return (
    <section aria-label={t.preview} className="flex flex-col gap-2">
      <div>
        <h3 className="text-xs font-semibold">{t.preview}</h3>
        <p className="text-xs text-muted-foreground">{t.previewHelp}</p>
      </div>
      <Surface
        tone="bg"
        pick={pick}
        className="rounded-xl border border-(--tracking-border) bg-(--tracking-bg) p-3"
      >
        <div
          role="tablist"
          aria-label={t.preview}
          className="pointer-events-auto flex w-fit gap-1 rounded-md bg-(--tracking-panel) p-1"
        >
          {TAB_IDS.map((id) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={tab === id}
              onClick={() => setTab(id)}
              className={cn(
                "rounded-sm px-2 py-0.5 text-xs text-(--tracking-mfg) hover:bg-(--tracking-hover)",
                tab === id && "bg-(--tracking-hover) text-(--tracking-fg)",
              )}
            >
              {t.previewTabs[id]}
            </button>
          ))}
        </div>
        <View pick={pick} />
      </Surface>
    </section>
  );
}
