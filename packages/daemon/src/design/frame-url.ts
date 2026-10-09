import { KiboError, type ParsedDesignUrl, parseDesignUrl } from "@kibo/schema";
import { isLoopbackHost } from "../integrations/net";

function penpotInstanceAllowed(instance: string, configured: string | null): boolean {
  const u = new URL(instance);
  if (u.protocol === "https:" && isLoopbackHost(u.hostname)) return false;
  return configured === null || u.origin === configured;
}

export function parseFrameUrl(raw: string, penpotInstance: string | null): ParsedDesignUrl {
  const parsed = parseDesignUrl(raw);
  if (!parsed) throw new KiboError("INVALID_INPUT", "not a figma, penpot or storybook frame url");
  if (parsed.key.provider === "penpot" && !penpotInstanceAllowed(parsed.key.instance, penpotInstance))
    throw new KiboError("INVALID_INPUT", "penpot frame of an instance that is not configured");
  return parsed;
}
