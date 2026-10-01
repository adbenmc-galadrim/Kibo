import { type Instance, splitRef } from "@kibo/schema";
import { lazyPanel } from "@kibo/sdk";
import { Button } from "@kibo/sdk/ui/button";
import { DropdownMenu, DropdownMenuTrigger } from "@kibo/sdk/ui/dropdown-menu";
import { Ellipsis } from "lucide-react";
import { useState } from "react";
import { fr } from "../i18n/fr";
import { useFlash } from "../lib/use-flash";
import { findComponent } from "../registry";
import { useComponents } from "../state/use-components";

type Props = { projectId: string; instance: Instance; title: string };

const InstanceMenuContent = lazyPanel(
  () => import("./InstanceMenuContent").then((m) => m.InstanceMenuContent),
  fr.lazy,
  { fallback: "sr-only" },
);

export function useInstanceTitle(ref: string): string {
  const { components } = useComponents();
  const builtin = findComponent(ref);
  if (builtin) return builtin.manifest.title;
  const { id } = splitRef(ref);
  return components?.find((c) => c.id === id)?.title ?? ref;
}

export function InstanceMenu({ projectId, instance, title }: Props) {
  const { message, tone, flash } = useFlash();
  const [opened, setOpened] = useState(false);

  return (
    <>
      {message && (
        <span
          role={tone === "error" ? "alert" : "status"}
          className={`truncate text-xs ${tone === "error" ? "text-destructive" : "text-muted-foreground"}`}
        >
          {message}
        </span>
      )}
      <DropdownMenu onOpenChange={(open) => open && setOpened(true)}>
        <DropdownMenuTrigger asChild>
          <Button
            size="icon"
            variant="ghost"
            className="size-7 shrink-0"
            aria-label={fr.instance.menu(title)}
          >
            <Ellipsis aria-hidden />
          </Button>
        </DropdownMenuTrigger>
        {opened && (
          <InstanceMenuContent projectId={projectId} instance={instance} title={title} flash={flash} />
        )}
      </DropdownMenu>
    </>
  );
}
