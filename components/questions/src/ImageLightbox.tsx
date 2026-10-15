import type { QuestionImage } from "@kibo/schema";
import { Button } from "@kibo/sdk/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle } from "@kibo/sdk/ui/dialog";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import type { KeyboardEvent } from "react";
import { fr } from "./fr";

type Props = {
  images: readonly QuestionImage[];
  index: number | null;
  urlOf(image: QuestionImage): string;
  onIndex(index: number | null): void;
};

const NAV = "size-10 shrink-0 rounded-full bg-zinc-800 text-zinc-50 hover:bg-zinc-700 hover:text-zinc-50";

export function ImageLightbox({ images, index, urlOf, onIndex }: Props) {
  const image = index === null ? undefined : images[index];
  if (index === null || image === undefined) return null;
  const first = index === 0;
  const last = index === images.length - 1;
  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === "ArrowLeft" && !first) onIndex(index - 1);
    if (e.key === "ArrowRight" && !last) onIndex(index + 1);
  };
  return (
    <Dialog open onOpenChange={(open) => !open && onIndex(null)}>
      <DialogContent
        showCloseButton={false}
        onKeyDown={onKeyDown}
        className="max-w-[calc(100%-2rem)] gap-3 border-zinc-800 bg-zinc-950 p-4 text-zinc-50 sm:max-w-5xl"
      >
        <header className="flex items-center gap-3">
          <DialogTitle className="min-w-0 flex-1 truncate font-mono text-sm font-normal">
            {image.name}
          </DialogTitle>
          <span className="font-mono text-xs text-zinc-400">
            {fr.viewer.position(index + 1, images.length)}
          </span>
          <DialogClose asChild>
            <Button
              variant="ghost"
              size="icon"
              className="size-8 text-zinc-50 hover:bg-zinc-800 hover:text-zinc-50"
            >
              <X aria-hidden />
              <span className="sr-only">{fr.viewer.close}</span>
            </Button>
          </DialogClose>
        </header>
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            className={NAV}
            aria-label={fr.viewer.previous}
            disabled={first}
            onClick={() => onIndex(index - 1)}
          >
            <ChevronLeft aria-hidden />
          </Button>
          <img
            src={urlOf(image)}
            alt={image.name}
            width={image.width ?? undefined}
            height={image.height ?? undefined}
            className="max-h-[75dvh] min-w-0 flex-1 rounded-md bg-white object-contain"
          />
          <Button
            variant="ghost"
            size="icon"
            className={NAV}
            aria-label={fr.viewer.next}
            disabled={last}
            onClick={() => onIndex(index + 1)}
          >
            <ChevronRight aria-hidden />
          </Button>
        </div>
        <DialogDescription className="text-center text-xs text-zinc-400">{fr.viewer.help}</DialogDescription>
      </DialogContent>
    </Dialog>
  );
}
