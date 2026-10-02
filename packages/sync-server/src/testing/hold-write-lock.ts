const LOCKER = `
import { Database } from "bun:sqlite";
const db = new Database(process.env.KIBO_LOCK_FILE);
db.exec("BEGIN IMMEDIATE");
console.log("locked");
Bun.sleepSync(Number(process.env.KIBO_LOCK_MS));
db.exec("COMMIT");
db.close();
`;

export type HeldWriteLock = { released: Promise<number> };

export async function holdWriteLock(file: string, ms: number): Promise<HeldWriteLock> {
  const child = Bun.spawn([process.execPath, "-e", LOCKER], {
    env: { ...process.env, KIBO_LOCK_FILE: file, KIBO_LOCK_MS: String(ms) },
    stdout: "pipe",
    stderr: "inherit",
  });
  const reader = child.stdout.getReader();
  const decoder = new TextDecoder();
  let seen = "";
  while (!seen.includes("locked")) {
    const chunk = await reader.read();
    if (chunk.done) throw new Error(`lock holder exited before locking ${file}`);
    seen += decoder.decode(chunk.value);
  }
  reader.releaseLock();
  return { released: child.exited };
}
