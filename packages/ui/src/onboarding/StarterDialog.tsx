import { Alert, AlertDescription } from "@kibo/sdk/ui/alert";
import { Button } from "@kibo/sdk/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@kibo/sdk/ui/dialog";
import { useMemo, useState } from "react";
import { client } from "../api";
import { fr } from "../i18n/fr";
import { applyStarterPlan } from "./apply-plan";
import { useStarterCatalog } from "./catalog-refs";
import { chosenPages, presetFor, toSelection } from "./presets";
import { RoleStep } from "./RoleStep";

type Props = { projectId: string; open: boolean; onOpenChange: (o: boolean) => void };

export function StarterDialog({ projectId, open, onOpenChange }: Props) {
  const { refs, titles } = useStarterCatalog();
  const available = useMemo(() => new Set(refs.keys()), [refs]);
  const [selection, setSelection] = useState(() => toSelection(presetFor("dev", available)));
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState<string[]>([]);
  const partial = failed.length > 0;
  const pages = chosenPages(selection);
  const submit = async () => {
    setBusy(true);
    const failures = await applyStarterPlan(client, projectId, pages, refs);
    setBusy(false);
    if (failures.length === 0) return onOpenChange(false);
    console.error(failures);
    setFailed(failures.map((f) => f.title));
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{fr.onboarding.suggestPages}</DialogTitle>
          <DialogDescription>{fr.onboarding.roleSubtitle}</DialogDescription>
        </DialogHeader>
        {partial ? (
          <Alert>
            <AlertDescription>{fr.onboarding.partialPages(failed)}</AlertDescription>
          </Alert>
        ) : (
          <RoleStep available={available} titles={titles} selection={selection} onSelection={setSelection} />
        )}
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            {partial ? fr.common.close : fr.common.cancel}
          </Button>
          {!partial && (
            <Button disabled={busy || pages.length === 0} onClick={submit}>
              {fr.onboarding.addPages(pages.length)}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
