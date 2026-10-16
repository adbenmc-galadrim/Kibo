import type { Screen, TabTarget } from "@kibo/schema";
import { fr } from "../../i18n/fr";
import { useExecutionShown } from "../../state/use-app-settings";
import { isExecutionScreen } from "./execution-visibility";

type Props = { screen: Screen | null; onOpen(target: TabTarget): void };

export function HiddenScreenNotice({ screen, onOpen }: Props) {
  const shown = useExecutionShown();
  if (shown || !isExecutionScreen(screen)) return null;
  return (
    <output className="flex items-center gap-2 border-b bg-muted px-6 py-2 text-sm text-muted-foreground">
      <span>{fr.nav.executionHidden}</span>
      <button
        type="button"
        className="font-medium text-foreground underline-offset-4 hover:underline"
        onClick={() => onOpen({ kind: "screen", screen: "general" })}
      >
        {fr.nav.showExecution}
      </button>
    </output>
  );
}
