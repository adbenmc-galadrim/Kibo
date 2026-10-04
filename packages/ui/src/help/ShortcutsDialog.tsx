import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@kibo/sdk/ui/dialog";
import { useId } from "react";
import { frShortcuts as t } from "../i18n/fr-shortcuts";
import { isMac } from "../lib/shortcut-label";
import { ShortcutList } from "../settings/ShortcutList";
import { type ShortcutGroup, shortcutGroups } from "../settings/shortcuts";
import { targetToHash } from "../tabs/target-hash";

type Props = { open: boolean; onClose(): void };

const SETTINGS_HREF = targetToHash({ kind: "screen", screen: "shortcuts" });

function Group({ group }: { group: ShortcutGroup }) {
  const id = useId();
  return (
    <section aria-labelledby={id} className="grid content-start gap-3">
      <h3 id={id} className="text-sm font-medium">
        {group.title}
      </h3>
      <ShortcutList items={group.items} />
    </section>
  );
}

export function ShortcutsDialog({ open, onClose }: Props) {
  const groups = shortcutGroups(isMac());
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-5xl">
        <DialogHeader>
          <DialogTitle>{t.title}</DialogTitle>
          <DialogDescription>{t.subtitle}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-6 md:grid-cols-3">
          {groups.map((g) => (
            <Group key={g.title} group={g} />
          ))}
        </div>
        <a
          href={SETTINGS_HREF}
          onClick={onClose}
          className="justify-self-start text-sm text-muted-foreground underline underline-offset-2 hover:text-foreground"
        >
          {t.seeInSettings}
        </a>
      </DialogContent>
    </Dialog>
  );
}
