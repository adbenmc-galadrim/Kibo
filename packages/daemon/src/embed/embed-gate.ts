import { EMBED_URL_MAX, embedTargetProblem, KiboError } from "@kibo/schema";
import type { EmbedChecker, EmbedGate, EmbedService } from "./types";

export function createEmbedGate(deps: {
  service: Pick<EmbedService, "open">;
  checker: EmbedChecker;
}): EmbedGate {
  return {
    async open(ctx, url, refresh = false) {
      if (url.length > EMBED_URL_MAX) throw new KiboError("INVALID_INPUT", "embed url too long");
      const problem = embedTargetProblem(url, ctx.manifest.embeds);
      if (problem !== null) throw new KiboError("PERMISSION_DENIED", `embed target refused (${problem})`);
      const target = new URL(url);
      await deps.checker.check(target.href, refresh);
      return deps.service.open(ctx.instanceId, "game", target.href, target.hostname);
    },
  };
}
