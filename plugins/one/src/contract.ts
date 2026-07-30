/** one 插件对宿主能力的静态引用，用于避免在 manifest 中散落路由和插槽字符串。 */
export interface OnePluginContract {
  /** one 插件的唯一 ID。 */
  readonly pluginId: 'one';
  /** one 插件要注入的宿主位置。 */
  readonly targets: {
    /** 宿主 `/dashboard` 路由中的 `dashboard.metrics` 工作台指标插槽。 */
    readonly dashboardMetrics: {
      /** 宿主工作台的路由 ID，对应 URL `/dashboard`。 */
      readonly routeId: 'dashboard';
      /** 宿主工作台为指标模块开放的插槽 ID。 */
      readonly slotId: 'dashboard.metrics';
    };
  };
}

/** one 插件契约；manifest 直接引用该对象，不重复填写目标字符串。 */
export const oneContract: OnePluginContract = {
  pluginId: 'one',
  targets: {
    dashboardMetrics: {
      routeId: 'dashboard',
      slotId: 'dashboard.metrics',
    },
  },
};
