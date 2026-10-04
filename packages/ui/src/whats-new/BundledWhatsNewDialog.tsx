import changelog from "../../../../CHANGELOG.md?raw";
import { WhatsNewDialog } from "./WhatsNewDialog";

type Props = { open: boolean; version: string; onSeen(version: string): void };

export function BundledWhatsNewDialog(props: Props) {
  return <WhatsNewDialog {...props} changelog={changelog} />;
}
