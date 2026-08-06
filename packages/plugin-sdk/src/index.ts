import type { ComponentType, ReactNode } from 'react';
import type { PluginQueryClient } from './query';
import { PLUGIN_API_VERSION, REMOTE_PLUGIN_MANIFEST_VERSION } from './version';

export { PLUGIN_API_VERSION, REMOTE_PLUGIN_MANIFEST_VERSION } from './version';

export {
  dataContract,
  demoStatusSchema,
  hostContract,
  workspaceContract,
  type DemoStatus,
  type HostContract,
  type PluginMessagePayload,
  type WorkspaceContract,
} from './workspace';

export {
  serializePluginQueryKey,
  usePluginQuery,
  type PluginQueryClient,
  type PluginQueryFunctionContext,
  type PluginQueryKey,
  type PluginQueryKeyPart,
  type PluginQueryObserver,
  type PluginQueryOptions,
  type PluginQuerySchema,
  type PluginQuerySnapshot,
} from './query';

/** 宿主传给插件的当前登录用户。 */
export interface PluginUser {
  /** 用户唯一 ID。 */
  id: string;
  /** 登录账号。 */
  username: string;
  /** 页面展示名称。 */
  displayName: string;
  /** 当前 RBAC 角色。 */
  role: string;
  /** 用户拥有的权限码；`*` 表示拥有全部权限。 */
  permissions: string[];
}

/** 插件调用宿主 API 时可附加的 Fetch 配置，鉴权头由宿主自动注入。 */
export interface PluginApiRequestOptions extends Omit<RequestInit, 'body' | 'method'> {
  /** 可序列化为 JSON 的请求体。 */
  body?: unknown;
}

/** 宿主提供给插件的自动鉴权 API Client。 */
export interface PluginApiClient {
  /** 发起 GET 请求并将 JSON 响应解析为 `T`。 */
  get<T>(path: string, options?: PluginApiRequestOptions): Promise<T>;
  /** 发起 POST 请求并将 JSON 响应解析为 `T`。 */
  post<T>(path: string, body?: unknown, options?: PluginApiRequestOptions): Promise<T>;
  /** 发起 PATCH 请求并将 JSON 响应解析为 `T`。 */
  patch<T>(path: string, body?: unknown, options?: PluginApiRequestOptions): Promise<T>;
}

/** API 返回非成功状态码时抛出的可识别错误。 */
export class PluginApiError extends Error {
  /** HTTP 状态码，例如 401 或 403。 */
  readonly status: number;
  /** 接口返回的原始错误详情。 */
  readonly details: unknown;

  constructor(status: number, message: string, details?: unknown) {
    super(message);
    this.name = 'PluginApiError';
    this.status = status;
    this.details = details;
  }
}

/** 消息监听器收到的发送方上下文。 */
export interface PluginChannelContext {
  /** 本次消息的发送方插件 ID。 */
  fromPluginId: string;
}

/**
 * 指向某个插件消息主题的类型化引用。
 *
 * @typeParam TPayload 消息载荷。
 * @typeParam TPluginId 接收方插件 ID；contract 应填写字符串字面量。
 * @typeParam TTopic 接收方消息主题；contract 应填写字符串字面量。
 */
export interface PluginChannelReference<TPayload, TPluginId extends string = string, TTopic extends string = string> {
  /** 接收消息的插件 ID。 */
  readonly pluginId: TPluginId;
  /** 接收插件内部唯一的消息主题。 */
  readonly topic: TTopic;
  /** 仅用于携带泛型，不会出现在运行时对象中。 */
  readonly payload?: TPayload;
}

/**
 * 指向工作区公共消息主题的类型化引用。
 *
 * @typeParam TPayload 公共消息载荷。
 * @typeParam TTopic 公共消息主题；contract 应填写字符串字面量。
 */
export interface PluginPublicChannelReference<TPayload, TTopic extends string = string> {
  /** 所有插件共同订阅的公共消息主题。 */
  readonly topic: TTopic;
  /** 仅用于携带泛型，不会出现在运行时对象中。 */
  readonly payload?: TPayload;
}

/** 单个插件使用的消息发布与订阅通道。 */
export interface PluginChannel {
  /** 使用 contract 中的类型化通道对象发布消息。 */
  publish<T>(channel: PluginChannelReference<T>, payload: NoInfer<T>): void;
  /** 使用目标插件 ID 和主题发布消息，主要用于兼容动态场景。 */
  publish<T>(targetPluginId: string, topic: string, payload: T): void;
  /** 订阅 contract 中属于当前插件的类型化通道，并返回取消订阅函数。 */
  subscribe<T>(
    channel: PluginChannelReference<T>,
    listener: (payload: T, context: PluginChannelContext) => void | Promise<void>,
  ): () => void;
  /** 按主题订阅当前插件的通道，并返回取消订阅函数。 */
  subscribe<T>(topic: string, listener: (payload: T, context: PluginChannelContext) => void | Promise<void>): () => void;
  /** 向所有订阅该公共 contract 通道的插件广播消息。 */
  publishPublic<T>(channel: PluginPublicChannelReference<T>, payload: NoInfer<T>): void;
  /** 订阅公共 contract 通道，并返回取消订阅函数。 */
  subscribePublic<T>(
    channel: PluginPublicChannelReference<T>,
    listener: (payload: T, context: PluginChannelContext) => void | Promise<void>,
  ): () => void;
}

/** 宿主级插件消息总线。 */
export interface PluginChannelBus {
  /** 获取以 `pluginId` 为消息发送方和订阅方上下文的通道。 */
  forPlugin(pluginId: string): PluginChannel;
}

type PluginChannelListener = (payload: unknown, context: PluginChannelContext) => void | Promise<void>;

function requiredChannelName(value: string, label: string) {
  const normalized = value.trim();
  if (!normalized) throw new Error(`${label}不能为空`);
  return normalized;
}

/** 创建一个内存消息总线；单个监听器异常不会中断其他插件监听器。 */
export function createPluginChannelBus(): PluginChannelBus {
  const listeners = new Map<string, Set<PluginChannelListener>>();
  const publicListeners = new Map<string, Set<PluginChannelListener>>();
  const channels = new Map<string, PluginChannel>();
  const channelKey = (pluginId: string, topic: string) => `${pluginId}\0${topic}`;

  function reportDeliveryFailure(failureLabel: string, error: unknown) {
    console.error(failureLabel, error);
  }

  function deliver(
    subscribers: Set<PluginChannelListener> | undefined,
    message: unknown,
    context: PluginChannelContext,
    failureLabel: string,
  ) {
    if (!subscribers) return;
    for (const subscriber of subscribers) {
      try {
        const result = subscriber(message, context);
        if (result) void result.catch((error) => reportDeliveryFailure(failureLabel, error));
      } catch (error) {
        reportDeliveryFailure(failureLabel, error);
      }
    }
  }

  return {
    forPlugin(pluginId) {
      const sourcePluginId = requiredChannelName(pluginId, '插件 ID');
      const cached = channels.get(sourcePluginId);
      if (cached) return cached;

      function publish<T>(channel: PluginChannelReference<T>, payload: NoInfer<T>): void;
      function publish<T>(targetPluginId: string, topic: string, payload: T): void;
      function publish<T>(targetOrChannel: string | PluginChannelReference<T>, topicOrPayload: string | T, payload?: T) {
        const targetPluginId = typeof targetOrChannel === 'string' ? targetOrChannel : targetOrChannel.pluginId;
        const topic = typeof targetOrChannel === 'string' ? String(topicOrPayload) : targetOrChannel.topic;
        const message = typeof targetOrChannel === 'string' ? payload : topicOrPayload;
        const target = requiredChannelName(targetPluginId, '目标插件 ID');
        const normalizedTopic = requiredChannelName(topic, '通道主题');
        const subscribers = listeners.get(channelKey(target, normalizedTopic));
        deliver(
          subscribers,
          message,
          { fromPluginId: sourcePluginId },
          `插件定向通道处理失败：${sourcePluginId} -> ${target}/${normalizedTopic}`,
        );
      }

      function subscribe<T>(
        channel: PluginChannelReference<T>,
        listener: (payload: T, context: PluginChannelContext) => void | Promise<void>,
      ): () => void;
      function subscribe<T>(
        topic: string,
        listener: (payload: T, context: PluginChannelContext) => void | Promise<void>,
      ): () => void;
      function subscribe<T>(
        topicOrChannel: string | PluginChannelReference<T>,
        listener: (payload: T, context: PluginChannelContext) => void | Promise<void>,
      ) {
        if (typeof topicOrChannel !== 'string') {
          const targetPluginId = requiredChannelName(topicOrChannel.pluginId, '通道插件 ID');
          if (targetPluginId !== sourcePluginId) throw new Error(`不能订阅其他插件的通道：${targetPluginId}`);
        }
        const topic = typeof topicOrChannel === 'string' ? topicOrChannel : topicOrChannel.topic;
        const normalizedTopic = requiredChannelName(topic, '通道主题');
        const key = channelKey(sourcePluginId, normalizedTopic);
        const subscribers = listeners.get(key) ?? new Set<PluginChannelListener>();
        const subscriber = listener as PluginChannelListener;
        subscribers.add(subscriber);
        listeners.set(key, subscribers);
        return () => {
          subscribers.delete(subscriber);
          if (subscribers.size === 0) listeners.delete(key);
        };
      }

      function publishPublic<T>(channel: PluginPublicChannelReference<T>, payload: NoInfer<T>) {
        const topic = requiredChannelName(channel.topic, '公共通道主题');
        deliver(
          publicListeners.get(topic),
          payload,
          { fromPluginId: sourcePluginId },
          `插件公共通道处理失败：${sourcePluginId} -> */${topic}`,
        );
      }

      function subscribePublic<T>(
        channel: PluginPublicChannelReference<T>,
        listener: (payload: T, context: PluginChannelContext) => void | Promise<void>,
      ) {
        const topic = requiredChannelName(channel.topic, '公共通道主题');
        const subscribers = publicListeners.get(topic) ?? new Set<PluginChannelListener>();
        const subscriber = listener as PluginChannelListener;
        subscribers.add(subscriber);
        publicListeners.set(topic, subscribers);
        return () => {
          subscribers.delete(subscriber);
          if (subscribers.size === 0) publicListeners.delete(topic);
        };
      }

      const channel: PluginChannel = {
        publish,
        publishPublic,
        subscribe,
        subscribePublic,
      };
      channels.set(sourcePluginId, channel);
      return channel;
    },
  };
}

/** 宿主解析后的插件页面入口，供页面渲染按钮并执行类型化导航。 */
export interface PluginExtensionRoute {
  /** 页面入口贡献的唯一 ID。 */
  id: string;
  /** 提供该入口的插件 ID。 */
  pluginId: string;
  /** 点击入口时应导航到的类型化目标路由。 */
  targetRoute: PluginRouteReference;
  /** 宿主解析出的目标 URL，仅用于展示或调试。 */
  path: string;
  /** 页面入口的展示文案。 */
  label: string;
  /** 可选图标名称，由宿主图标表解析。 */
  icon?: string;
  /** 同一页面内入口的升序排列值。 */
  order: number;
}

/** 插件在运行时访问其他插件页面、入口和插槽的能力。 */
export interface PluginExtensionRuntime {
  /** 渲染 contract 指定的插件开放插槽。 */
  renderSlot(slot: PluginSlotReference, fallback?: ReactNode): ReactNode;
  /** 获取其他插件贡献给指定页面的类型化入口。 */
  routesFor(route: PluginRouteReference): readonly PluginExtensionRoute[];
  /** 导航到 contract 指定的插件页面；实际 URL 由宿主注册表解析。 */
  navigateTo(route: PluginRouteReference, options?: PluginNavigationOptions): void;
}

/** 类型化路由导航时可附加的 URL 状态。 */
export interface PluginNavigationOptions {
  /** 合并到目标 URL 的查询参数；null/undefined 会删除同名参数。 */
  search?: Readonly<Record<string, string | number | boolean | null | undefined>>;
  /** 不创建新的浏览器历史记录。 */
  replace?: boolean;
}

/** 宿主传给每个插件组件的完整运行时上下文。 */
export interface PluginRuntime {
  /** 当前正在渲染的插件 ID。 */
  pluginId: string;
  /** 自动附带 Bearer token 的 API Client。 */
  api: PluginApiClient;
  /** 宿主级共享查询缓存；相同 query key 会跨插件去重。 */
  query: PluginQueryClient;
  /** 当前登录用户。 */
  user: PluginUser;
  /** 判断当前用户是否拥有指定权限码。 */
  can(permission: string): boolean;
  /** 当前插件的消息通道。 */
  channel: PluginChannel;
  /** 当前所有已启用插件公开的契约；未启用或未声明契约的插件 ID 取到 undefined。 */
  contracts: PluginContractRegistry;
  /** 跨插件页面和插槽扩展能力。 */
  extensions: PluginExtensionRuntime;
}

/** 所有插件页面和模块统一接收的 React Props。 */
export interface PluginComponentProps {
  /** 宿主为当前插件创建的运行时上下文。 */
  runtime: PluginRuntime;
}

/** 插件组件的懒加载函数；模块必须默认导出一个 React 组件。 */
export type PluginComponentLoader = () => Promise<{ default: ComponentType<PluginComponentProps> }>;

/** 插件包的基础身份与协议兼容信息。 */
export interface PluginVersionRequirement {
  /** 插件 ID 或能力 ID。 */
  id: string;
  /** 接受的 SemVer 范围，例如 `^1.0.0`。 */
  range: string;
  /** 可选依赖不可用时只产生警告，不阻止插件注册。 */
  optional?: boolean;
}

/** 插件对外提供的一项带版本能力。 */
export interface PluginCapabilityDeclaration {
  /** 工作区内稳定的能力 ID。 */
  id: string;
  /** 能力的 SemVer 版本。 */
  version: string;
}

/** 插件运行所需的插件和能力。 */
export interface PluginManifestRequirements {
  /** 直接依赖的插件及版本范围。 */
  plugins?: PluginVersionRequirement[];
  /** 依赖的抽象能力及版本范围。 */
  capabilities?: PluginVersionRequirement[];
}

/** 插件向工作区公开的能力。 */
export interface PluginManifestProvides {
  /** 可被其他插件按版本发现的能力。 */
  capabilities?: PluginCapabilityDeclaration[];
}

/** 插件包的基础身份与协议兼容信息。 */
export interface PluginManifest {
  /** 全工作区唯一且稳定的插件 ID。 */
  id: string;
  /** 插件中心展示名称。 */
  name: string;
  /** 插件包版本。 */
  version: string;
  /** 插件实现的 SDK 协议版本。 */
  apiVersion: typeof PLUGIN_API_VERSION;
  /** 插件用途说明。 */
  description?: string;
  /** 插件运行所需的插件和能力。 */
  requires?: PluginManifestRequirements;
  /** 插件向工作区提供的能力。 */
  provides?: PluginManifestProvides;
}

/**
 * 指向某个插件页面的类型化引用；宿主会将它解析为实际 URL。
 *
 * @typeParam TPluginId 页面所属插件 ID；contract 应填写字符串字面量。
 * @typeParam TRouteId 页面路由 ID；contract 应填写字符串字面量。
 */
export interface PluginRouteReference<TPluginId extends string = string, TRouteId extends string = string> {
  /** 拥有该页面的插件 ID。 */
  readonly pluginId: TPluginId;
  /** 该插件 manifest 中注册的路由贡献 ID。 */
  readonly routeId: TRouteId;
}

/** 指向宿主页面的类型化引用；宿主页面不属于任何插件。 */
export interface HostRouteReference<TRouteId extends string = string> {
  /** 宿主路由目录中的页面 ID。 */
  readonly routeId: TRouteId;
}

/** 指向宿主页面内开放插槽的类型化引用。 */
export interface HostSlotReference<
  TRouteId extends string = string,
  TSlotId extends string = string,
> extends HostRouteReference<TRouteId> {
  /** 宿主插槽白名单中的插槽 ID。 */
  readonly slotId: TSlotId;
}

/**
 * 指向某个插件页面内开放插槽的类型化引用。
 *
 * @typeParam TPluginId 插槽所属插件 ID。
 * @typeParam TRouteId 插槽所在页面的路由 ID。
 * @typeParam TSlotId 页面开放的插槽 ID。
 */
export interface PluginSlotReference<
  TPluginId extends string = string,
  TRouteId extends string = string,
  TSlotId extends string = string,
> extends PluginRouteReference<TPluginId, TRouteId> {
  /** 目标页面通过 `extensionSlots` 开放的插槽 ID。 */
  readonly slotId: TSlotId;
}

/**
 * 插件对外公开的类型化契约：它的页面、开放插槽、消息通道，以及它要注入的位置。
 *
 * 插件在自己的 `src/contract.ts` 里声明，挂到 `WorkspacePlugin.contract` 上，
 * 宿主会把所有已启用插件的契约汇总后通过 `PluginRuntime.contracts` 下发。
 *
 * @typeParam TPluginId 契约所属插件 ID；实现应填写字符串字面量。
 */
export interface PluginContract<TPluginId extends string = string> {
  /** 契约所属插件 ID，必须与 manifest.id 一致。 */
  readonly pluginId: TPluginId;
  /** 插件对外公开的页面，附带宿主解析出的 URL。 */
  readonly routes?: Readonly<Record<string, PluginRouteReference<TPluginId> & { readonly path: string }>>;
  /** 插件通过 `extensionSlots` 开放给其他插件的插槽。 */
  readonly slots?: Readonly<Record<string, PluginSlotReference<TPluginId>>>;
  /** 其他插件可以向本插件发送消息的定向通道。 */
  readonly channels?: Readonly<Record<string, PluginChannelReference<unknown, TPluginId>>>;
  /** 本插件要注入的宿主或其他插件的位置。 */
  readonly targets?: Readonly<Record<string, HostSlotReference | PluginSlotReference>>;
}

/**
 * 插件通过 declaration merging 登记自己的契约类型。
 *
 * ```ts
 * declare module '@tt-plug/plugin-sdk' {
 *   interface WorkspacePluginContracts {
 *     two: TwoPluginContract;
 *   }
 * }
 * ```
 */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface WorkspacePluginContracts {}

/** 宿主下发的全量契约表；已登记的插件 ID 得到精确类型，其余退化为 `PluginContract`。 */
export interface PluginContractRegistry extends Partial<WorkspacePluginContracts> {
  /** 未登记类型的插件 ID；插件未启用或未声明契约时为 undefined。 */
  readonly [pluginId: string]: PluginContract | undefined;
}

/** 插件贡献的整页路由；页面始终挂载在登录后的宿主 Layout 中。 */
export interface PluginRouteContribution {
  /** 路由贡献 ID，在所有插件路由中唯一。 */
  id: string;
  /** 唯一绝对 URL，例如 `/plugin-two`。 */
  path: string;
  /** 访问页面所需的 RBAC 权限码。 */
  permission: string;
  /** 宿主顶部菜单的展示配置。 */
  menu: {
    /** 菜单文案。 */
    label: string;
    /** 可选图标名称，由宿主图标表解析。 */
    icon?: string;
    /** 顶部菜单的升序排列值。 */
    order: number;
  };
  /** 页面组件懒加载函数。 */
  load: PluginComponentLoader;
}

/** 插件向另一个插件页面贡献的类型化页面入口。 */
export interface PluginRouteLinkContribution {
  /** 页面入口贡献 ID，在所有插件入口中唯一。 */
  id: string;
  /** 展示入口的父页面。 */
  parentRoute: PluginRouteReference;
  /** 点击后导航到的目标页面。 */
  targetRoute: PluginRouteReference;
  /** 展示和使用该入口所需的权限码。 */
  permission?: string;
  /** 入口按钮的展示配置。 */
  menu: {
    /** 入口文案。 */
    label: string;
    /** 可选图标名称，由宿主图标表解析。 */
    icon?: string;
    /** 同一父页面内入口的升序排列值。 */
    order: number;
  };
}

/** 插件向宿主或另一个插件的明确插槽贡献的模块。 */
export interface PluginModuleContribution {
  /** 模块贡献 ID，在所有插件模块中唯一。 */
  id: string;
  /** 目标页面的路由 ID。 */
  routeId: string;
  /** 目标页面开放的插槽 ID。 */
  slotId: string;
  /** 插件插槽所属插件 ID；省略时表示宿主插槽。 */
  targetPluginId?: string;
  /** 渲染模块所需的 RBAC 权限码。 */
  permission?: string;
  /** 同一插槽内的优先级，数值越大越靠前。 */
  priority?: number;
  /** 模块组件懒加载函数。 */
  load: PluginComponentLoader;
}

/** 插件声明在自己的页面或模块内开放的扩展插槽。 */
export interface PluginExtensionSlotContribution {
  /** 插槽 ID，在所属路由内唯一。 */
  id: string;
  /** 插槽所在页面的路由贡献 ID。 */
  routeId: string;
  /** 插槽位于某个模块内时，该模块的贡献 ID。 */
  ownerModuleId?: string;
  /** 插槽可承载内容的用途说明。 */
  description?: string;
}

/** 一个可由宿主发现、校验、启停和渲染的完整插件对象。 */
export interface WorkspacePlugin {
  /** 插件身份和协议版本。 */
  manifest: PluginManifest;
  /** 插件公开给其他插件的类型化契约；宿主会汇总后通过 `PluginRuntime.contracts` 下发。 */
  contract?: PluginContract;
  /** 插件提供的整页路由。 */
  routes?: PluginRouteContribution[];
  /** 插件提供给其他页面的类型化入口。 */
  routeLinks?: PluginRouteLinkContribution[];
  /** 插件注入宿主或其他插件插槽的模块。 */
  modules?: PluginModuleContribution[];
  /** 插件允许其他插件注入内容的位置。 */
  extensionSlots?: PluginExtensionSlotContribution[];
}

/** 宿主向贡献目录提供的页面和插槽元数据。 */
export interface PluginContributionCatalogHost {
  /** 宿主在贡献关系中使用的稳定 ID。 */
  id: string;
  /** 宿主展示名称。 */
  name: string;
  /** 可作为插件模块目标的宿主页面。 */
  routes: readonly {
    id: string;
    path: string;
    label: string;
  }[];
  /** 宿主页面开放的插槽。 */
  extensionSlots: readonly {
    id: string;
    routeId: string;
    description?: string;
  }[];
}

/** 贡献目录中的插件或宿主身份。 */
export interface PluginContributionCatalogOwner {
  id: string;
  name: string;
  kind: 'host' | 'plugin';
}

/** 贡献关系中已解析的页面引用。 */
export interface PluginContributionCatalogRoute {
  owner: PluginContributionCatalogOwner;
  routeId: string;
  label: string;
  path?: string;
}

export interface PluginContributionCatalog {
  pages: Array<{
    provider: PluginContributionCatalogOwner;
    routeId: string;
    path: string;
    label: string;
    permission?: string;
    order?: number;
  }>;
  routeLinks: Array<{
    provider: PluginContributionCatalogOwner;
    id: string;
    parent: PluginContributionCatalogRoute;
    target: PluginContributionCatalogRoute;
    label: string;
    permission?: string;
    order: number;
  }>;
  modules: Array<{
    provider: PluginContributionCatalogOwner;
    id: string;
    target: PluginContributionCatalogRoute & { slotId: string };
    permission?: string;
    priority: number;
  }>;
  slots: Array<{
    provider: PluginContributionCatalogOwner;
    route: PluginContributionCatalogRoute;
    slotId: string;
    ownerModuleId?: string;
    description?: string;
  }>;
}

/** 远程插件服务公开的最小发现信息。 */
export interface RemotePluginManifest {
  /** 远程 manifest 的结构版本。 */
  schemaVersion: typeof REMOTE_PLUGIN_MANIFEST_VERSION;
  /** 插件 ID，必须与运行时 manifest 一致。 */
  id: string;
  /** 插件展示名称。 */
  name: string;
  /** 插件 SemVer 版本。 */
  version: string;
  /** 插件 SDK 协议版本。 */
  apiVersion: typeof PLUGIN_API_VERSION;
  /** Module Federation 远程入口。 */
  remote: {
    /** Federation 容器名称。 */
    name: string;
    /** 相对远程服务根地址的入口路径。 */
    entry: string;
    /** 容器公开的插件模块名称。 */
    module: string;
  };
}

/** 宿主执行插件注册校验时提供的边界配置。 */
export interface PluginValidationOptions {
  /** 禁止插件覆盖的宿主 URL。 */
  reservedPaths: readonly string[];
  /** 宿主路由 ID 到其开放插槽 ID 的目录。 */
  knownSlots: Readonly<Record<string, readonly string[]>>;
}

/** 插件包在构建期发现的身份元数据。 */
export interface PluginPackageMetadata {
  /** npm 包名。 */
  packageName: string;
  /** package.json 版本。 */
  packageVersion: string;
  /** package.json `plugin.id` 的原始值。 */
  declaredPluginId?: unknown;
  /** package.json `plugin.apiVersion` 的原始值。 */
  declaredApiVersion?: unknown;
  /** package.json 声明的插件样式入口。 */
  style?: string;
  /** 插件代码来源；缺省表示本地安装包。 */
  sourceType?: 'package' | 'remote';
  /** 远程插件服务根地址。 */
  remoteUrl?: string;
}

/** 插件注册诊断所属阶段。 */
export type PluginDiagnosticStage = 'discovery' | 'health' | 'load' | 'schema' | 'compatibility' | 'contribution' | 'dependency';

/** 可由插件中心和日志系统消费的结构化注册诊断。 */
export interface PluginDiagnostic {
  /** 稳定错误码。 */
  code: string;
  /** 产生诊断的注册阶段。 */
  stage: PluginDiagnosticStage;
  /** 错误阻止注册，警告仅用于运维提示。 */
  severity: 'error' | 'warning';
  /** 面向开发者和管理员的可读说明。 */
  message: string;
  /** manifest 或贡献中的字段路径。 */
  path?: string;
}

/** 本地发现器或远程健康检查交给宿主的惰性插件描述符。 */
export interface PluginPackageDescriptor {
  /** 不执行插件代码即可读取的来源元数据。 */
  metadata: PluginPackageMetadata;
  /** 发现阶段已经识别出的元数据问题。 */
  diagnostics?: readonly PluginDiagnostic[];
  /** 动态加载插件对象和样式；失败只影响当前描述符。 */
  load(): Promise<unknown>;
}

interface PluginRegistrationBase {
  /** 注册结果对应的 npm 包。 */
  source: PluginPackageMetadata;
  /** 跨阶段结构化诊断。 */
  diagnostics: PluginDiagnostic[];
  /** 兼容旧调用方的错误文案列表。 */
  errors: string[];
}

/** 校验成功且可以参与路由、菜单和模块解析的插件。 */
export interface ReadyPluginRegistration extends PluginRegistrationBase {
  status: 'ready';
  plugin: WorkspacePlugin;
}

/** 加载或校验失败、不会参与运行时解析的插件。 */
export interface FailedPluginRegistration extends PluginRegistrationBase {
  status: 'error';
  plugin: WorkspacePlugin | null;
}

/** 单个插件包的完整注册结果。 */
export type PluginRegistration = ReadyPluginRegistration | FailedPluginRegistration;

export { loadPluginRegistrations, parseRemotePluginManifest, validatePlugins } from './plugin-validation';

/** 按优先级降序、模块 ID 升序返回新的模块贡献数组。 */
export function sortModuleContributions(modules: readonly PluginModuleContribution[]): PluginModuleContribution[] {
  return [...modules].sort((left, right) => {
    const priorityDifference = (right.priority ?? 0) - (left.priority ?? 0);
    return priorityDifference || left.id.localeCompare(right.id);
  });
}

/**
 * 将宿主和插件的页面、入口、模块与插槽整理为可展示、可生成文档的关系目录。
 */
export function catalogPluginContributions(
  plugins: readonly WorkspacePlugin[],
  host: PluginContributionCatalogHost,
): PluginContributionCatalog {
  const hostOwner: PluginContributionCatalogOwner = { id: host.id, name: host.name, kind: 'host' };
  const pluginOwners = new Map(
    plugins.map((plugin) => [
      plugin.manifest.id,
      { id: plugin.manifest.id, name: plugin.manifest.name, kind: 'plugin' } satisfies PluginContributionCatalogOwner,
    ]),
  );
  const routes = new Map<string, PluginContributionCatalogRoute>();
  const routeKey = (pluginId: string, routeId: string) => `${pluginId}\0${routeId}`;

  for (const route of host.routes) {
    routes.set(routeKey(host.id, route.id), {
      owner: hostOwner,
      routeId: route.id,
      label: route.label,
      path: route.path,
    });
  }
  for (const plugin of plugins) {
    const owner = pluginOwners.get(plugin.manifest.id)!;
    for (const route of plugin.routes ?? []) {
      routes.set(routeKey(owner.id, route.id), {
        owner,
        routeId: route.id,
        label: route.menu.label,
        path: route.path,
      });
    }
  }

  const resolveRoute = (pluginId: string, routeId: string): PluginContributionCatalogRoute =>
    routes.get(routeKey(pluginId, routeId)) ?? {
      owner: pluginOwners.get(pluginId) ?? { id: pluginId, name: pluginId, kind: pluginId === host.id ? 'host' : 'plugin' },
      routeId,
      label: routeId,
    };
  const pages: PluginContributionCatalog['pages'] = [
    ...host.routes.map((route) => ({
      provider: hostOwner,
      routeId: route.id,
      path: route.path,
      label: route.label,
    })),
    ...plugins.flatMap((plugin) => {
      const provider = pluginOwners.get(plugin.manifest.id)!;
      return (plugin.routes ?? []).map((route) => ({
        provider,
        routeId: route.id,
        path: route.path,
        label: route.menu.label,
        permission: route.permission,
        order: route.menu.order,
      }));
    }),
  ].sort((left, right) => left.provider.id.localeCompare(right.provider.id) || left.routeId.localeCompare(right.routeId));
  const routeLinks = plugins
    .flatMap((plugin) => {
      const provider = pluginOwners.get(plugin.manifest.id)!;
      return (plugin.routeLinks ?? []).map((routeLink) => ({
        provider,
        id: routeLink.id,
        parent: resolveRoute(routeLink.parentRoute.pluginId, routeLink.parentRoute.routeId),
        target: resolveRoute(routeLink.targetRoute.pluginId, routeLink.targetRoute.routeId),
        label: routeLink.menu.label,
        ...(routeLink.permission ? { permission: routeLink.permission } : {}),
        order: routeLink.menu.order,
      }));
    })
    .sort((left, right) => left.provider.id.localeCompare(right.provider.id) || left.id.localeCompare(right.id));
  const modules = plugins
    .flatMap((plugin) => {
      const provider = pluginOwners.get(plugin.manifest.id)!;
      return (plugin.modules ?? []).map((module) => ({
        provider,
        id: module.id,
        target: {
          ...resolveRoute(module.targetPluginId ?? host.id, module.routeId),
          slotId: module.slotId,
        },
        ...(module.permission ? { permission: module.permission } : {}),
        priority: module.priority ?? 0,
      }));
    })
    .sort((left, right) => left.provider.id.localeCompare(right.provider.id) || left.id.localeCompare(right.id));
  const slots: PluginContributionCatalog['slots'] = [
    ...host.extensionSlots.map((slot) => ({
      provider: hostOwner,
      route: resolveRoute(host.id, slot.routeId),
      slotId: slot.id,
      ...(slot.description ? { description: slot.description } : {}),
    })),
    ...plugins.flatMap((plugin) => {
      const provider = pluginOwners.get(plugin.manifest.id)!;
      return (plugin.extensionSlots ?? []).map((slot) => ({
        provider,
        route: resolveRoute(plugin.manifest.id, slot.routeId),
        slotId: slot.id,
        ...(slot.ownerModuleId ? { ownerModuleId: slot.ownerModuleId } : {}),
        ...(slot.description ? { description: slot.description } : {}),
      }));
    }),
  ].sort(
    (left, right) =>
      left.provider.id.localeCompare(right.provider.id) ||
      left.route.routeId.localeCompare(right.route.routeId) ||
      left.slotId.localeCompare(right.slotId),
  );

  return { pages, routeLinks, modules, slots };
}
