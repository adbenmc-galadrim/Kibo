import { Button } from "@kibo/sdk/ui/button";
import { frLayout } from "../i18n/fr-layout";

export type LayoutToolbarProps = {
  changes: number;
  saving: boolean;
  failure: string | null;
  onCancel(): void;
  onSave(): void;
};

export function LayoutToolbar({ changes, saving, failure, onCancel, onSave }: LayoutToolbarProps) {
  return (
    <div className="flex shrink-0 flex-col gap-2 border-b px-4 py-2">
      <div role="toolbar" aria-label={frLayout.title} className="flex items-center gap-2">
        <span className="min-w-0 flex-1 truncate text-sm font-medium">
          {frLayout.title} · <span className="text-muted-foreground">{frLayout.toolbar(changes)}</span>
        </span>
        <Button variant="outline" size="sm" onClick={onCancel} disabled={saving}>
          {frLayout.cancel}
        </Button>
        <Button size="sm" onClick={onSave} disabled={saving || changes === 0}>
          {frLayout.save}
        </Button>
      </div>
      {failure && (
        <p role="alert" className="text-sm text-destructive">
          {failure}
        </p>
      )}
    </div>
  );
}
