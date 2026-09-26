import type { OsSandbox } from "@kibo/devkit";
import type { ChangeMessage, SandboxStatus } from "@kibo/schema";
import { z } from "zod";
import type { LocalSettings } from "../settings";

export const ALLOW_UNSANDBOXED_KEY = "sandbox.allowUnsandboxed";

export type SandboxService = {
  status(): Promise<SandboxStatus>;
  allowUnsandboxed(): boolean;
  setAllowUnsandboxed(allow: boolean): Promise<SandboxStatus>;
};

export function createSandboxService(deps: {
  sandbox: Pick<OsSandbox, "diagnose">;
  settings: LocalSettings;
  emit(message: ChangeMessage): void;
  log?: (line: string) => void;
}): SandboxService {
  const log = deps.log ?? ((line: string) => console.error(`[kibo-daemon] ${line}`));
  const allowUnsandboxed = () => deps.settings.get(ALLOW_UNSANDBOXED_KEY, z.boolean(), false);
  const status = async (): Promise<SandboxStatus> => ({
    ...(await deps.sandbox.diagnose()),
    allowUnsandboxed: allowUnsandboxed(),
  });
  return {
    status,
    allowUnsandboxed,
    async setAllowUnsandboxed(allow) {
      deps.settings.set(ALLOW_UNSANDBOXED_KEY, allow);
      log(`sandboxed backends without OS isolation: ${allow ? "allowed" : "refused"} by a local session`);
      deps.emit({ type: "sandbox.changed" });
      return status();
    },
  };
}
