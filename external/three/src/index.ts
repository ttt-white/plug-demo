import { twoContract } from '@fms/plugin-two';
import { PLUGIN_API_VERSION, type WorkspacePlugin } from '@fms/plugin-sdk';
import { threeContract } from './contract';

export { threeContract, type ThreePluginContract } from './contract';

export const plugin: WorkspacePlugin = {
  manifest: {
    id: threeContract.pluginId,
    name: 'three',
    version: '1.0.0',
    apiVersion: PLUGIN_API_VERSION,
    description: '来自独立代码仓库的承运商服务质量评级页面。',
  },
  routes: [
    {
      id: threeContract.routes.three.routeId,
      path: '/carrier-ratings',
      permission: 'carrier-ratings:view',
      menu: { label: 'three', icon: 'badge-check', order: 35 },
      load: () => import('./ThreePage'),
    },
  ],
  routeLinks: [
    {
      id: 'two.three',
      parentRoute: twoContract.routes.two,
      targetRoute: threeContract.routes.three,
      permission: 'carrier-ratings:view',
      menu: { label: 'three', icon: 'badge-check', order: 10 },
    },
  ],
  modules: [
    {
      id: 'three.two-summary',
      targetPluginId: twoContract.slots.summary.pluginId,
      routeId: twoContract.slots.summary.routeId,
      slotId: twoContract.slots.summary.slotId,
      permission: 'carrier-ratings:view',
      priority: 20,
      load: () => import('./ThreeTwoModule'),
    },
  ],
};

export default plugin;
