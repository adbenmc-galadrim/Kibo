import { Page } from "@kibo/schema";
import { Button } from "@kibo/sdk/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@kibo/sdk/ui/dialog";
import { Input } from "@kibo/sdk/ui/input";
import { Label } from "@kibo/sdk/ui/label";
import { RadioGroup } from "@kibo/sdk/ui/radio-group";
import { AppWindow, LayoutDashboard, Sparkles } from "lucide-react";
import { type FormEvent, useId, useState } from "react";
import { client } from "../api";
import { fr } from "../i18n/fr";
import { navigate } from "../route";
import { ChoiceCard } from "./ChoiceCard";

type Props = {
  projectId: string;
  projectName: string;
  parentId: string | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onSuggest?: () => void;
};

export function NewPageDialog({ projectId, projectName, parentId, open, onOpenChange, onSuggest }: Props) {
  const titleId = useId();
  const [title, setTitle] = useState("");
  const [kind, setKind] = useState<Page["kind"]>("dashboard");
  const [failed, setFailed] = useState(false);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setFailed(false);
    let page: Page;
    try {
      page = Page.parse(
        await client.rpc({
          method: "command",
          projectId,
          command: { method: "addPage", title: title.trim(), kind, parentId },
        }),
      );
    } catch {
      setFailed(true);
      return;
    }
    onOpenChange(false);
    setTitle("");
    navigate(projectId, page.id);
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <form onSubmit={submit} className="grid gap-4">
          <DialogHeader>
            <DialogTitle>{fr.newPage.title}</DialogTitle>
            <DialogDescription>{fr.newPage.subtitle(projectName)}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-2">
            <Label htmlFor={titleId}>{fr.newPage.name}</Label>
            <Input id={titleId} value={title} onChange={(e) => setTitle(e.target.value)} autoFocus />
          </div>
          <fieldset className="grid gap-2">
            <legend className="mb-2 text-sm font-medium">{fr.newPage.kind}</legend>
            <RadioGroup
              value={kind}
              onValueChange={(v) => setKind(v === "view" ? "view" : "dashboard")}
              className="grid gap-2 sm:grid-cols-2"
            >
              <ChoiceCard
                value="dashboard"
                icon={LayoutDashboard}
                title={fr.newPage.dashboard}
                description={fr.newPage.dashboardHelp}
              />
              <ChoiceCard
                value="view"
                icon={AppWindow}
                title={fr.newPage.view}
                description={fr.newPage.viewHelp}
              />
            </RadioGroup>
          </fieldset>
          {onSuggest && (
            <Button
              type="button"
              variant="link"
              size="sm"
              className="justify-self-start px-0"
              onClick={() => {
                onOpenChange(false);
                onSuggest();
              }}
            >
              <Sparkles aria-hidden /> {fr.onboarding.suggestPages}
            </Button>
          )}
          {failed && (
            <p role="alert" className="text-sm text-destructive">
              {fr.newPage.failed}
            </p>
          )}
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              {fr.common.cancel}
            </Button>
            <Button type="submit" disabled={!title.trim()}>
              {fr.newPage.submit}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
