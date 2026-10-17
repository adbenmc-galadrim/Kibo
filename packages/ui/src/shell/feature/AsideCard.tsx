import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { CARD, SEPARATOR } from "./styles";

type Props = { icon: LucideIcon; title: string; count?: number; children: ReactNode };

export function AsideCard({ icon: Icon, title, count, children }: Props) {
  return (
    <section aria-label={title} className={`flex w-full flex-col ${CARD}`}>
      <header className="flex h-[40px] items-center gap-[8px] px-[14px]">
        <Icon absoluteStrokeWidth size={15} aria-hidden className="size-[15px] text-(--tracking-mfg)" />
        <h3 className="text-[13px] leading-[16px] font-semibold text-(--tracking-fg)">{title}</h3>
        {count !== undefined && (
          <span className="font-mono text-[12px] leading-[15px] text-(--tracking-dim)">{count}</span>
        )}
      </header>
      {children}
    </section>
  );
}

export function AsideRow({ children }: { children: ReactNode }) {
  return (
    <>
      <span aria-hidden className={SEPARATOR} />
      {children}
    </>
  );
}

export const ASIDE_ROW = "flex w-full items-center gap-[8px] px-[14px] py-[9px] text-left";
export const ASIDE_EMPTY = `${ASIDE_ROW} text-[12px] leading-[15px] text-(--tracking-dim)`;
