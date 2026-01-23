export class RetryManager {
  private maxRetries = 3;
  private baseDelay = 1000;

  async retry<T>(fn: () => Promise<T>): Promise<T> {
    let lastError: Error;

    for (let i = 0; i <= this.maxRetries; i++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error as Error;
        if (i < this.maxRetries) {
          await this.delay(this.baseDelay * Math.pow(2, i));
        }
      }
    }

    throw lastError!;
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
