import type { DesignFrame } from "@kibo/schema";
import type { Size } from "./zoom";

export const sizeOf = (frame: DesignFrame): Size | null =>
  frame.width !== null && frame.height !== null ? { width: frame.width, height: frame.height } : null;
