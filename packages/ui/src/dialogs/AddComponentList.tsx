import { RadioGroup } from "@kibo/sdk/ui/radio-group";
import { frComponentsManage } from "../i18n/fr-components-manage";
import { componentIcon } from "../registry";
import { CatalogRow, CatalogSection, VersionPill } from "./CatalogRow";
import type { Choice } from "./catalog-choices";

type Props = {
  builtins: Choice[];
  selected: string | null;
  onSelect(ref: string): void;
};

export function AddComponentList(p: Props) {
  const a = frComponentsManage.addComponent;
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
        </RadioGroup>
        {p.builtins.length === 0 && (
          <p className="py-6 text-center text-sm text-muted-foreground">{a.noResult}</p>
        )}
      </div>
    </section>
  );
}
