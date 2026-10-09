import {
  capPermission,
  EMBED_ATTRIBUTES,
  EMBED_TTL_MS,
  type EmbedKind,
  type EmbedView,
  embedTargetProblem,
  KiboError,
  type KiboErrorCode,
} from "@kibo/schema";
import type { KiboSdk } from "./types";

export type MockEmbedOptions = { error?: KiboErrorCode };
export type MockEmbeds = { calls: string[]; open(url: string): EmbedView };
type Recorder = <T>(permission: string, label: string, work: () => Promise<T>) => Promise<T>;
type FrameApis = Pick<KiboSdk, "design" | "embed">;

export function mockEmbedView(url: string, n: number, kind: EmbedKind = "game", now = Date.now()): EmbedView {
  return {
    url: `about:blank#embed-${n}`,
    kind,
    ...EMBED_ATTRIBUTES[kind],
    expiresAt: now + EMBED_TTL_MS,
    target: url,
  };
}

export function createMockEmbeds(embeds: readonly string[], opts: MockEmbedOptions = {}): MockEmbeds {
  const calls: string[] = [];
  return {
    calls,
    open(url) {
      calls.push(url);
      const problem = embedTargetProblem(url, embeds);
      if (problem) throw new KiboError("PERMISSION_DENIED", `embed target refused (${problem})`);
      if (opts.error) throw new KiboError(opts.error, "mock embed error");
      return mockEmbedView(url, calls.length);
    },
  };
}

export function recordedFrameApis(inner: FrameApis, record: Recorder): FrameApis {
  const design = capPermission("design");
  const embed = capPermission("embed");
  return {
    design: {
      frame: (url, opts) => record(design, design, () => inner.design.frame(url, opts)),
      storybooks: () => record(design, design, () => inner.design.storybooks()),
    },
    embed: { open: (url) => record(embed, embed, () => inner.embed.open(url)) },
  };
}
