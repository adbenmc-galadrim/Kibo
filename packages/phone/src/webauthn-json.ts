import type {
  PublicKeyCredentialCreationOptionsJSON,
  PublicKeyCredentialRequestOptionsJSON,
} from "@simplewebauthn/browser";
import { z } from "zod";

const Descriptor = z.object({
  id: z.string().min(1),
  type: z.literal("public-key"),
  transports: z.array(z.enum(["ble", "cable", "hybrid", "internal", "nfc", "smart-card", "usb"])).optional(),
});
const Hint = z.enum(["hybrid", "security-key", "client-device"]);
const Verification = z.enum(["discouraged", "preferred", "required"]);

export const CreationOptions = z.object({
  rp: z.object({ id: z.string().optional(), name: z.string() }),
  user: z.object({ id: z.string().min(1), name: z.string(), displayName: z.string() }),
  challenge: z.string().min(1),
  pubKeyCredParams: z.array(z.object({ alg: z.number(), type: z.literal("public-key") })),
  timeout: z.number().optional(),
  excludeCredentials: z.array(Descriptor).optional(),
  authenticatorSelection: z
    .object({
      authenticatorAttachment: z.enum(["platform", "cross-platform"]).optional(),
      requireResidentKey: z.boolean().optional(),
      residentKey: Verification.optional(),
      userVerification: Verification.optional(),
    })
    .optional(),
  hints: z.array(Hint).optional(),
  attestation: z.enum(["direct", "enterprise", "indirect", "none"]).optional(),
}) satisfies z.ZodType<PublicKeyCredentialCreationOptionsJSON>;

export const RequestOptions = z.object({
  challenge: z.string().min(1),
  timeout: z.number().optional(),
  rpId: z.string().optional(),
  allowCredentials: z.array(Descriptor).optional(),
  userVerification: Verification.optional(),
  hints: z.array(Hint).optional(),
}) satisfies z.ZodType<PublicKeyCredentialRequestOptionsJSON>;
