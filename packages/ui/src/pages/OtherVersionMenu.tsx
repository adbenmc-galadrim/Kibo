import { Button } from "@kibo/sdk/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@kibo/sdk/ui/dropdown-menu";
import { ChevronDown } from "lucide-react";
import { useState } from "react";
import { client } from "../api";
import { fr } from "../i18n/fr";

type Props = { projectId: string; instanceId: string; versions: string[] };

export function OtherVersionMenu({ projectId, instanceId, versions }: Props) {
  const t = fr.market;
  const [failed, setFailed] = useState(false);
  if (versions.length === 0) return null;
  const choose = async (to: string) => {
    setFailed(false);
    try {
      await client.rpc({ method: "updateInstance", projectId, instanceId, to });
    } catch (e) {
      console.error("[kibo-ui] version change failed", e);
      setFailed(true);
    }
  };
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size="sm" variant="outline">
            {t.otherVersion}
            <ChevronDown aria-hidden />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          {versions.map((v) => (
            <DropdownMenuItem key={v} onSelect={() => void choose(v)}>
              {t.otherVersionItem(v)}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
      {failed && (
        <p role="alert" className="text-sm text-destructive">
          {t.otherVersionFailed}
        </p>
      )}
    </>
  );
}
