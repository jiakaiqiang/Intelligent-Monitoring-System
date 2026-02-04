// Test setup file
import { vi } from 'vitest';

// Mock global objects
global.describe = describe;
global.it = it;
global.expect = expect;
global.beforeEach = beforeEach;
global.afterEach = afterEach;
global.vi = vi;

// Mock console methods in test environment
if (process.env.NODE_ENV === 'test') {
  console.warn = vi.fn();
  console.error = vi.fn();
}