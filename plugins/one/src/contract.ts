import { hostContract, type HostSlotReference, type PluginSlotReference } from '@tt-plug/plugin-sdk';

export interface OnePluginContract {
  readonly pluginId: 'one';
  readonly slots: {
    /**
     * one 注入到 two 页面的模块内部再开的插槽。
     *
     * 插槽的主人是 one（pluginId），位置在 two 的页面上（routeId）——两者不必相同，
     * 这正是模块能跨插件层层嵌套的原因。
     */
    readonly nested: PluginSlotReference<'one', 'two', 'one.nested'>;
  };
  readonly targets: {
    readonly dashboard: HostSlotReference<'dashboard', 'dashboard.demo'> & { readonly path: '/dashboard' };
  };
}

export const oneContract: OnePluginContract = {
  pluginId: 'one',
  slots: {
    nested: { pluginId: 'one', routeId: 'two', slotId: 'one.nested' },
  },
  targets: {
    dashboard: { ...hostContract.routes.dashboard, ...hostContract.slots.dashboard },
  },
};

// one 对 two 的期望。manifest 是静态结构，拿不到运行时下发的 runtime.contracts，
// 因此在本地声明目标；写错的目标会在宿主 contribution 阶段产生诊断。
export const twoTarget = {
  pluginId: 'two',
  routeId: 'two',
  slotId: 'two.demo',
} as const satisfies PluginSlotReference<'two', 'two', 'two.demo'>;

// 把契约类型登记进 SDK，其他插件即可通过 runtime.contracts.one 拿到精确类型。
declare module '@tt-plug/plugin-sdk' {
  interface WorkspacePluginContracts {
    one: OnePluginContract;
  }
}
