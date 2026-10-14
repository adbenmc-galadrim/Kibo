import type { ComponentCall, DeliveryResult, EntityType, QuestionRecipient } from "@kibo/schema";
import type { ProjectBackend, QuestionsApi, SdkMode } from "./types";

type Call = <T>(c: ComponentCall) => Promise<T>;
type Needs = { read(entity: EntityType): void; write(entity: EntityType): void };

export const questionImageUrl = (questionId: string, imageId: string): string =>
  `/api/questions/${encodeURIComponent(questionId)}/images/${encodeURIComponent(imageId)}`;

export function questionsApi(needs: Needs, call: Call, backend: ProjectBackend, mode: SdkMode): QuestionsApi {
  return {
    async deliver(ticketId) {
      needs.write("question");
      return call<DeliveryResult>({ kind: "questions.deliver", ticketId });
    },
    async recipients() {
      needs.read("question");
      if (mode === "gated") return call<QuestionRecipient[]>({ kind: "questions.recipients" });
      return (await backend.snapshot()).questionRecipients;
    },
    imageUrl: questionImageUrl,
  };
}
