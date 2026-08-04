import type {
  PluginChannelReference,
  PluginPublicChannelReference,
  PluginRouteReference,
  PluginSlotReference,
} from '@fms/plugin-sdk';
import { z } from 'zod';

export const dashboardMetricSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  value: z.string().min(1),
  change: z.number().finite(),
});

export const dashboardSummarySchema = z.object({
  updatedAt: z.string().min(1),
  inTransit: z.number().int().nonnegative(),
  pendingDispatch: z.number().int().nonnegative(),
  exceptions: z.number().int().nonnegative(),
  completedToday: z.number().int().nonnegative(),
  onTimeRate: z.number().min(0).max(100),
  metrics: z.array(dashboardMetricSchema),
});

export type DashboardMetric = z.infer<typeof dashboardMetricSchema>;
export type DashboardSummary = z.infer<typeof dashboardSummarySchema>;

export const REPORT_STATUSES = ['待处理', '运输中', '已完成', '异常'] as const;
export const reportStatusSchema = z.enum(REPORT_STATUSES);
export type ReportStatus = z.infer<typeof reportStatusSchema>;

export const reportRowSchema = z.object({
  id: z.string().min(1),
  origin: z.string().min(1),
  destination: z.string().min(1),
  carrier: z.string().min(1),
  status: reportStatusSchema,
  amount: z.number().nonnegative(),
  updatedAt: z.string().min(1),
});

export const reportsResponseSchema = z.object({
  updatedAt: z.string().min(1),
  total: z.number().int().nonnegative(),
  rows: z.array(reportRowSchema),
  facets: z.object({
    carriers: z.array(z.string().min(1)),
    statuses: z.array(reportStatusSchema),
  }),
});

export type ReportRow = z.infer<typeof reportRowSchema>;
export type ReportsResponse = z.infer<typeof reportsResponseSchema>;

export const carrierRiskSchema = z.enum(['low', 'medium', 'high']);
export type CarrierRisk = z.infer<typeof carrierRiskSchema>;

export const carrierRatingSchema = z.object({
  id: z.string().min(1),
  carrier: z.string().min(1),
  level: z.enum(['A', 'B', 'C', 'D']),
  score: z.number().min(0).max(100),
  onTimeRate: z.number().min(0).max(100),
  incidents: z.number().int().nonnegative(),
  trend: z.number().finite(),
  risk: carrierRiskSchema,
});

export const carrierRatingsResponseSchema = z.object({
  updatedAt: z.string().min(1),
  rows: z.array(carrierRatingSchema),
});

export type CarrierRating = z.infer<typeof carrierRatingSchema>;
export type CarrierRatingsResponse = z.infer<typeof carrierRatingsResponseSchema>;

/** 宿主和插件共同使用的 FMS 数据查询契约。 */
export const fmsDataContract = {
  dashboard: {
    path: '/api/dashboard',
    queryKey: ['fms', 'dashboard'] as const,
    schema: dashboardSummarySchema,
  },
  reports: {
    path: '/api/reports',
    queryKey: ['fms', 'reports'] as const,
    schema: reportsResponseSchema,
  },
  carrierRatings: {
    path: '/api/carrier-ratings',
    queryKey: ['fms', 'carrier-ratings'] as const,
    schema: carrierRatingsResponseSchema,
  },
} as const;

/** one 插件对宿主能力的静态引用，用于避免在 manifest 中散落路由和插槽字符串。 */
export interface OnePluginContract {
  /** one 插件的唯一 ID。 */
  readonly pluginId: 'one';
  /** one 插件要注入的宿主位置。 */
  readonly targets: {
    /** 宿主 `/dashboard` 路由中的 `dashboard.metrics` 工作台指标插槽。 */
    readonly dashboardMetrics: {
      /** 宿主工作台的真实 URL。 */
      readonly path: '/dashboard';
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
      path: '/dashboard',
      routeId: 'dashboard',
      slotId: 'dashboard.metrics',
    },
  },
};

/** three 向 two 发送承运商筛选条件时使用的定向消息载荷。 */
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
    readonly two: PluginRouteReference<'two', 'two'> & {
      /** two 履约报表页面的真实 URL。 */
      readonly path: '/reports';
    };
  };
  /** two 插件允许其他插件注入模块的位置。 */
  readonly slots: {
    /** two 履约报表页面中的摘要模块插槽。 */
    readonly summary: PluginSlotReference<'two', 'two', 'two.summary'>;
  };
  /** two 插件允许其他插件发送的定向消息通道。 */
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
      path: '/reports',
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

/** three 插件公开给宿主和其他插件使用的类型化契约。 */
export interface ThreePluginContract {
  /** three 插件的唯一 ID。 */
  readonly pluginId: 'three';
  /** three 插件拥有的页面路由。 */
  readonly routes: {
    /** 承运商评级页面，对应唯一 URL `/carrier-ratings`。 */
    readonly three: PluginRouteReference<'three', 'three'> & {
      /** three 承运商评级页面的真实 URL。 */
      readonly path: '/carrier-ratings';
    };
  };
}

/** three 插件的唯一运行时契约对象；跨插件代码应直接 import 并引用它。 */
export const threeContract: ThreePluginContract = {
  pluginId: 'three',
  routes: {
    three: {
      path: '/carrier-ratings',
      pluginId: 'three',
      routeId: 'three',
    },
  },
};

/** 所有当前订阅插件都能接收的工作区公共消息。 */
export interface WorkspacePublicMessagePayload {
  /** 面向演示页面展示的公共消息正文。 */
  message: string;
}

/** one、two、three 共同依赖的公共契约。 */
export interface WorkspaceContract {
  /** 当前示例工作区公开的全部插件配置。 */
  readonly plugins: {
    /** one 工作台模块配置。 */
    readonly one: OnePluginContract;
    /** two 履约报表页面、插槽和定向通道配置。 */
    readonly two: TwoPluginContract;
    /** three 承运商评级页面配置。 */
    readonly three: ThreePluginContract;
  };
  /** 不限定接收插件的工作区公共通道。 */
  readonly channels: {
    /** 所有插件均可发布和订阅的消息广播通道。 */
    readonly publicMessage: PluginPublicChannelReference<WorkspacePublicMessagePayload, 'workspace:public-message'>;
  };
}

/** 工作区公共契约；任意插件可通过该对象读取其他插件配置和访问公共通道。 */
export const workspaceContract: WorkspaceContract = {
  plugins: {
    one: oneContract,
    two: twoContract,
    three: threeContract,
  },
  channels: {
    publicMessage: {
      topic: 'workspace:public-message',
    },
  },
};
