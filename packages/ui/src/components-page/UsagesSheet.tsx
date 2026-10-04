import { CAPABILITIES, type ComponentManifest, type ComponentUsage, formatsOf } from "@kibo/schema";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@kibo/sdk/ui/sheet";
import { FileText } from "lucide-react";
import { frComponentsList as t } from "../i18n/fr-components-list";
import { frCreations } from "../i18n/fr-creations";

export type UsagesTarget = {
  title: string;
  version: string;
  usages: readonly ComponentUsage[];
  manifest?: Pick<ComponentManifest, "kind" | "formats" | "capabilities"> | null;
};

const formatsText = (manifest: UsagesTarget["manifest"]): string | null => {
  const formats = manifest ? formatsOf(manifest) : [];
  return formats.length > 0 ? t.formats(formats.map((f) => frCreations.formats.labels[f])) : null;
};

const capabilitiesText = (manifest: UsagesTarget["manifest"]): string | null => {
  const declared = CAPABILITIES.filter((c) => manifest?.capabilities.includes(c));
  return declared.length > 0 ? t.capabilities(declared.map((c) => t.capabilityLabels[c])) : null;
};

type Props = {
  row: UsagesTarget | null;
  onClose(): void;
  onOpenPage(projectId: string, pageId: string): void;
};

export function placesOf(usages: readonly ComponentUsage[]): ComponentUsage[] {
  const seen = new Map<string, ComponentUsage>();
  for (const u of usages) {
    const key = `${u.projectId}/${u.pageId}`;
    if (!seen.has(key)) seen.set(key, u);
  }
  return [...seen.values()].sort(
    (a, b) =>
      a.projectName.localeCompare(b.projectName, "fr") || a.pageTitle.localeCompare(b.pageTitle, "fr"),
  );
}

export function UsagesSheet({ row, onClose, onOpenPage }: Props) {
  const places = row ? placesOf(row.usages) : [];
  const formats = formatsText(row?.manifest);
  const capabilities = capabilitiesText(row?.manifest);
  return (
    <Sheet open={row !== null} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="w-full gap-0 sm:max-w-sm">
        <SheetHeader className="border-b">
          <SheetTitle>{t.usagesTitle}</SheetTitle>
          <SheetDescription>{row ? t.usagesOf(row.title, row.version) : ""}</SheetDescription>
          {formats && <p className="text-xs text-muted-foreground">{formats}</p>}
          {capabilities && <p className="text-xs text-muted-foreground">{capabilities}</p>}
        </SheetHeader>
        {places.length === 0 ? (
          <p className="p-4 text-sm text-muted-foreground">{t.usagesEmpty}</p>
        ) : (
          <ul className="grid gap-0.5 p-2">
            {places.map((u) => (
              <li key={`${u.projectId}/${u.pageId}`}>
                <button
                  type="button"
                  className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm hover:bg-accent focus-visible:bg-accent focus-visible:outline-none"
                  onClick={() => onOpenPage(u.projectId, u.pageId)}
                >
                  <FileText aria-hidden className="size-4 shrink-0 text-muted-foreground" />
                  <span className="truncate">{t.place(u.projectName, u.pageTitle)}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </SheetContent>
    </Sheet>
  );
}
