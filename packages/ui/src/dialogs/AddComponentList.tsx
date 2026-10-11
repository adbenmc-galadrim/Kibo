import type { DraftSummary, MarketInstallResult } from "@kibo/schema";
import { RadioGroup } from "@kibo/sdk/ui/radio-group";
import { Blocks, Sparkles } from "lucide-react";
import { useState } from "react";
import { fr } from "../i18n/fr";
import { componentIcon } from "../registry";
import { CatalogRow, CatalogSection, VersionPill } from "./CatalogRow";
import type { Choice } from "./catalog-choices";
import { DraftRow } from "./DraftRow";
import { MarketCatalogSection } from "./MarketCatalogSection";

type Props = {
  query: string;
  builtins: Choice[];
  mine: Choice[];
  drafts: DraftSummary[];
  selected: string | null;
  onSelect(ref: string): void;
  onPublishDraft: ((id: string) => void) | undefined;
  onMarketInstalled(result: MarketInstallResult): void;
  onCreate(): void;
  loadFailed: boolean;
};

export function AddComponentList(p: Props) {
  const a = fr.addComponent;
  const [marketCount, setMarketCount] = useState(0);
  const empty = p.builtins.length + p.mine.length + p.drafts.length + marketCount === 0;
  return (
    <section
      aria-label={a.listLabel}
      className="flex min-h-0 flex-col border-b min-[720px]:border-r min-[720px]:border-b-0"
    >
      <div className="grid min-h-0 flex-1 content-start gap-1 overflow-y-auto px-4 pb-2">
        <RadioGroup value={p.selected ?? ""} onValueChange={p.onSelect} className="grid gap-0.5">
          {p.builtins.length > 0 && <CatalogSection label={a.builtin} />}
          {p.builtins.map((c) => (
            <CatalogRow
              key={c.ref}
              value={c.ref}
              icon={componentIcon(c.ref)}
              title={c.title}
              description={c.description}
              aside={<VersionPill version={c.version} />}
            />
          ))}
          {(p.mine.length > 0 || p.drafts.length > 0) && <CatalogSection label={a.mine} />}
          {p.mine.map((c) => (
            <CatalogRow
              key={c.ref}
              value={c.ref}
              icon={Blocks}
              title={c.title}
              description={c.line}
              aside={<VersionPill version={c.version} />}
            />
          ))}
        </RadioGroup>
        {p.drafts.map((d) => (
          <DraftRow key={d.id} draft={d} onPublish={p.onPublishDraft} />
        ))}
        <MarketCatalogSection query={p.query} onCount={setMarketCount} onInstalled={p.onMarketInstalled} />
        {empty && <p className="py-6 text-center text-sm text-muted-foreground">{a.noResult}</p>}
      </div>
      <div className="grid gap-2 border-t px-4 py-3">
        <button
          type="button"
          onClick={p.onCreate}
          className="flex items-center gap-2 rounded-lg border border-dashed px-3 py-2.5 text-sm font-medium hover:bg-accent/60"
        >
          <Sparkles aria-hidden className="size-4" />
          {a.create}
        </button>
        {p.loadFailed && (
          <p role="alert" className="text-sm text-destructive">
            {a.loadFailed}
          </p>
        )}
      </div>
    </section>
  );
}
