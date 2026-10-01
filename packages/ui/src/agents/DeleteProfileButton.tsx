import type { AgentProfile } from "@kibo/schema";
import { Button } from "@kibo/sdk/ui/button";
import { ConfirmDialog } from "@kibo/sdk/ui/confirm-dialog";
import { useState } from "react";
import { client } from "../api";
import { fr } from "../i18n/fr";
import { frAgentsPage } from "../i18n/fr-agents-page";

type Props = { profile: AgentProfile; describeError: (e: unknown) => string; onDeleted: () => void };

export function DeleteProfileButton({ profile, describeError, onDeleted }: Props) {
  const [confirming, setConfirming] = useState(false);
  const remove = async () => {
    await client.rpc({ method: "config", command: { method: "deleteProfile", profileId: profile.id } });
    onDeleted();
  };
  return (
    <>
      <Button type="button" variant="ghost" className="text-destructive" onClick={() => setConfirming(true)}>
        {fr.profile.delete}
      </Button>
      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title={frAgentsPage.deleteTitle(profile.name)}
        description={frAgentsPage.deleteHelp}
        confirmLabel={frAgentsPage.deleteConfirm}
        cancelLabel={fr.common.cancel}
        onConfirm={remove}
        describeError={describeError}
      />
    </>
  );
}
