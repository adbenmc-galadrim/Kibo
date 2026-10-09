export type Closer = () => void | Promise<void>;
export type Closers = { front: Closer[]; back: Closer[] };

async function closeAll(closers: Closer[]): Promise<unknown[]> {
  const failures: unknown[] = [];
  for (const close of closers.splice(0).reverse()) {
    try {
      await close();
    } catch (e) {
      failures.push(e);
    }
  }
  return failures;
}

export async function shutdown(closers: Closers): Promise<void> {
  const failures = [...(await closeAll(closers.front)), ...(await closeAll(closers.back))];
  if (failures.length > 0) throw new AggregateError(failures, "daemon shutdown failed");
}
