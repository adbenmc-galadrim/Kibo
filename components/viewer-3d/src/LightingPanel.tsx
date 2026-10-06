import { INTENSITY_RANGE, LIGHTING_PRESETS, type LightingPreset } from "@kibo/sdk/three";
import { Button } from "@kibo/sdk/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@kibo/sdk/ui/collapsible";
import { Label } from "@kibo/sdk/ui/label";
import { Switch } from "@kibo/sdk/ui/switch";
import { ToggleGroup, ToggleGroupItem } from "@kibo/sdk/ui/toggle-group";
import { SunMedium } from "lucide-react";
import { useId, useState } from "react";
import { fr } from "./fr";
import type { LightingDraft } from "./use-lighting-draft";

export type LightingLabels = { intensity: string; shadows: string; environment: string };

type Props = { draft: LightingDraft; labels: LightingLabels };

const isPreset = (v: string): v is LightingPreset => LIGHTING_PRESETS.some((p) => p === v);

export function LightingPanel({ draft, labels }: Props) {
  const [open, setOpen] = useState(false);
  const t = fr.lighting;
  const { draft: value, update, failed } = draft;
  const shadowsId = useId();
  const envId = useId();
  return (
    <Collapsible
      open={open}
      onOpenChange={setOpen}
      className="absolute top-2 right-2 z-10 grid max-w-[calc(100%-1rem)] justify-items-end gap-1"
    >
      <CollapsibleTrigger asChild>
        <Button
          size="icon"
          variant="outline"
          aria-label={t.toggle}
          className="size-7 bg-card/80 backdrop-blur"
        >
          <SunMedium aria-hidden className="size-3.5" />
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent asChild>
        <form
          aria-label={t.panel}
          onSubmit={(e) => e.preventDefault()}
          className="grid w-56 max-w-full gap-2.5 rounded-md border bg-card/90 p-2.5 text-xs shadow-sm backdrop-blur"
        >
          <ToggleGroup
            type="single"
            variant="outline"
            size="sm"
            aria-label={t.preset}
            value={value.preset}
            onValueChange={(v) => {
              if (isPreset(v)) update({ preset: v });
            }}
            className="w-full"
          >
            {LIGHTING_PRESETS.map((p) => (
              <ToggleGroupItem key={p} value={p} className="flex-1 px-1 text-xs">
                {t.presets[p]}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
          <label className="grid gap-1">
            <span className="flex items-baseline justify-between">
              <span>{labels.intensity}</span>
              <output className="font-mono text-2xs text-muted-foreground">{t.times(value.intensity)}</output>
            </span>
            <input
              type="range"
              aria-label={labels.intensity}
              min={INTENSITY_RANGE.min}
              max={INTENSITY_RANGE.max}
              step={0.05}
              value={value.intensity}
              onChange={(e) => update({ intensity: Number(e.target.value) })}
              className="w-full accent-foreground"
            />
          </label>
          <div className="flex items-center justify-between gap-2">
            <Label htmlFor={shadowsId} className="text-xs font-normal">
              {labels.shadows}
            </Label>
            <Switch
              id={shadowsId}
              checked={value.shadows}
              onCheckedChange={(shadows) => update({ shadows })}
            />
          </div>
          <div className="flex items-center justify-between gap-2">
            <Label htmlFor={envId} className="text-xs font-normal">
              {labels.environment}
            </Label>
            <Switch
              id={envId}
              checked={value.environment}
              onCheckedChange={(environment) => update({ environment })}
            />
          </div>
          {failed && (
            <p role="alert" className="text-2xs text-destructive">
              {t.saveFailed}
            </p>
          )}
        </form>
      </CollapsibleContent>
    </Collapsible>
  );
}
