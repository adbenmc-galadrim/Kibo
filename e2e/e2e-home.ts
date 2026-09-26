import { tmpdir } from "node:os";
import { join } from "node:path";

export const e2eHome = (port: string) => join(tmpdir(), `kibo-e2e-${port}`);
