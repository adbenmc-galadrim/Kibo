import type { Screen, TabTarget } from "@kibo/schema";
import { useExecutionShown } from "../../state/use-app-settings";
import { HiddenScreenNotice } from "../lazy-screens";
import { isExecutionScreen } from "./execution-visibility";

type Props = { screen: Screen | null; onOpen(target: TabTarget): void };

export function HiddenScreenSlot({ screen, onOpen }: Props) {
  const shown = useExecutionShown();
  if (shown || !isExecutionScreen(screen)) return null;
  return <HiddenScreenNotice onOpen={onOpen} />;
}
