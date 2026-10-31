import { useAutoAnimate } from "@kibo/sdk/ui/auto-animate";
import { ChevronRight, type LucideIcon } from "lucide-react";
import { Children, type ReactNode, useId, useState } from "react";
import { frToday as t } from "./fr-today";

type Props = {
  icon: LucideIcon;
  title: string;
  count: number;
  aside?: string | null;
  limit?: number;
  children: ReactNode;
};

export function SectionList({ icon: Icon, title, count, aside, limit, children }: Props) {
  const titleId = useId();
  const [expanded, setExpanded] = useState(false);
  const [list] = useAutoAnimate<HTMLUListElement>();
  const rows = Children.toArray(children);
  const shown = expanded || limit === undefined ? rows : rows.slice(0, limit);
  return (
    <section
      aria-labelledby={titleId}
      className="overflow-hidden rounded-[10px] border border-(--tracking-border) bg-(--tracking-card)"
    >
      <header className="flex h-10 items-center gap-2 px-[15px]">
        <Icon aria-hidden size={15} className="shrink-0 text-(--tracking-mfg)" />
        <h2 id={titleId} className="text-[13.5px] font-semibold">
          {title}
        </h2>
        <span className="rounded-full bg-(--tracking-muted) px-[5px] font-mono text-[10.5px] text-(--tracking-mfg)">
          {count}
        </span>
        <span className="flex-1" />
        {aside && <span className="text-xs text-(--tracking-dim)">{aside}</span>}
      </header>
      <ul ref={list}>{shown}</ul>
      {shown.length < rows.length && (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="flex h-[38px] w-full items-center gap-1 border-t border-(--tracking-soft) px-[15px] text-xs text-(--tracking-mfg) outline-none hover:bg-(--tracking-hover) focus-visible:ring-[3px] focus-visible:ring-ring/50"
        >
          {t.showAll(rows.length)}
          <ChevronRight aria-hidden size={13} />
        </button>
      )}
    </section>
  );
}

type LineProps = {
  dot: "red" | "purple" | "green";
  label: string;
  labelWidth: number;
  title: string;
  onOpen(): void;
  children: ReactNode;
};

const DOTS = {
  red: "bg-(--tracking-red)",
  purple: "bg-(--tracking-purple)",
  green: "bg-(--tracking-green)",
};

export function SectionLine({ dot, label, labelWidth, title, onOpen, children }: LineProps) {
  return (
    <li className="relative flex h-[38px] items-center gap-2.5 border-t border-(--tracking-soft) px-[15px] hover:bg-(--tracking-hover)">
      <span aria-hidden className={`size-[7px] shrink-0 rounded-full ${DOTS[dot]}`} />
      <span className="shrink-0 font-mono text-xs text-(--tracking-mfg)" style={{ width: labelWidth }}>
        {label}
      </span>
      <button
        type="button"
        onClick={onOpen}
        className="min-w-0 truncate text-left text-[13px] font-medium outline-none after:absolute after:inset-0 focus-visible:after:ring-[3px] focus-visible:after:ring-ring/50"
      >
        {title}
      </button>
      <span className="flex-1" />
      {children}
    </li>
  );
}

export const ProjectKey = ({ value }: { value: string }) => (
  <span className="shrink-0 font-mono text-xs text-(--tracking-dim)">{value}</span>
);
