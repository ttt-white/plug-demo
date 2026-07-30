import type { PluginChannelReference, PluginRouteReference, PluginSlotReference } from '@fms/plugin-sdk';

/** three 向 two 发送承运商筛选条件时使用的消息载荷。 */
export interface TwoFilterCarrierPayload {
  /** 需要在履约报表中筛选的承运商名称。 */
  carrier: string;
}

/** two 插件公开给宿主和其他插件使用的类型化契约。 */
export interface TwoPluginContract {
  /** two 插件的唯一 ID。 */
  readonly pluginId: 'two';
  /** two 插件拥有的页面路由。 */
  readonly routes: {
    /** 履约报表页面，对应唯一 URL `/reports`。 */
    readonly two: PluginRouteReference<'two', 'two'>;
  };
  /** two 插件允许其他插件注入模块的位置。 */
  readonly slots: {
    /** two 履约报表页面中的摘要模块插槽。 */
    readonly summary: PluginSlotReference<'two', 'two', 'two.summary'>;
  };
  /** two 插件允许其他插件发送的消息通道。 */
  readonly channels: {
    /** 接收承运商筛选条件，载荷类型为 `TwoFilterCarrierPayload`。 */
    readonly filterCarrier: PluginChannelReference<TwoFilterCarrierPayload, 'two', 'two:filter-carrier'>;
  };
}

/** two 插件的唯一运行时契约对象；跨插件代码应直接 import 并引用它。 */
export const twoContract: TwoPluginContract = {
  pluginId: 'two',
  routes: {
    two: {
      pluginId: 'two',
      routeId: 'two',
    },
  },
  slots: {
    summary: {
      pluginId: 'two',
      routeId: 'two',
      slotId: 'two.summary',
    },
  },
  channels: {
    filterCarrier: {
      pluginId: 'two',
      topic: 'two:filter-carrier',
    },
  },
};
