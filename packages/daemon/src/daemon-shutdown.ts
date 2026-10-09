export type Closer = () => void | Promise<void>;
export type Closers = { front: Closer[]; back: Closer[] };

async function closeAll(closers: Closer[]): Promise<void> {
  const failures: unknown[] = [];
  for (const close of closers.splice(0).reverse()) {
    try {
      await close();
    } catch (e) {
      failures.push(e);
    }
  }
  if (failures.length > 0) throw new AggregateError(failures, "daemon shutdown failed");
}

export async function shutdown(closers: Closers): Promise<void> {
  try {
    await closeAll(closers.front);
  } finally {
    await closeAll(closers.back);
  }
}
