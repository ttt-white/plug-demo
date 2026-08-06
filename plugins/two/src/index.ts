import {
  createPluginContributions,
  PLUGIN_API_VERSION,
  type PluginMessagePayload,
  type WorkspacePlugin,
} from '@tt-plug/plugin-sdk';
import { oneNestedTarget, twoContract, type TwoPluginContract } from './contract';
import { contributions } from './contributions';

export { twoContract, type PluginMessagePayload, type TwoPluginContract };

export const plugin: WorkspacePlugin = {
  manifest: {
    id: twoContract.pluginId,
    name: 'two',
    version: '1.0.0',
    apiVersion: PLUGIN_API_VERSION,
    description: '演示插件页面、消息接收和扩展插槽。',
    provides: { capabilities: [{ id: 'demo.receive-message', version: '1.0.0' }] },
    requires: {
      plugins: [{ id: oneNestedTarget.pluginId, range: '^1.0.0', optional: true }],
    },
  },
  contract: twoContract,
  // 路由和开放插槽都来自 contributions.tsx 的声明树。
  ...createPluginContributions(contributions, { pluginId: twoContract.pluginId }),
};
