import { hostContract, type HostSlotReference } from '@tt-plug/plugin-sdk';

export interface OnePluginContract {
  readonly pluginId: 'one';
  readonly targets: {
    readonly dashboard: HostSlotReference<'dashboard', 'dashboard.demo'> & { readonly path: '/dashboard' };
  };
}

export const oneContract: OnePluginContract = {
  pluginId: 'one',
  targets: {
    dashboard: { ...hostContract.routes.dashboard, ...hostContract.slots.dashboard },
  },
};

// 把契约类型登记进 SDK，其他插件即可通过 runtime.contracts.one 拿到精确类型。
declare module '@tt-plug/plugin-sdk' {
  interface WorkspacePluginContracts {
    one: OnePluginContract;
  }
}
