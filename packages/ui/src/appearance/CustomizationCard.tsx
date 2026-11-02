import { Card, CardContent, CardHeader, CardTitle } from "@kibo/sdk/ui/card";
import { ToggleGroup, ToggleGroupItem } from "@kibo/sdk/ui/toggle-group";
import { useState } from "react";
import { frAppearance as t } from "../i18n/fr-appearance";
import { usePref } from "../lib/local-pref";
import { ColorEditor } from "./ColorEditor";
import type { Role } from "./palette-roles";
import { ThemeActions } from "./ThemeActions";
import { ThemeGallery } from "./ThemeGallery";
import { ThemePreview } from "./ThemePreview";
import { usePalette } from "./use-palette";

const SEGMENT =
  "h-7 rounded-md px-3 text-xs text-muted-foreground hover:bg-transparent data-[state=on]:bg-background data-[state=on]:text-foreground";

export function CustomizationCard() {
  const { scheme } = usePalette();
  const [mode, setMode] = usePref("kibo.palette.editor", "simple");
  const [selected, setSelected] = useState<Role | null>(null);
  const custom = mode === "custom";
  return (
    <Card className="gap-4">
      <CardHeader className="flex flex-row items-center justify-between gap-4">
        <div>
          <CardTitle>{t.themes(scheme)}</CardTitle>
          <p className="mt-1 text-xs text-muted-foreground">
            {custom ? t.customHelp : t.simpleHelp} {t.themesHelp}
          </p>
        </div>
        <ToggleGroup
          type="single"
          spacing={1}
          aria-label={t.editor}
          className="rounded-lg bg-muted p-[3px]"
          value={custom ? "custom" : "simple"}
          onValueChange={(v) => {
            if (v !== "") setMode(v);
          }}
        >
          <ToggleGroupItem value="simple" className={SEGMENT}>
            {t.simple}
          </ToggleGroupItem>
          <ToggleGroupItem value="custom" className={SEGMENT}>
            {t.custom}
          </ToggleGroupItem>
        </ToggleGroup>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <ThemeGallery />
        {custom && (
          <>
            <ThemeActions />
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,420px)]">
              <ColorEditor selected={selected} onSelect={setSelected} />
              <div className="lg:sticky lg:top-4 lg:self-start">
                <ThemePreview selected={selected} onPick={setSelected} />
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
