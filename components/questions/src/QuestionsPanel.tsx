import { useSdk } from "@kibo/sdk";
import { QuestionsView } from "./QuestionsView";
import { QuestionsWidget } from "./QuestionsWidget";

export function QuestionsPanel() {
  return useSdk().surface === "view" ? <QuestionsView /> : <QuestionsWidget />;
}
