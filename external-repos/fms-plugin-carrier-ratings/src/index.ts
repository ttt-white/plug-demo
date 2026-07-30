import { PLUGIN_API_VERSION, type WorkspacePlugin } from '@fms/plugin-sdk';

export const plugin: WorkspacePlugin = {
  manifest: {
    id: 'carrier-ratings-page',
    name: '承运商评级',
    version: '1.0.0',
    apiVersion: PLUGIN_API_VERSION,
    description: '来自独立代码仓库的承运商服务质量评级页面。',
  },
  routes: [
    {
      id: 'carrier-ratings',
      path: '/carrier-ratings',
      permission: 'carrier-ratings:view',
      menu: { label: '承运商评级', icon: 'badge-check', order: 35 },
      load: () => import('./CarrierRatingsPage'),
    },
  ],
};

export default plugin;
