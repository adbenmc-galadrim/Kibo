import type { ImageSnapshot, Sealed } from "@kibo/remote";
import { authenticatedJson } from "./authenticated";

type ImageCache = {
  url(projectId: string, questionId: string, imageId: string): string;
  warm(
    projectId: string,
    kinds: string[],
    blob: (kind: string) => Sealed | null,
    open: (kind: string) => Promise<unknown>,
  ): Promise<void>;
  forget(projectId: string, kind?: string): void;
};

const IMAGE_PREFIX = "image:";

const slot = (projectId: string, kind: string) => `${projectId}/${kind}`;

function toBlob(image: ImageSnapshot): Blob {
  const binary = atob(image.bytes);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: image.mime });
}

export function createImageCache(): ImageCache {
  const urls = new Map<string, { sealed: Sealed; url: string }>();
  const drop = (key: string) => {
    const known = urls.get(key);
    if (known) URL.revokeObjectURL(known.url);
    urls.delete(key);
  };
  return {
    url: (projectId, questionId, imageId) =>
      urls.get(slot(projectId, `${IMAGE_PREFIX}${questionId}:${imageId}`))?.url ?? "",
    async warm(projectId, kinds, blob, open) {
      for (const kind of kinds.filter((k) => k.startsWith(IMAGE_PREFIX))) {
        const sealed = blob(kind);
        const key = slot(projectId, kind);
        if (!sealed || urls.get(key)?.sealed === sealed) continue;
        const url = URL.createObjectURL(toBlob(authenticatedJson<ImageSnapshot>(await open(kind))));
        drop(key);
        urls.set(key, { sealed, url });
      }
    },
    forget(projectId, kind) {
      for (const key of [...urls.keys()])
        if (kind === undefined ? key.startsWith(`${projectId}/`) : key === slot(projectId, kind)) drop(key);
    },
  };
}
