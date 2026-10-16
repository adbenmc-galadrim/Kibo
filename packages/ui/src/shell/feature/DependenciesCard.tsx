import { CircleCheck, Link } from "lucide-react";
import { frFeature as t } from "../../i18n/fr-group";
import { ASIDE_EMPTY, ASIDE_ROW, AsideCard, AsideRow } from "./AsideCard";
import type { FeatureDependencies, FeatureDependency } from "./feature-links";

type Props = { dependencies: FeatureDependencies; onOpenTicket(id: string): void };

function DependencyRow({ kind, dep, onOpen }: { kind: string; dep: FeatureDependency; onOpen(): void }) {
  return (
    <AsideRow>
      <button type="button" className={`${ASIDE_ROW} hover:bg-(--tracking-hover)`} onClick={onOpen}>
        <span className="w-[56px] shrink-0 text-[12px] leading-[15px] text-(--tracking-dim)">{kind}</span>
        <span className="shrink-0 font-mono text-[11px] leading-[14px] text-(--tracking-mfg)">
          {dep.label}
        </span>
        <span className="min-w-0 flex-1 truncate text-[12.5px] leading-[15px] text-(--tracking-fg)">
          {dep.title}
        </span>
        {dep.delivered ? (
          <CircleCheck
            absoluteStrokeWidth
            size={13}
            aria-label={t.badges.delivered}
            className="size-[13px] shrink-0 text-(--tracking-green)"
          />
        ) : (
          dep.sprint && (
            <span className="shrink-0 font-mono text-[11px] leading-[14px] text-(--tracking-dim)">
              {dep.sprint}
            </span>
          )
        )}
      </button>
    </AsideRow>
  );
}

export function DependenciesCard({ dependencies, onOpenTicket }: Props) {
  const { waits, unblocks } = dependencies;
  return (
    <AsideCard icon={Link} title={t.dependencies}>
      {waits.map((d) => (
        <DependencyRow key={`w-${d.id}`} kind={t.waitsFor} dep={d} onOpen={() => onOpenTicket(d.id)} />
      ))}
      {unblocks.map((d) => (
        <DependencyRow key={`u-${d.id}`} kind={t.unblocks} dep={d} onOpen={() => onOpenTicket(d.id)} />
      ))}
      {waits.length + unblocks.length === 0 && (
        <AsideRow>
          <p className={ASIDE_EMPTY}>{t.noDependency}</p>
        </AsideRow>
      )}
    </AsideCard>
  );
}
