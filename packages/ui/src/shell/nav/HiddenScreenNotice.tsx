import { frTracking } from "../../i18n/fr-tracking";

export function HiddenScreenNotice({ onHome }: { onHome(): void }) {
  return (
    <output className="flex items-center gap-2 border-b bg-muted px-6 py-2 text-sm text-muted-foreground">
      <span>{frTracking.hidden.notice}</span>
      <button
        type="button"
        className="font-medium text-foreground underline-offset-4 hover:underline"
        onClick={onHome}
      >
        {frTracking.hidden.home}
      </button>
    </output>
  );
}
