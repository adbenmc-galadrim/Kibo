import { createHash } from "node:crypto";
import type { Hasher } from "@kibo/core";

export const sha256Hex: Hasher = (text) => createHash("sha256").update(text, "utf8").digest("hex");
