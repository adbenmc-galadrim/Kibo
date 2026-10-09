import type { PrInfo, PrState } from "@kibo/schema";
import { z } from "zod";

const GH_TIMEOUT_MS = 15_000;
const GhPr = z.object({
  number: z.number().int().positive(),
  url: z.string().url(),
  state: z.enum(["OPEN", "CLOSED", "MERGED"]),
  isDraft: z.boolean(),
  baseRefName: z.string().nullable().optional(),
  headRefName: z.string().nullable().optional(),
});

function prState(pr: z.infer<typeof GhPr>): PrState {
  if (pr.state === "MERGED") return "merged";
  if (pr.state === "CLOSED") return "closed";
  return pr.isDraft ? "draft" : "open";
}

async function readPr(url: string): Promise<PrInfo> {
  const proc = Bun.spawn(
    ["gh", "pr", "view", url, "--json", "number,url,state,isDraft,baseRefName,headRefName"],
    {
      stdin: "ignore",
      stdout: "pipe",
      stderr: "pipe",
      signal: AbortSignal.timeout(GH_TIMEOUT_MS),
    },
  );
  const [out, err, code] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ]);
  if (code !== 0) throw new Error(err.trim() || `gh exited with ${code}`);
  const pr = GhPr.parse(JSON.parse(out));
  return {
    number: pr.number,
    url: pr.url,
    state: prState(pr),
    base: pr.baseRefName ?? null,
    head: pr.headRefName ?? null,
  };
}

export async function readPrs(
  repoUrl: string,
  numbers: readonly number[],
  warn: (message: string) => void,
): Promise<Map<number, PrInfo>> {
  const prs = new Map<number, PrInfo>();
  for (const n of [...new Set(numbers)].sort((a, b) => a - b)) {
    try {
      prs.set(n, await readPr(`${repoUrl}/pull/${n}`));
    } catch (e) {
      warn(`PR #${n} unreadable by gh, imported as open: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  return prs;
}
