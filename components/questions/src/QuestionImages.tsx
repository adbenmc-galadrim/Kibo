import type { Question, QuestionImage } from "@kibo/schema";
import { useSdk } from "@kibo/sdk";
import { useState } from "react";
import { fr } from "./fr";
import { ImageLightbox } from "./ImageLightbox";

export function QuestionImages({ question }: { question: Question }) {
  const sdk = useSdk();
  const [shown, setShown] = useState<number | null>(null);
  if (question.images.length === 0) return null;
  const urlOf = (image: QuestionImage) => sdk.questions.imageUrl(question.id, image.id);
  return (
    <>
      <ul aria-label={fr.images(question.images.length)} className="grid grid-cols-2 gap-2 lg:grid-cols-3">
        {question.images.map((image, index) => (
          <li key={image.id} className="grid gap-1">
            <button
              type="button"
              aria-label={fr.viewer.open(image.name)}
              className="overflow-hidden rounded-md border bg-muted outline-none hover:border-foreground/40 focus-visible:ring-[3px] focus-visible:ring-ring/50"
              onClick={() => setShown(index)}
            >
              <img
                src={urlOf(image)}
                alt={image.name}
                title={image.name}
                width={image.width ?? undefined}
                height={image.height ?? undefined}
                loading="lazy"
                decoding="async"
                className="aspect-video h-auto w-full object-cover object-top"
              />
            </button>
            <span className="truncate font-mono text-2xs text-muted-foreground">{image.name}</span>
          </li>
        ))}
      </ul>
      <ImageLightbox images={question.images} index={shown} urlOf={urlOf} onIndex={setShown} />
    </>
  );
}
