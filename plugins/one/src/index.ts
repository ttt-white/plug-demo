import { PLUGIN_API_VERSION, type WorkspacePlugin } from '@fms/plugin-sdk';
import { oneContract } from './contract';

export { oneContract, type OnePluginContract } from './contract';

export const plugin: WorkspacePlugin = {
  manifest: {
    id: oneContract.pluginId,
    name: 'one',
    version: '1.0.0',
    apiVersion: PLUGIN_API_VERSION,
    description: '在工作台中展示核心业务指标。',
  },
  modules: [
    {
      id: 'one.module',
      routeId: oneContract.targets.dashboardMetrics.routeId,
      slotId: oneContract.targets.dashboardMetrics.slotId,
      permission: 'dashboard:metrics:view',
      priority: 100,
      load: () => import('./OneModule'),
    },
  ],
};

export default plugin;
