import { z } from "zod";

export const T3_THREAD_STATUSES = ["running", "waiting", "done", "failed"] as const;
export type T3ThreadStatus = (typeof T3_THREAD_STATUSES)[number];

const T3_LINK_PREFIX = "t3-thread://";

export function normalizeT3Link(raw: string | undefined): string {
  const link = (raw ?? "").trim().replace(/^<(.*)>$/, "$1");
  return link.startsWith(T3_LINK_PREFIX) ? link : "";
}

export const T3ThreadLink = z.string().optional().transform(normalizeT3Link);

export const T3Thread = z.object({
  threadId: z.string(),
  link: z.string().transform(normalizeT3Link),
  title: z.string(),
  status: z.enum(T3_THREAD_STATUSES),
  startedAt: z.number(),
  checkedAt: z.number(),
});
export type T3Thread = z.infer<typeof T3Thread>;

export const isActiveT3Status = (status: string): boolean => status === "running" || status === "waiting";
