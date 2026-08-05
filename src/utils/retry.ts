/**
 * Options for the retry utility
 */
export interface RetryOptions {
  /**
   * Maximum number of retry attempts.
   * @default 3
   */
  maxRetries?: number;
  /**
   * Base delay between retries in milliseconds.
   * @default 1000
   */
  baseDelay?: number;
  /**
   * Maximum delay between retries in milliseconds.
   * @default 30000
   */
  maxDelay?: number;
  /**
   * Exponential factor for calculating the next delay.
   * @default 2
   */
  factor?: number;
  /**
   * Whether to add jitter to the delay to prevent thundering herd problem.
   * @default true
   */
  jitter?: boolean;
  /**
   * Function to determine if an error is retryable.
   * @default () => true (all errors are retryable by default)
   */
  shouldRetry?: (error: unknown) => boolean;
  /**
   * Callback called before each retry attempt.
   */
  onRetry?: (error: unknown, attempt: number, delayMs: number) => void;
}

const defaultOptions: Required<Omit<RetryOptions, 'shouldRetry' | 'onRetry'>> = {
  maxRetries: 3,
  baseDelay: 1000,
  maxDelay: 30000,
  factor: 2,
  jitter: true,
};

/**
 * Executes a promise-returning function with automatic retries and exponential backoff.
 * 
 * @param fn The function to execute
 * @param options Retry options
 * @returns The result of the function
 */
export const retry = async <T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> => {
  const config = { ...defaultOptions, ...options };
  const { maxRetries, baseDelay, maxDelay, factor, jitter, shouldRetry, onRetry } = config;
  
  let attempt = 0;

  // eslint-disable-next-line no-constant-condition
  while (true) {
    try {
      return await fn();
    } catch (error) {
      attempt++;

      const isRetryable = shouldRetry ? shouldRetry(error) : true;

      if (attempt > maxRetries || !isRetryable) {
        throw error;
      }

      // Calculate exponential backoff delay
      let delay = Math.min(baseDelay * Math.pow(factor, attempt - 1), maxDelay);
      
      // Add jitter if enabled (randomize up to 10% of delay)
      if (jitter) {
        delay = delay + (delay * 0.1 * Math.random());
      }

      if (onRetry) {
        onRetry(error, attempt, delay);
      }

      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
};
