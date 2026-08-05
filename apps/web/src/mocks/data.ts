import type { DemoStatus } from '@fms/plugin-contracts';
import type { PluginUser } from '@fms/plugin-sdk';

interface MockAccount {
  password: string;
  token: string;
  user: PluginUser;
}

export const mockAccounts: Record<string, MockAccount> = {
  admin: {
    password: 'admin123',
    token: 'mock-admin-token',
    user: {
      id: 'user-admin',
      username: 'admin',
      displayName: '系统管理员',
      role: 'admin',
      permissions: ['*'],
    },
  },
  viewer: {
    password: 'viewer123',
    token: 'mock-viewer-token',
    user: {
      id: 'user-viewer',
      username: 'viewer',
      displayName: '普通用户',
      role: 'viewer',
      permissions: ['dashboard:view'],
    },
  },
};

export const demoStatus: DemoStatus = {
  message: '共享 API 已就绪',
  updatedAt: '2026-08-04 10:00',
};

const PLUGIN_STATE_KEY = 'fms.mock.plugin-states';

export function readPluginStates(installedPluginIds: readonly string[]) {
  const defaults = installedPluginIds.map((id) => ({ id, enabled: true }));
  try {
    const parsed = JSON.parse(localStorage.getItem(PLUGIN_STATE_KEY) ?? '[]') as unknown;
    if (!Array.isArray(parsed)) return defaults;
    const stored = new Map(
      parsed.flatMap((state) =>
        typeof state === 'object' && state !== null && typeof state.id === 'string' && typeof state.enabled === 'boolean'
          ? [[state.id, state.enabled] as const]
          : [],
      ),
    );
    return defaults.map((state) => ({ ...state, enabled: stored.get(state.id) ?? true }));
  } catch {
    return defaults;
  }
}

export function writePluginState(id: string, enabled: boolean, installedPluginIds: readonly string[]) {
  const next = readPluginStates(installedPluginIds).map((state) => (state.id === id ? { ...state, enabled } : state));
  localStorage.setItem(PLUGIN_STATE_KEY, JSON.stringify(next));
  return next;
}
