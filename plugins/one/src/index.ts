import { PLUGIN_API_VERSION, type WorkspacePlugin } from '@tt-plug/plugin-sdk';
import { oneContract, type OnePluginContract } from './contract';

export { oneContract, type OnePluginContract };

export const plugin: WorkspacePlugin = {
  manifest: {
    id: oneContract.pluginId,
    name: 'one',
    version: '1.0.0',
    apiVersion: PLUGIN_API_VERSION,
    description: '向宿主工作台注入一个最小模块。',
  },
  contract: oneContract,
  modules: [
    {
      id: 'one.module',
      routeId: oneContract.targets.dashboard.routeId,
      slotId: oneContract.targets.dashboard.slotId,
      permission: 'dashboard:view',
      priority: 100,
      load: () => import('./OneModule'),
    },
  ],
};
