import { type AgentProfile, GuidelinePath, type WorkspaceConfig } from "@kibo/schema";
import { Button } from "@kibo/sdk/ui/button";
import { Input } from "@kibo/sdk/ui/input";
import { Label } from "@kibo/sdk/ui/label";
import { FileText, Plus, X } from "lucide-react";
import { useId, useState } from "react";
import { client } from "../api";
import { fr } from "../i18n/fr";

export type GuidelineDraft = { id: string; path: string };

type Props = {
  profile: AgentProfile | null;
  config: WorkspaceConfig;
  drafts: GuidelineDraft[];
  onDraftsChange: (update: (drafts: GuidelineDraft[]) => GuidelineDraft[]) => void;
  onError: (message: string | null) => void;
  onFailure: (error: unknown) => void;
};

export function ProfileGuidelines({ profile, config, drafts, onDraftsChange, onError, onFailure }: Props) {
  const id = useId();
  const [path, setPath] = useState("");
  const listed: GuidelineDraft[] = profile
    ? config.guidelines.filter((g) => g.owner.scope === "profile" && g.owner.profileId === profile.id)
    : drafts;

  const add = async () => {
    onError(null);
    const parsed = GuidelinePath.safeParse(path.trim());
    if (!parsed.success) {
      onError(fr.profile.invalidPath);
      return;
    }
    if (!profile) {
      onDraftsChange((d) => [...d, { id: crypto.randomUUID(), path: parsed.data }]);
    } else {
      try {
        await client.rpc({
          method: "config",
          command: {
            method: "addGuideline",
            owner: { scope: "profile", profileId: profile.id },
            path: parsed.data,
            content: "",
          },
        });
      } catch (e) {
        onFailure(e);
        return;
      }
    }
    setPath("");
  };

  const remove = async (guidelineId: string) => {
    onError(null);
    if (!profile) {
      onDraftsChange((d) => d.filter((g) => g.id !== guidelineId));
      return;
    }
    try {
      await client.rpc({
        method: "config",
        command: {
          method: "removeGuideline",
          owner: { scope: "profile", profileId: profile.id },
          guidelineId,
        },
      });
    } catch (e) {
      onFailure(e);
    }
  };

  return (
    <div className="grid gap-2">
      <p className="text-sm font-medium">{fr.profile.guidelines}</p>
      <ul className="grid gap-1.5">
        {listed.map((g) => (
          <li key={g.id} className="flex items-center gap-2 rounded-md border px-2.5 py-1.5 text-sm">
            <FileText aria-hidden className="size-4 text-muted-foreground" />
            <span className="flex-1 truncate">{g.path}</span>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="size-6"
              aria-label={fr.profile.removeGuideline(g.path)}
              onClick={() => void remove(g.id)}
            >
              <X className="size-3.5" />
            </Button>
          </li>
        ))}
      </ul>
      <div className="flex items-center gap-2 rounded-md border px-2.5 py-1">
        <FileText aria-hidden className="size-4 text-muted-foreground" />
        <Label htmlFor={`${id}-path`} className="sr-only">
          {fr.profile.guidelinePath}
        </Label>
        <Input
          id={`${id}-path`}
          value={path}
          placeholder="guidelines/front.md"
          className="h-7 flex-1 border-0 px-0 shadow-none focus-visible:ring-0 dark:bg-transparent"
          onChange={(e) => setPath(e.target.value)}
          onKeyDown={(e) => {
            if (e.key !== "Enter") return;
            e.preventDefault();
            void add();
          }}
        />
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="size-6"
          aria-label={fr.profile.addGuideline}
          disabled={!path.trim()}
          onClick={() => void add()}
        >
          <Plus className="size-3.5" />
        </Button>
      </div>
    </div>
  );
}
