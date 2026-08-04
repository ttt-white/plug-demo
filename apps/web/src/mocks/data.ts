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
  reporter: {
    password: 'reporter123',
    token: 'mock-reporter-token',
    user: {
      id: 'user-reporter',
      username: 'reporter',
      displayName: '报表专员',
      role: 'reporter',
      permissions: ['reports:view'],
    },
  },
};

export const dashboardData = {
  updatedAt: '2026-07-29 10:30',
  inTransit: 28,
  pendingDispatch: 6,
  exceptions: 3,
  completedToday: 42,
  onTimeRate: 96.7,
  metrics: [
    { id: 'revenue', label: '本月结算额', value: '¥ 1.28M', change: 12.8 },
    { id: 'orders', label: '今日运输单', value: '326', change: 8.4 },
    { id: 'ontime', label: '准时交付率', value: '96.7%', change: -0.6 },
  ],
};

export const reportsData = {
  updatedAt: '2026-07-29 10:30',
  total: 4,
  rows: [
    {
      id: 'FMS-20260729-018',
      origin: '江苏 · 苏州',
      destination: '上海 · 浦东',
      carrier: '东驰物流',
      status: '运输中',
      amount: 18600,
      updatedAt: '10:24',
    },
    {
      id: 'FMS-20260729-012',
      origin: '上海 · 嘉定',
      destination: '江苏 · 苏州',
      carrier: '华运供应链',
      status: '已完成',
      amount: 12450,
      updatedAt: '09:52',
    },
    {
      id: 'FMS-20260728-096',
      origin: '江苏 · 无锡',
      destination: '浙江 · 宁波',
      carrier: '东驰物流',
      status: '待处理',
      amount: 8920,
      updatedAt: '08:41',
    },
    {
      id: 'FMS-20260728-073',
      origin: '浙江 · 杭州',
      destination: '安徽 · 合肥',
      carrier: '捷航运输',
      status: '已完成',
      amount: 21300,
      updatedAt: '昨天',
    },
  ],
  facets: {
    carriers: ['东驰物流', '华运供应链', '捷航运输'],
    statuses: ['待处理', '运输中', '已完成', '异常'],
  },
};

export const carrierRatingsData = {
  updatedAt: '2026-07-30 14:20',
  rows: [
    {
      id: 'carrier-001',
      carrier: '东驰物流',
      level: 'A',
      score: 96,
      onTimeRate: 98.2,
      incidents: 1,
      trend: 2.4,
      risk: 'low',
    },
    {
      id: 'carrier-002',
      carrier: '华运供应链',
      level: 'A',
      score: 91,
      onTimeRate: 95.8,
      incidents: 2,
      trend: 1.1,
      risk: 'low',
    },
    {
      id: 'carrier-003',
      carrier: '捷航运输',
      level: 'B',
      score: 84,
      onTimeRate: 91.6,
      incidents: 5,
      trend: -0.8,
      risk: 'medium',
    },
    {
      id: 'carrier-004',
      carrier: '北辰货运',
      level: 'C',
      score: 72,
      onTimeRate: 86.4,
      incidents: 9,
      trend: -3.2,
      risk: 'high',
    },
  ],
};

const PLUGIN_STATE_KEY = 'fms.mock.plugin-states';
export function readPluginStates(installedPluginIds: readonly string[]) {
  const defaultPluginStates = installedPluginIds.map((id) => ({ id, enabled: true }));
  try {
    const stored = localStorage.getItem(PLUGIN_STATE_KEY);
    if (!stored) return defaultPluginStates;
    const parsed = JSON.parse(stored) as unknown;
    if (!Array.isArray(parsed)) return defaultPluginStates;
    const storedById = new Map(
      parsed
        .filter(
          (state): state is { id: string; enabled: boolean } =>
            typeof state === 'object' && state !== null && typeof state.id === 'string' && typeof state.enabled === 'boolean',
        )
        .map((state) => [state.id, state.enabled]),
    );
    return defaultPluginStates.map((state) => ({ ...state, enabled: storedById.get(state.id) ?? state.enabled }));
  } catch {
    return defaultPluginStates;
  }
}

export function writePluginState(id: string, enabled: boolean, installedPluginIds: readonly string[]) {
  const states = readPluginStates(installedPluginIds);
  const next = states.map((state) => (state.id === id ? { ...state, enabled } : state));
  localStorage.setItem(PLUGIN_STATE_KEY, JSON.stringify(next));
  return next;
}
