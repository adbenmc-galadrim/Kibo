import { SPRINT_COUNT_MAX } from "@kibo/schema";
import { Input } from "@kibo/sdk/ui/input";
import { Label } from "@kibo/sdk/ui/label";
import { RadioGroup, RadioGroupItem } from "@kibo/sdk/ui/radio-group";
import { useId } from "react";
import { frNewProject as t } from "../i18n/fr-new-project";
import { type NewProjectFields, preview, type Validation } from "./new-project-model";
import { SprintPreview } from "./SprintPreview";

type Props = {
  fields: NewProjectFields;
  onFields: (patch: Partial<NewProjectFields>) => void;
  problems: Pick<Validation, "count" | "start">;
};

const LABEL = "text-[13px] leading-4 font-medium";
const FIELD = "grid content-start gap-[6px]";

export function SprintSetupFields({ fields, onFields, problems }: Props) {
  const id = useId();
  const summary = preview(fields);
  return (
    <>
      <div className="flex gap-3">
        <div className={`${FIELD} flex-1`}>
          <Label htmlFor={`${id}-start`} className={LABEL}>
            {t.sprintStart}
          </Label>
          <Input
            id={`${id}-start`}
            type="date"
            value={fields.sprintStart}
            onChange={(e) => onFields({ sprintStart: e.target.value })}
            aria-invalid={problems.start}
          />
        </div>
        <div className={`${FIELD} w-[150px]`}>
          <Label htmlFor={`${id}-count`} className={LABEL}>
            {t.sprintCount}
          </Label>
          <Input
            id={`${id}-count`}
            type="number"
            min={1}
            max={SPRINT_COUNT_MAX}
            step={1}
            value={Number.isFinite(fields.sprintCount) ? fields.sprintCount : ""}
            onChange={(e) => onFields({ sprintCount: e.target.valueAsNumber })}
            aria-invalid={problems.count}
            aria-describedby={problems.count ? `${id}-count-help` : undefined}
          />
          {problems.count && (
            <p id={`${id}-count-help`} role="alert" className="text-xs text-destructive">
              {t.sprintCountHelp}
            </p>
          )}
        </div>
      </div>
      <fieldset className={FIELD}>
        <legend className={`${LABEL} mb-[6px]`}>{t.sprintWeeks}</legend>
        <RadioGroup
          value={String(fields.sprintWeeks)}
          onValueChange={(v) => onFields({ sprintWeeks: v === "2" ? 2 : 1 })}
          className="flex items-center gap-5"
        >
          <WeeksOption id={`${id}-w1`} value="1" label={t.oneWeek} />
          <WeeksOption id={`${id}-w2`} value="2" label={t.twoWeeks} />
        </RadioGroup>
      </fieldset>
      {summary !== "" && (
        <SprintPreview
          setup={{
            sprintStart: fields.sprintStart,
            sprintCount: fields.sprintCount,
            sprintWeeks: fields.sprintWeeks,
          }}
          summary={summary}
        />
      )}
    </>
  );
}

function WeeksOption({ id, value, label }: { id: string; value: string; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <RadioGroupItem id={id} value={value} />
      <Label htmlFor={id} className="text-[13px] leading-4 font-normal">
        {label}
      </Label>
    </div>
  );
}
