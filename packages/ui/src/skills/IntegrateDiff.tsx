import type { SkillReview } from "@kibo/schema";
import { Alert, AlertDescription, AlertTitle } from "@kibo/sdk/ui/alert";
import { Button } from "@kibo/sdk/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@kibo/sdk/ui/toggle-group";
import { GitMerge, TriangleAlert } from "lucide-react";
import { useRef, useState } from "react";
import { CodeEditor } from "../files/CodeEditor";
import { frSkills } from "../i18n/fr-skills";

type Layout = "split" | "unified";

type Props = {
  review: SkillReview;
  current: string;
  changed: boolean;
  saving: boolean;
  error: string | null;
  onSave(content: string): void;
  onCancel(): void;
};

export const NARROW_DIFF = 1100;
const t = frSkills.integrate;

const initialLayout = (): Layout =>
  typeof window !== "undefined" && window.innerWidth < NARROW_DIFF ? "unified" : "split";

export function IntegrateDiff({ review, current, changed, saving, error, onSave, onCancel }: Props) {
  const [layout, setLayout] = useState<Layout>(initialLayout);
  const merged = useRef(review.suggestion ?? current);
  return (
    <section aria-label={t.title(review.runLabel)} className="grid min-w-0 content-start gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <GitMerge aria-hidden className="size-4 text-brand-strong" />
        <h3 className="text-sm font-medium">{t.title(review.runLabel)}</h3>
        <span className="flex-1" />
        <ToggleGroup
          type="single"
          variant="outline"
          size="sm"
          aria-label={t.layout}
          value={layout}
          onValueChange={(v) => (v === "split" || v === "unified") && setLayout(v)}
        >
          <ToggleGroupItem value="split" className="px-2.5 text-xs">
            {t.split}
          </ToggleGroupItem>
          <ToggleGroupItem value="unified" className="px-2.5 text-xs">
            {t.unified}
          </ToggleGroupItem>
        </ToggleGroup>
      </div>
      {changed && (
        <Alert className="border-brand/50 text-brand-strong dark:text-brand">
          <TriangleAlert aria-hidden />
          <AlertTitle>{t.changed}</AlertTitle>
          <AlertDescription className="text-inherit">{t.changedHelp}</AlertDescription>
        </Alert>
      )}
      {layout === "split" && (
        <div className="grid grid-cols-2 gap-3 text-xs font-medium">
          <p>{t.current}</p>
          <p>{t.suggestion}</p>
        </div>
      )}
      <div className="flex h-[28rem] min-h-0 flex-col overflow-hidden rounded-lg border">
        <CodeEditor
          key={layout}
          initial={merged.current}
          original={current}
          path="SKILL.md"
          layout={layout}
          label={t.suggestion}
          wrap
          onChange={(value) => {
            merged.current = value;
          }}
          onSave={() => onSave(merged.current)}
        />
      </div>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <p className="flex-1 text-xs text-muted-foreground">{t.help}</p>
        <Button variant="outline" size="sm" onClick={onCancel}>
          {t.cancel}
        </Button>
        <Button size="sm" disabled={saving} onClick={() => onSave(merged.current)}>
          {t.save}
        </Button>
      </div>
    </section>
  );
}
