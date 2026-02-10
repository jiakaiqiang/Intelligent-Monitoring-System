// Test setup file
import 'reflect-metadata';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

// Mock global objects
const globalAny = globalThis as Record<string, unknown>;

globalAny.describe = describe;
globalAny.it = it;
globalAny.expect = expect;
globalAny.beforeEach = beforeEach;
globalAny.afterEach = afterEach;
globalAny.vi = vi;

// Mock console methods in test environment
if (process.env.NODE_ENV === 'test') {
  console.warn = vi.fn();
  console.error = vi.fn();
}
