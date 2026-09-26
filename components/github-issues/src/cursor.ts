import { z } from "zod";

export const RestCursor = z.object({
  mode: z.literal("rest"),
  since: z.string().nullable(),
  page: z.number().int().positive(),
});
export const ProjectCursor = z.object({
  mode: z.literal("project"),
  since: z.string().nullable(),
  after: z.string().nullable(),
  max: z.string().nullable(),
});
export type RestCursor = z.infer<typeof RestCursor>;
export type ProjectCursor = z.infer<typeof ProjectCursor>;

export function readRestCursor(raw: string | null): RestCursor {
  const parsed = raw === null ? null : RestCursor.safeParse(JSON.parse(raw));
  return parsed?.success ? parsed.data : { mode: "rest", since: null, page: 1 };
}

export function readProjectCursor(raw: string | null): ProjectCursor {
  const parsed = raw === null ? null : ProjectCursor.safeParse(JSON.parse(raw));
  return parsed?.success ? parsed.data : { mode: "project", since: null, after: null, max: null };
}
