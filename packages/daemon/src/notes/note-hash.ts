import { createHash } from "node:crypto";

export const noteHashOf = (markdown: string): string => createHash("sha256").update(markdown).digest("hex");
