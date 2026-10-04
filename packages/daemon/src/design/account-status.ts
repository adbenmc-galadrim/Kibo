import { type IntegrationId, type IntegrationStatus, KiboError, type KiboErrorCode } from "@kibo/schema";
import { baseStatus } from "../integrations/probes";
import type { SecretStore } from "../integrations/types";

export type LastError = { code: KiboErrorCode; message: string } | null;

export const errorOf = (e: unknown): { code: KiboErrorCode; message: string } => {
  if (e instanceof KiboError) return { code: e.code, message: e.detail };
  throw e;
};

export async function secretStatus(
  id: "figma" | "penpot",
  secrets: SecretStore,
): Promise<IntegrationStatus | null> {
  const availability = await secrets.availability();
  if (!availability.ok)
    return {
      ...baseStatus(id, "error"),
      error: { code: "SECRET_STORE_UNAVAILABLE", message: availability.reason },
    };
  if (!(await secrets.has(id)))
    return {
      ...baseStatus(id, "error"),
      error: { code: "NOT_CONNECTED", message: `${id} token is missing` },
    };
  return null;
}

export function connectedStatus(
  id: IntegrationId,
  account: string | null,
  lastError: LastError,
): IntegrationStatus {
  return lastError
    ? { ...baseStatus(id, "error"), account, error: lastError }
    : { ...baseStatus(id, "connected"), account };
}
