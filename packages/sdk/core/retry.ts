/**
 * 重试管理器类
 * 提供带指数退避策略的异步函数重试机制
 */
export class RetryManager {
  // 最大重试次数，默认为3次
  private maxRetries = 3;
  // 基础延迟时间（毫秒），默认为1000ms
  private baseDelay = 1000;

  /**
   * 执行带重试机制的异步函数
   * @param fn - 需要执行的异步函数
   * @returns 异步函数的返回结果
   * @throws 如果所有重试都失败，则抛出最后一次的错误
   */
  async retry<T>(fn: () => Promise<T>): Promise<T> {
    // 存储最后一次发生的错误
    let lastError: Error;

    // 循环执行重试，包括初始执行（所以是 <= maxRetries）
    for (let i = 0; i <= this.maxRetries; i++) {
      try {
        // 尝试执行函数并返回结果
        return await fn();
      } catch (error) {
        // 记录当前错误
        lastError = error as Error;
        // 如果还有重试机会，则等待一段时间后继续重试
        if (i < this.maxRetries) {
          // 使用指数退避策略计算延迟时间：baseDelay * 2^i
          await this.delay(this.baseDelay * Math.pow(2, i));
        }
      }
    }

    // 所有重试都失败，抛出最后一次错误
    throw lastError!;
  }

  /**
   * 延迟指定的毫秒数
   * @param ms - 需要延迟的毫秒数
   * @returns Promise，在指定时间后解决
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
