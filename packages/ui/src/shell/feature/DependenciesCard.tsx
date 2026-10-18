import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@kibo/sdk/ui/dropdown-menu";
import { CircleCheck, Link, Plus } from "lucide-react";
import { frFeature as t } from "../../i18n/fr-group";
import { ASIDE_ACTION, ASIDE_EMPTY, ASIDE_ROW, AsideCard, AsideRow } from "./AsideCard";
import type { FeatureDependencies, FeatureDependency } from "./feature-links";

type Adding = { candidates: readonly FeatureDependency[]; onAdd(featureId: string): void };
type Props = { dependencies: FeatureDependencies; adding?: Adding; onOpenTicket(id: string): void };

function AddDependency({ candidates, onAdd }: Adding) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button type="button" className={ASIDE_ACTION}>
          <Plus absoluteStrokeWidth size={12} aria-hidden className="size-[12px]" />
          {t.addDependency}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="max-w-[300px]">
        <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
          {t.addDependencyTitle}
        </DropdownMenuLabel>
        {candidates.map((c) => (
          <DropdownMenuItem key={c.id} onSelect={() => onAdd(c.id)}>
            <span className="font-mono text-xs text-muted-foreground">{c.label}</span>
            <span className="truncate">{c.title}</span>
          </DropdownMenuItem>
        ))}
        {candidates.length === 0 && <DropdownMenuItem disabled>{t.noCandidate}</DropdownMenuItem>}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

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

export function DependenciesCard({ dependencies, adding, onOpenTicket }: Props) {
  const { waits, unblocks } = dependencies;
  return (
    <AsideCard icon={Link} title={t.dependencies} action={adding && <AddDependency {...adding} />}>
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
