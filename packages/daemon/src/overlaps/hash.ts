import { createHash } from "node:crypto";

export type Hasher = (text: string) => string;

export const sha256Hex: Hasher = (text) => createHash("sha256").update(text, "utf8").digest("hex");
