import type { Question } from "@kibo/schema";
import {
  type ImageFs,
  nodeImageFs,
  type PreparedImage,
  prepareQuestionImages,
  type QuestionImageFile,
  readQuestionImage,
  storeQuestionImages,
} from "./question-images";

export type QuestionImageDeps = {
  home: string;
  notesDir(projectId: string): string | null;
  fs: ImageFs;
  log(line: string): void;
};

export type QuestionImagesPort = {
  prepare(projectId: string, cwd: string | null, paths: readonly string[]): PreparedImage[];
  store(question: Question, prepared: readonly PreparedImage[]): void;
};

const unsupported = (count: number) =>
  console.warn(`[kibo-daemon] ${count} image(s) de question omise(s) : stockage des images absent`);

export function questionImagesOf(
  deps: QuestionImageDeps | null,
  deliveryRoot: (projectId: string) => string | null,
): QuestionImagesPort {
  return {
    prepare(projectId, cwd, paths) {
      if (paths.length === 0) return [];
      if (!deps) {
        unsupported(paths.length);
        return [];
      }
      const allowedRoots = [cwd, deliveryRoot(projectId), deps.notesDir(projectId)];
      return prepareQuestionImages({ paths, allowedRoots, fs: deps.fs, log: deps.log });
    },
    store(question, prepared) {
      const ids = new Set(question.images.map((image) => image.id));
      const own = prepared.filter((p) => ids.has(p.image.id));
      if (!deps || own.length === 0) return;
      try {
        storeQuestionImages({ home: deps.home, questionId: question.id, images: own, fs: deps.fs });
      } catch (e) {
        deps.log(
          `images de la question ${question.id} non copiées : ${e instanceof Error ? e.message : String(e)}`,
        );
      }
    },
  };
}

export function questionImageFiles(
  home: string,
  notesDir: (projectId: string) => string | null,
): QuestionImageDeps & { read(questionId: string, imageId: string): QuestionImageFile | null } {
  return {
    home,
    notesDir,
    fs: nodeImageFs,
    log: (line) => console.warn(`[kibo-daemon] ${line}`),
    read: (questionId, imageId) => readQuestionImage({ home, questionId, imageId, fs: nodeImageFs }),
  };
}
