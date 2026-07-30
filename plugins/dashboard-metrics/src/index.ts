import { PLUGIN_API_VERSION, type WorkspacePlugin } from '@fms/plugin-sdk';

export const plugin: WorkspacePlugin = {
  manifest: {
    id: 'dashboard-metrics',
    name: '经营指标模块',
    version: '1.0.0',
    apiVersion: PLUGIN_API_VERSION,
    description: '在工作台中展示核心业务指标。',
  },
  modules: [
    {
      id: 'dashboard-metrics.summary',
      routeId: 'dashboard',
      slotId: 'dashboard.metrics',
      permission: 'dashboard:metrics:view',
      priority: 100,
      load: () => import('./MetricsModule'),
    },
  ],
};

export default plugin;
