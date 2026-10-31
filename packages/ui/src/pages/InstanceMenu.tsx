import type { Instance } from "@kibo/schema";
import { lazyPanel } from "@kibo/sdk";
import { Button } from "@kibo/sdk/ui/button";
import { DropdownMenu, DropdownMenuTrigger } from "@kibo/sdk/ui/dropdown-menu";
import { Ellipsis } from "lucide-react";
import { useState } from "react";
import { fr } from "../i18n/fr";
import { findComponent } from "../registry";

type Props = { projectId: string; instance: Instance; title: string };

const InstanceMenuContent = lazyPanel(
  () => import("./InstanceMenuContent").then((m) => m.InstanceMenuContent),
  fr.lazy,
  { fallback: "sr-only" },
);

export function useInstanceTitle(ref: string): string {
  return findComponent(ref)?.manifest.title ?? ref;
}

export function InstanceMenu({ projectId, instance, title }: Props) {
  const [opened, setOpened] = useState(false);

  return (
    <DropdownMenu onOpenChange={(open) => open && setOpened(true)}>
      <DropdownMenuTrigger asChild>
        <Button size="icon" variant="ghost" className="size-7 shrink-0" aria-label={fr.instance.menu(title)}>
          <Ellipsis aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      {opened && <InstanceMenuContent projectId={projectId} instance={instance} title={title} />}
    </DropdownMenu>
  );
}
