import { Texture } from "three";
import type { GLTFLoaderPlugin, GLTFParser } from "three/addons/loaders/GLTFLoader.js";
import { z } from "zod";

const EmbeddedImage = z.object({
  bufferView: z.number().int().nonnegative(),
  mimeType: z.string().optional(),
});
type EmbeddedImage = z.infer<typeof EmbeddedImage>;

async function decode(parser: GLTFParser, image: EmbeddedImage): Promise<Texture> {
  const bytes: unknown = await parser.getDependency("bufferView", image.bufferView);
  if (!(bytes instanceof ArrayBuffer))
    throw new Error(`glb image buffer view ${image.bufferView} is not binary`);
  const bitmap = await createImageBitmap(new Blob([bytes], { type: image.mimeType ?? "" }), {
    premultiplyAlpha: "none",
    colorSpaceConversion: "none",
  });
  const texture = new Texture(bitmap);
  texture.needsUpdate = true;
  texture.userData.mimeType = image.mimeType;
  return texture;
}

export function decodeEmbeddedImages(parser: GLTFParser): GLTFLoaderPlugin {
  const viaUrl = parser.loadImageSource.bind(parser);
  const decoded = new Map<number, Promise<Texture>>();
  parser.loadImageSource = (sourceIndex, loader) => {
    const image = EmbeddedImage.safeParse(parser.json?.images?.[sourceIndex]);
    if (!image.success || typeof createImageBitmap !== "function") return viaUrl(sourceIndex, loader);
    const pending =
      decoded.get(sourceIndex) ??
      decode(parser, image.data).catch((e: unknown) => {
        console.error("[kibo-three] embedded texture not decoded", e);
        throw e;
      });
    decoded.set(sourceIndex, pending);
    return pending.then((texture) => texture.clone());
  };
  return { name: "KIBO_embedded_images" };
}
