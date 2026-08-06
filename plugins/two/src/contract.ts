import type {
  PluginChannelReference,
  PluginMessagePayload,
  PluginRouteReference,
  PluginSlotReference,
} from '@tt-plug/plugin-sdk';

export interface TwoPluginContract {
  readonly pluginId: 'two';
  readonly routes: {
    readonly page: PluginRouteReference<'two', 'two'> & { readonly path: '/plugin-two' };
  };
  readonly slots: {
    readonly demo: PluginSlotReference<'two', 'two', 'two.demo'>;
  };
  readonly channels: {
    readonly message: PluginChannelReference<PluginMessagePayload, 'two', 'two:message'>;
  };
}

export const twoContract: TwoPluginContract = {
  pluginId: 'two',
  routes: {
    page: { path: '/plugin-two', pluginId: 'two', routeId: 'two' },
  },
  slots: {
    demo: { pluginId: 'two', routeId: 'two', slotId: 'two.demo' },
  },
  channels: {
    message: { pluginId: 'two', topic: 'two:message' },
  },
};

// 把契约类型登记进 SDK，其他插件即可通过 runtime.contracts.two 拿到精确类型。
declare module '@tt-plug/plugin-sdk' {
  interface WorkspacePluginContracts {
    two: TwoPluginContract;
  }
}
