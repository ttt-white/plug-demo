import { PLUGIN_API_VERSION, type WorkspacePlugin } from '@fms/plugin-sdk';
import { twoContract } from './contract';

export { twoContract, type TwoFilterCarrierPayload, type TwoPluginContract } from './contract';

export const plugin: WorkspacePlugin = {
  manifest: {
    id: twoContract.pluginId,
    name: 'two',
    version: '1.0.0',
    apiVersion: PLUGIN_API_VERSION,
    description: '提供独立路由的履约明细与筛选能力。',
  },
  routes: [
    {
      id: twoContract.routes.two.routeId,
      path: twoContract.routes.two.path,
      permission: 'reports:view',
      menu: { label: 'two', icon: 'chart-no-axes-column', order: 30 },
      load: () => import('./TwoPage'),
    },
  ],
  extensionSlots: [
    {
      id: twoContract.slots.summary.slotId,
      routeId: twoContract.slots.summary.routeId,
      description: '允许其他插件向履约报表页面增加业务摘要模块。',
    },
  ],
};

export default plugin;
