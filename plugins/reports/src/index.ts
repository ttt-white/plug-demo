import { PLUGIN_API_VERSION, type WorkspacePlugin } from '@fms/plugin-sdk';

export const plugin: WorkspacePlugin = {
  manifest: {
    id: 'reports-page',
    name: '履约报表页面',
    version: '1.0.0',
    apiVersion: PLUGIN_API_VERSION,
    description: '提供独立路由的履约明细与筛选能力。',
  },
  routes: [
    {
      id: 'reports',
      path: '/reports',
      permission: 'reports:view',
      menu: { label: '履约报表', icon: 'chart-no-axes-column', order: 30 },
      load: () => import('./ReportsPage'),
    },
  ],
};

export default plugin;
