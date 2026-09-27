import type { Domain } from "@kibo/schema";
import { fr } from "../i18n/fr";
import { errorMessage } from "../lib/error-message";
import { ConfirmDialog } from "../shell/lazy-dialogs";

export type DomainConfirming = { kind: "domain" } | { kind: "file"; path: string; guidelineId: string };

type Props = {
  confirming: DomainConfirming | null;
  domain: Domain | null;
  files: number;
  onClose(): void;
  onDeleteDomain(): Promise<void>;
  onRemoveFile(guidelineId: string): Promise<void>;
};

export function DomainConfirmations({
  confirming,
  domain,
  files,
  onClose,
  onDeleteDomain,
  onRemoveFile,
}: Props) {
  const onOpenChange = (open: boolean) => {
    if (!open) onClose();
  };
  if (confirming?.kind === "domain" && domain) {
    return (
      <ConfirmDialog
        open
        onOpenChange={onOpenChange}
        title={fr.domains.deleteTitle(domain.name)}
        description={fr.domains.deleteHelp(files)}
        confirmLabel={fr.common.delete}
        cancelLabel={fr.common.cancel}
        onConfirm={onDeleteDomain}
        describeError={errorMessage}
      />
    );
  }
  if (confirming?.kind === "file") {
    return (
      <ConfirmDialog
        open
        onOpenChange={onOpenChange}
        title={fr.domains.removeFileTitle(confirming.path)}
        description={fr.domains.removeFileHelp}
        confirmLabel={fr.common.delete}
        cancelLabel={fr.common.cancel}
        onConfirm={() => onRemoveFile(confirming.guidelineId)}
        describeError={errorMessage}
      />
    );
  }
  return null;
}
