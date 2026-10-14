import { isImageFileId, type QuestionImageFile } from "./question-images";

export type QuestionImageRouteDeps = {
  read(questionId: string, imageId: string): QuestionImageFile | null;
  origins(): string[];
  hasSession(req: Request): boolean;
};

const IMAGE_PATH = /^\/api\/questions\/([^/]+)\/images\/([^/]+)$/;
const HEADERS = { "x-content-type-options": "nosniff", "cross-origin-resource-policy": "same-origin" };

const plain = (body: string, status: number) =>
  new Response(body, { status, headers: { ...HEADERS, "cache-control": "no-store" } });

export const isQuestionImagePath = (pathname: string): boolean => IMAGE_PATH.test(pathname);

function decodedId(raw: string | undefined): string | null {
  if (raw === undefined) return null;
  try {
    const id = decodeURIComponent(raw);
    return isImageFileId(id) ? id : null;
  } catch (e) {
    if (e instanceof URIError) return null;
    throw e;
  }
}

export function serveQuestionImage(req: Request, url: URL, deps: QuestionImageRouteDeps): Response {
  const origin = req.headers.get("origin");
  if (origin !== null && !deps.origins().includes(origin)) return plain("forbidden origin", 403);
  const site = req.headers.get("sec-fetch-site");
  if (site !== null && site !== "same-origin") return plain("forbidden site", 403);
  if (!deps.hasSession(req)) return plain("unauthorized", 401);
  const match = IMAGE_PATH.exec(url.pathname);
  const questionId = decodedId(match?.[1]);
  const imageId = decodedId(match?.[2]);
  if (req.method !== "GET" || questionId === null || imageId === null) return plain("not found", 404);
  const image = deps.read(questionId, imageId);
  if (!image) return plain("not found", 404);
  return new Response(image.bytes, {
    headers: { ...HEADERS, "content-type": image.mime, "cache-control": "private, max-age=86400" },
  });
}
