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

// two 对 one 的期望：one 注入到 two 页面的模块内部开放的嵌套插槽。
// 插槽归 one 所有（pluginId），但位于 two 自己的页面上（routeId）。
export const oneNestedTarget = {
  pluginId: 'one',
  routeId: 'two',
  slotId: 'one.nested',
} as const satisfies PluginSlotReference<'one', 'two', 'one.nested'>;

// 把契约类型登记进 SDK，其他插件即可通过 runtime.contracts.two 拿到精确类型。
declare module '@tt-plug/plugin-sdk' {
  interface WorkspacePluginContracts {
    two: TwoPluginContract;
  }
}
