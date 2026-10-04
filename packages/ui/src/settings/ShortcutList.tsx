import { Fragment } from "react";
import { frShortcuts } from "../i18n/fr-shortcuts";
import type { ShortcutItem } from "./shortcuts";

const KBD = "rounded border bg-muted px-1.5 py-0.5 font-mono text-2xs text-foreground";

export function ShortcutList({ items }: { items: ShortcutItem[] }) {
  return (
    <ul className="grid gap-2">
      {items.map((item) => (
        <li key={item.label} className="flex items-center justify-between gap-4 text-sm">
          <span className="text-muted-foreground">{item.label}</span>
          <span className="flex shrink-0 items-center gap-1.5">
            {item.keys.map((key, i) => (
              <Fragment key={key}>
                {i > 0 && item.range && (
                  <span className="text-xs text-muted-foreground">{frShortcuts.range}</span>
                )}
                <kbd className={KBD}>{key}</kbd>
              </Fragment>
            ))}
          </span>
        </li>
      ))}
    </ul>
  );
}
