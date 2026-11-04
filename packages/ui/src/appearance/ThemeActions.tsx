import { Button } from "@kibo/sdk/ui/button";
import { Input } from "@kibo/sdk/ui/input";
import { Plus, RotateCcw } from "lucide-react";
import { useState } from "react";
import { frAppearance as t } from "../i18n/fr-appearance";
import { resetDraft, saveAsTheme } from "./palette-state";
import { usePalette } from "./use-palette";

function NewThemeForm({ onDone }: { onDone: () => void }) {
  const { palette, scheme, commit } = usePalette();
  const [name, setName] = useState("");
  return (
    <form
      className="flex items-center gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (name.trim() === "") return;
        commit(saveAsTheme(palette, scheme, name, `custom-${crypto.randomUUID()}`));
        onDone();
      }}
    >
      <Input
        autoFocus
        aria-label={t.themeName}
        placeholder={t.themeName}
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="h-8 w-44 text-xs"
      />
      <Button size="sm" type="submit" disabled={name.trim() === ""}>
        {t.save}
      </Button>
      <Button size="sm" type="button" variant="ghost" onClick={onDone}>
        {t.cancel}
      </Button>
    </form>
  );
}

export function ThemeActions() {
  const { active, palette, scheme, commit } = usePalette();
  const [naming, setNaming] = useState(false);
  return (
    <div className="flex flex-wrap items-center gap-2">
      {naming ? (
        <NewThemeForm onDone={() => setNaming(false)} />
      ) : (
        <Button size="sm" variant="outline" title={t.newThemeHelp} onClick={() => setNaming(true)}>
          <Plus className="size-3.5" aria-hidden />
          {t.newTheme}
        </Button>
      )}
      {active.modified && (
        <Button size="sm" variant="ghost" onClick={() => commit(resetDraft(palette, scheme))}>
          <RotateCcw className="size-3.5" aria-hidden />
          {t.resetDraft}
        </Button>
      )}
    </div>
  );
}
