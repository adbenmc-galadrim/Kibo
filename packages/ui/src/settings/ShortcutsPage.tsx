import { Card, CardContent, CardHeader, CardTitle } from "@kibo/sdk/ui/card";
import { Fragment, useId } from "react";
import { frShortcuts } from "../i18n/fr-shortcuts";
import { isMac } from "../lib/shortcut-label";
import { SettingsNav } from "./SettingsNav";
import { type ShortcutGroup, shortcutGroups } from "./shortcuts";

const KBD = "rounded border bg-muted px-1.5 py-0.5 font-mono text-2xs text-foreground";

function Group({ group }: { group: ShortcutGroup }) {
  const id = useId();
  return (
    <Card className="gap-3" role="region" aria-labelledby={id}>
      <CardHeader>
        <CardTitle id={id}>{group.title}</CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="grid gap-2">
          {group.items.map((item) => (
            <li key={item.label} className="flex items-center justify-between gap-4 text-sm">
              <span className="text-muted-foreground">{item.label}</span>
              <span className="flex items-center gap-1.5">
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
      </CardContent>
    </Card>
  );
}

export function ShortcutsPage() {
  const groups = shortcutGroups(isMac());
  return (
    <div className="grid min-h-full grid-cols-[14rem_1fr]">
      <SettingsNav active="shortcuts" />
      <div className="flex flex-col gap-4 p-8">
        <div>
          <h1 className="text-xl font-semibold">{frShortcuts.title}</h1>
          <p className="text-sm text-muted-foreground">{frShortcuts.subtitle}</p>
        </div>
        <div className="grid gap-4 xl:grid-cols-3">
          {groups.map((g) => (
            <Group key={g.title} group={g} />
          ))}
        </div>
      </div>
    </div>
  );
}
