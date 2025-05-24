/**
 * 에러 핸들링 유틸리티
 */

export class NotionError extends Error {
  constructor(
    message: string,
    public code?: string,
    public status?: number,
  ) {
    super(message);
    this.name = 'NotionError';
  }
}

export class ContentError extends Error {
  constructor(
    message: string,
    public contentId?: string,
  ) {
    super(message);
    this.name = 'ContentError';
  }
}

/**
 * 에러 로깅 함수
 */
export function logError(error: unknown, context?: string): void {
  const timestamp = new Date().toISOString();
  const contextStr = context ? `[${context}]` : '';

  if (error instanceof Error) {
    console.error(`${timestamp} ${contextStr} ${error.name}: ${error.message}`);
    if (error.stack) {
      console.error(error.stack);
    }
  } else {
    console.error(`${timestamp} ${contextStr} Unknown error:`, error);
  }
}

/**
 * 안전한 Promise 실행
 */
export async function safeAsync<T>(
  promise: Promise<T>,
  errorMessage?: string,
): Promise<[T, null] | [null, Error]> {
  try {
    const data = await promise;
    return [data, null];
  } catch (error) {
    if (error instanceof Error) {
      return [null, error];
    }
    return [null, new Error(errorMessage || 'Unknown error occurred')];
  }
}

/**
 * 재시도 로직
 */
export async function retry<T>(
  fn: () => Promise<T>,
  options: {
    maxAttempts?: number;
    delay?: number;
    backoff?: boolean;
    onRetry?: (error: Error, attempt: number) => void;
  } = {},
): Promise<T> {
  const { maxAttempts = 3, delay = 1000, backoff = true, onRetry } = options;

  let lastError: Error;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error('Unknown error');

      if (attempt === maxAttempts) {
        throw lastError;
      }

      if (onRetry) {
        onRetry(lastError, attempt);
      }

      const waitTime = backoff ? delay * Math.pow(2, attempt - 1) : delay;
      await new Promise((resolve) => setTimeout(resolve, waitTime));
    }
  }

  throw lastError!;
}
