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
      permissions: ['dashboard:view', 'dashboard:metrics:view', 'reports:view', 'plugins:manage'],
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

export const dashboardData = {
  updatedAt: '2026-07-29 10:30',
  activeTasks: 28,
  alerts: 3,
  metrics: [
    { id: 'revenue', label: '本月结算额', value: '¥ 1.28M', change: 12.8 },
    { id: 'orders', label: '今日运输单', value: '326', change: 8.4 },
    { id: 'ontime', label: '准时交付率', value: '96.7%', change: -0.6 },
  ],
};

export const reportsData = {
  rows: [
    {
      id: 'FMS-20260729-018',
      destination: '上海 · 浦东',
      carrier: '东驰物流',
      status: '运输中',
      amount: '¥ 18,600',
      updatedAt: '10:24',
    },
    {
      id: 'FMS-20260729-012',
      destination: '江苏 · 苏州',
      carrier: '华运供应链',
      status: '已完成',
      amount: '¥ 12,450',
      updatedAt: '09:52',
    },
    {
      id: 'FMS-20260728-096',
      destination: '浙江 · 宁波',
      carrier: '东驰物流',
      status: '待处理',
      amount: '¥ 8,920',
      updatedAt: '08:41',
    },
    {
      id: 'FMS-20260728-073',
      destination: '安徽 · 合肥',
      carrier: '捷航运输',
      status: '已完成',
      amount: '¥ 21,300',
      updatedAt: '昨天',
    },
  ],
};

const PLUGIN_STATE_KEY = 'fms.mock.plugin-states';
const defaultPluginStates = [
  { id: 'dashboard-metrics', enabled: true },
  { id: 'reports-page', enabled: true },
];

export function readPluginStates() {
  try {
    const stored = localStorage.getItem(PLUGIN_STATE_KEY);
    if (!stored) return defaultPluginStates;
    const parsed = JSON.parse(stored) as unknown;
    return Array.isArray(parsed) ? (parsed as typeof defaultPluginStates) : defaultPluginStates;
  } catch {
    return defaultPluginStates;
  }
}

export function writePluginState(id: string, enabled: boolean) {
  const states = readPluginStates();
  const next = states.map((state) => (state.id === id ? { ...state, enabled } : state));
  localStorage.setItem(PLUGIN_STATE_KEY, JSON.stringify(next));
  return next;
}
