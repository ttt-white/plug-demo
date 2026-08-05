import { vi } from 'vitest';

export const registerRemotes = vi.fn();

export const loadRemote = vi.fn(async <T>(id: string): Promise<T | null> => {
  if (id !== 'plugin_three/plugin') throw new Error(`测试未配置远程模块：${id}`);
  return (await import('plugin_three/plugin')) as T;
});
