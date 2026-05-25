type FetchFunction<T> = () => Promise<T>;

async function withTimeout<T>(fn: FetchFunction<T>, timeoutMs: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Timeout after ${timeoutMs}ms`));
    }, timeoutMs);

    fn()
      .then((result) => {
        clearTimeout(timer);
        resolve(result);
      })
      .catch((error) => {
        clearTimeout(timer);
        reject(error);
      });
  });
}

export async function resilientGeminiCall(
  fn: FetchFunction<string>,
  fallback: string,
  timeoutMs = 8000
): Promise<{ result: string; wasOffline: boolean }> {
  try {
    const result = await withTimeout(fn, timeoutMs);
    return { result, wasOffline: false };
  } catch (error) {
    console.error('Gemini call failed, using fallback:', error);
    return { result: fallback, wasOffline: true };
  }
}

export async function resilientSupabaseQuery<T>(
  fn: FetchFunction<T>,
  fallback: T,
  timeoutMs = 5000
): Promise<{ result: T; wasOffline: boolean }> {
  try {
    const result = await withTimeout(fn, timeoutMs);
    return { result, wasOffline: false };
  } catch (error) {
    console.error('Supabase query failed, using fallback:', error);
    return { result: fallback, wasOffline: true };
  }
}
