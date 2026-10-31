import {
  defaultFormatOf,
  FORMAT_SIZES,
  type FormatSize,
  type Layout,
  type Page,
  splitRef,
} from "@kibo/schema";
import { Button } from "@kibo/sdk/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@kibo/sdk/ui/dialog";
import { Input } from "@kibo/sdk/ui/input";
import { Search } from "lucide-react";
import { useState } from "react";
import { client } from "../api";
import { fr } from "../i18n/fr";
import { frComponentsManage } from "../i18n/fr-components-manage";
import { nextLayout } from "../lib/format-grid";
import { BUILTIN_COMPONENTS, findBuiltin } from "../registry";
import { AddComponentList } from "./AddComponentList";
import { Details } from "./ComponentDetails";
import { builtinChoices, type Choice, matches } from "./catalog-choices";

type Props = {
  projectId: string;
  page: Page;
  taken: Layout[];
  open: boolean;
  onOpenChange: (o: boolean) => void;
};

const BUILTINS = builtinChoices(BUILTIN_COMPONENTS);
const sizeOf = (ref: string): FormatSize => {
  const manifest = findBuiltin(splitRef(ref).id)?.manifest;
  return manifest ? FORMAT_SIZES[defaultFormatOf(manifest)] : FORMAT_SIZES.large;
};

export function AddComponentDialog({ projectId, page, taken, open, onOpenChange }: Props) {
  const a = frComponentsManage.addComponent;
  const [query, setQuery] = useState("");
  const [ref, setRef] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  const shown = (c: Choice) => matches(`${c.title} ${c.description ?? ""}`, query);
  const shownBuiltins = BUILTINS.filter(shown);
  const selected = BUILTINS.find((c) => c.ref === ref) ?? null;

  const addInstance = async (component: string) => {
    setFailed(false);
    try {
      await client.rpc({
        method: "command",
        projectId,
        command: {
          method: "addInstance",
          pageId: page.id,
          component,
          ...(page.kind === "dashboard" && { layout: nextLayout(taken, sizeOf(component)) }),
        },
      });
      onOpenChange(false);
    } catch (e) {
      console.error(e);
      setFailed(true);
    }
  };
  const submit = () => {
    if (selected) void addInstance(selected.ref);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[min(46rem,calc(100dvh-2rem))] flex-col gap-0 overflow-hidden p-0 sm:max-w-4xl">
        <DialogHeader className="gap-3 border-b px-6 pt-6 pb-4">
          <DialogTitle>{a.title}</DialogTitle>
          <div className="relative">
            <Search aria-hidden className="absolute top-2.5 left-2.5 size-4 text-muted-foreground" />
            <Input
              className="pl-8"
              placeholder={a.search}
              aria-label={a.search}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
        </DialogHeader>
        <div className="grid min-h-0 flex-1 grid-rows-2 min-[720px]:grid-cols-[1fr_1.1fr] min-[720px]:grid-rows-1">
          <AddComponentList builtins={shownBuiltins} selected={ref} onSelect={setRef} />
          <section
            aria-label={a.detailsLabel}
            className="grid min-h-0 content-start gap-4 overflow-y-auto bg-muted/30 p-4 text-sm"
          >
            {selected ? (
              <Details choice={selected} page={page} />
            ) : (
              <p className="text-muted-foreground">{a.pick}</p>
            )}
          </section>
        </div>
        <div className="grid gap-2 border-t px-6 py-4">
          {failed && (
            <p role="alert" className="text-sm text-destructive">
              {a.failed}
            </p>
          )}
          <DialogFooter className="sm:items-center">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              {fr.common.cancel}
            </Button>
            <Button disabled={!selected} onClick={submit}>
              {a.submit}
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
