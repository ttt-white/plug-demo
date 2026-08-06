import { createPluginContributions, PLUGIN_API_VERSION, type WorkspacePlugin } from '@tt-plug/plugin-sdk';
import { oneContract, twoTarget, type OnePluginContract } from './contract';
import { contributions } from './contributions';

export { oneContract, type OnePluginContract };

export const plugin: WorkspacePlugin = {
  manifest: {
    id: oneContract.pluginId,
    name: 'one',
    version: '1.0.0',
    apiVersion: PLUGIN_API_VERSION,
    description: '向宿主工作台注入一个最小模块，并在 two 页面里开放一个可嵌套的插槽。',
    requires: {
      plugins: [{ id: twoTarget.pluginId, range: '^1.0.0', optional: true }],
    },
  },
  contract: oneContract,
  // 模块来自 contributions.tsx 的声明树。
  ...createPluginContributions(contributions, { pluginId: oneContract.pluginId }),
};
