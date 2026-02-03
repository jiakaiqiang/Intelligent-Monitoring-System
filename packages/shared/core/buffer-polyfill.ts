// 在浏览器环境中的 Buffer 兼容性声明
declare const Buffer: {
  byteLength(string: string, encoding?: string): number;
} | undefined;

// 如果 Buffer 未定义，创建一个 polyfill
if (typeof Buffer === 'undefined') {
  (globalThis as any).Buffer = {
    byteLength: (string: string) => {
      // Base64 编码的内容大约是原始内容的 4/3
      return Math.ceil((string.length * 3) / 4);
    }
  };
}