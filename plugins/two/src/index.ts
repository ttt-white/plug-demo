import { PLUGIN_API_VERSION, type PluginMessagePayload, type WorkspacePlugin } from '@tt-plug/plugin-sdk';
import { twoContract, type TwoPluginContract } from './contract';

export { twoContract, type PluginMessagePayload, type TwoPluginContract };

export const plugin: WorkspacePlugin = {
  manifest: {
    id: twoContract.pluginId,
    name: 'two',
    version: '1.0.0',
    apiVersion: PLUGIN_API_VERSION,
    description: '演示插件页面、消息接收和扩展插槽。',
    provides: { capabilities: [{ id: 'demo.receive-message', version: '1.0.0' }] },
  },
  contract: twoContract,
  routes: [
    {
      id: twoContract.routes.page.routeId,
      path: twoContract.routes.page.path,
      permission: 'demo:two:view',
      menu: { label: '页面插件 two', icon: 'blocks', order: 30 },
      load: () => import('./TwoPage'),
    },
  ],
  extensionSlots: [
    {
      id: twoContract.slots.demo.slotId,
      routeId: twoContract.slots.demo.routeId,
      description: '允许其他插件向 two 页面注入演示模块。',
    },
  ],
};
