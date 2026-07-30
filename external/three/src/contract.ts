import type { PluginRouteReference } from '@fms/plugin-sdk';

/** three 插件公开给宿主和其他插件使用的类型化契约。 */
export interface ThreePluginContract {
  /** three 插件的唯一 ID。 */
  readonly pluginId: 'three';
  /** three 插件拥有的页面路由。 */
  readonly routes: {
    /** 承运商评级页面，对应唯一 URL `/carrier-ratings`。 */
    readonly three: PluginRouteReference<'three', 'three'>;
  };
}

/** three 插件的唯一运行时契约对象；跨插件代码应直接 import 并引用它。 */
export const threeContract: ThreePluginContract = {
  pluginId: 'three',
  routes: {
    three: {
      pluginId: 'three',
      routeId: 'three',
    },
  },
};
