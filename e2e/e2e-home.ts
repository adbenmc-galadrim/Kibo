import { tmpdir } from "node:os";
import { join } from "node:path";
import type { TestInfo } from "@playwright/test";

export const e2eHome = (port: string) => join(tmpdir(), `kibo-e2e-${port}`);

export function homeOf(info: TestInfo): string {
  const base = info.project.use.baseURL;
  if (!base) throw new Error(`project ${info.project.name} has no baseURL`);
  return e2eHome(new URL(base).port);
}
