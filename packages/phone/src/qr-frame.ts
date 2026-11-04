import jsQR from "jsqr";

type Frame = { data: Uint8ClampedArray; width: number; height: number };

export const readQrFrame = (frame: Frame): string | null =>
  jsQR(frame.data, frame.width, frame.height, { inversionAttempts: "dontInvert" })?.data ?? null;
