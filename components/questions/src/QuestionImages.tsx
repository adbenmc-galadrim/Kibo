import type { Question } from "@kibo/schema";
import { useSdk } from "@kibo/sdk";
import { fr } from "./fr";

export function QuestionImages({ question }: { question: Question }) {
  const sdk = useSdk();
  if (question.images.length === 0) return null;
  return (
    <ul aria-label={fr.images(question.images.length)} className="grid grid-cols-2 gap-2 lg:grid-cols-3">
      {question.images.map((image) => (
        <li key={image.id} className="overflow-hidden rounded-md border bg-muted">
          <img
            src={sdk.questions.imageUrl(question.id, image.id)}
            alt={image.name}
            title={image.name}
            width={image.width ?? undefined}
            height={image.height ?? undefined}
            loading="lazy"
            decoding="async"
            className="aspect-video h-auto w-full object-cover object-top"
          />
        </li>
      ))}
    </ul>
  );
}
