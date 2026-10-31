import type { Instance } from "@kibo/schema";
import { DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator } from "@kibo/sdk/ui/dropdown-menu";
import { Settings2, Trash2 } from "lucide-react";
import { type ReactNode, useState } from "react";
import { client } from "../api";
import { fr } from "../i18n/fr";
import { configSchemaOf } from "../lib/config-form";
import { errorMessage } from "../lib/error-message";
import { ConfirmDialog, InstanceSettingsDialog } from "../shell/lazy-dialogs";

type InstanceMenuContentProps = {
  projectId: string;
  instance: Instance;
  title: string;
  lead?: ReactNode;
  side?: "bottom" | "right";
};

export function InstanceMenuContent({
  projectId,
  instance,
  title,
  lead,
  side = "bottom",
}: InstanceMenuContentProps) {
  const i = fr.instance;
  const [settings, setSettings] = useState(false);
  const [removing, setRemoving] = useState(false);
  const schema = configSchemaOf(instance);

  const remove = async () => {
    await client.rpc({
      method: "command",
      projectId,
      command: { method: "removeInstance", instanceId: instance.id },
    });
  };

  return (
    <>
      <DropdownMenuContent align={side === "right" ? "start" : "end"} side={side}>
        {lead}
        {lead && <DropdownMenuSeparator />}
        {schema && (
          <DropdownMenuItem onSelect={() => setSettings(true)}>
            <Settings2 aria-hidden />
            {i.settings}
          </DropdownMenuItem>
        )}
        {schema && <DropdownMenuSeparator />}
        <DropdownMenuItem variant="destructive" onSelect={() => setRemoving(true)}>
          <Trash2 aria-hidden />
          {i.remove}
        </DropdownMenuItem>
      </DropdownMenuContent>
      {settings && schema && (
        <InstanceSettingsDialog
          projectId={projectId}
          instance={instance}
          title={title}
          schema={schema}
          onClose={() => setSettings(false)}
        />
      )}
      {removing && (
        <ConfirmDialog
          open
          onOpenChange={(o) => !o && setRemoving(false)}
          title={i.removeTitle(title)}
          description={i.removeHelp}
          confirmLabel={i.removeConfirm}
          cancelLabel={fr.common.cancel}
          onConfirm={remove}
          describeError={errorMessage}
        />
      )}
    </>
  );
}
