import type { IconInput } from "@kibo/schema";
import { Button } from "@kibo/sdk/ui/button";
import { ImagePlus, Trash2 } from "lucide-react";
import { useRef, useState } from "react";
import { frFields } from "../i18n/fr-fields";
import { IconFileError, iconDataUrl, readIconFile } from "./icon-file";

export type IconFieldProps = {
  label: string;
  currentUrl: string | null;
  pending: IconInput | null;
  removed: boolean;
  onPick(icon: IconInput): void;
  onRemove(): void;
};

const t = frFields.icon;
const refusalText = (e: unknown): string =>
  e instanceof IconFileError ? (e.reason === "too-large" ? t.tooLarge : t.badFormat) : t.readFailed;

export function IconField({ label, currentUrl, pending, removed, onPick, onRemove }: IconFieldProps) {
  const input = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const src = pending ? iconDataUrl(pending) : removed ? null : currentUrl;
  const onFile = async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    try {
      onPick(await readIconFile(file));
    } catch (e) {
      if (!(e instanceof IconFileError)) console.error(e);
      setError(refusalText(e));
    }
  };
  return (
    <div className="grid gap-2">
      <div className="flex items-center gap-3">
        {src ? (
          <img src={src} alt={t.preview(label)} className="size-12 rounded-md border object-cover" />
        ) : (
          <span
            role="img"
            aria-label={t.none}
            className="grid size-12 place-items-center rounded-md border bg-muted text-muted-foreground"
          >
            <ImagePlus aria-hidden className="size-5" />
          </span>
        )}
        <input
          ref={input}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="sr-only"
          aria-label={t.choose}
          onChange={(e) => {
            void onFile(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
        <Button type="button" variant="outline" size="sm" onClick={() => input.current?.click()}>
          {t.choose}
        </Button>
        {src && (
          <Button type="button" variant="ghost" size="sm" onClick={onRemove}>
            <Trash2 aria-hidden />
            {t.remove}
          </Button>
        )}
      </div>
      <p className="text-xs text-muted-foreground">{t.help}</p>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
