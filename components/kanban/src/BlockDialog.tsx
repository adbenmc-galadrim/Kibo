import { ReasonDialog } from "@kibo/sdk/ui/reason-dialog";
import { fr } from "./fr";

type Props = {
  ticketKey: string;
  error: string | null;
  onConfirm: (reason: string) => void;
  onCancel: () => void;
};

export function BlockDialog({ ticketKey, error, onConfirm, onCancel }: Props) {
  return (
    <ReasonDialog
      open
      title={fr.block.title(ticketKey)}
      description={fr.block.description}
      label={fr.block.reason}
      placeholder={fr.block.placeholder}
      confirmLabel={fr.block.confirm}
      cancelLabel={fr.block.cancel}
      error={error}
      onConfirm={onConfirm}
      onCancel={onCancel}
    />
  );
}
