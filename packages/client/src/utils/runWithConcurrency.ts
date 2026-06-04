export async function runWithConcurrency<T>(
  items: T[],
  concurrency: number,
  task: (item: T) => Promise<unknown>
): Promise<void> {
  const workerCount = Math.max(1, Math.min(concurrency, items.length));
  let nextIndex = 0;

  async function worker(): Promise<void> {
    while (nextIndex < items.length) {
      const item = items[nextIndex];
      nextIndex += 1;
      if (item !== undefined) {
        await task(item);
      }
    }
  }

  await Promise.all(Array.from({ length: workerCount }, worker));
}
