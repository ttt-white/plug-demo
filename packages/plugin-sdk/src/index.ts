import type { ComponentType, ReactNode } from 'react';

/** 当前宿主与插件共同支持的协议版本。 */
export const PLUGIN_API_VERSION = 1 as const;

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
  subscribe<T>(channel: PluginChannelReference<T>, listener: (payload: T, context: PluginChannelContext) => void): () => void;
  /** 按主题订阅当前插件的通道，并返回取消订阅函数。 */
  subscribe<T>(topic: string, listener: (payload: T, context: PluginChannelContext) => void): () => void;
  /** 向所有订阅该公共 contract 通道的插件广播消息。 */
  publishPublic<T>(channel: PluginPublicChannelReference<T>, payload: NoInfer<T>): void;
  /** 订阅公共 contract 通道，并返回取消订阅函数。 */
  subscribePublic<T>(
    channel: PluginPublicChannelReference<T>,
    listener: (payload: T, context: PluginChannelContext) => void,
  ): () => void;
}

/** 宿主级插件消息总线。 */
export interface PluginChannelBus {
  /** 获取以 `pluginId` 为消息发送方和订阅方上下文的通道。 */
  forPlugin(pluginId: string): PluginChannel;
}

type PluginChannelListener = (payload: unknown, context: PluginChannelContext) => void;

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

  function deliver(
    subscribers: Set<PluginChannelListener> | undefined,
    message: unknown,
    context: PluginChannelContext,
    failureLabel: string,
  ) {
    if (!subscribers) return;
    for (const subscriber of subscribers) {
      try {
        subscriber(message, context);
      } catch (error) {
        console.error(failureLabel, error);
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
        listener: (payload: T, context: PluginChannelContext) => void,
      ): () => void;
      function subscribe<T>(topic: string, listener: (payload: T, context: PluginChannelContext) => void): () => void;
      function subscribe<T>(
        topicOrChannel: string | PluginChannelReference<T>,
        listener: (payload: T, context: PluginChannelContext) => void,
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
        listener: (payload: T, context: PluginChannelContext) => void,
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
  navigateTo(route: PluginRouteReference): void;
}

/** 宿主传给每个插件组件的完整运行时上下文。 */
export interface PluginRuntime {
  /** 当前正在渲染的插件 ID。 */
  pluginId: string;
  /** 自动附带 Bearer token 的 API Client。 */
  api: PluginApiClient;
  /** 当前登录用户。 */
  user: PluginUser;
  /** 判断当前用户是否拥有指定权限码。 */
  can(permission: string): boolean;
  /** 当前插件的消息通道。 */
  channel: PluginChannel;
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

/** 插件贡献的整页路由；页面始终挂载在登录后的宿主 Layout 中。 */
export interface PluginRouteContribution {
  /** 路由贡献 ID，在所有插件路由中唯一。 */
  id: string;
  /** 唯一绝对 URL，例如 `/reports`。 */
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
  /** 插件提供的整页路由。 */
  routes?: PluginRouteContribution[];
  /** 插件提供给其他页面的类型化入口。 */
  routeLinks?: PluginRouteLinkContribution[];
  /** 插件注入宿主或其他插件插槽的模块。 */
  modules?: PluginModuleContribution[];
  /** 插件允许其他插件注入内容的位置。 */
  extensionSlots?: PluginExtensionSlotContribution[];
}

/** 宿主执行插件注册校验时提供的边界配置。 */
export interface PluginValidationOptions {
  /** 禁止插件覆盖的宿主 URL。 */
  reservedPaths: readonly string[];
  /** 宿主路由 ID 到其开放插槽 ID 的目录。 */
  knownSlots: Readonly<Record<string, readonly string[]>>;
}

/** 单个插件的注册结果，错误插件不会参与菜单、路由和模块渲染。 */
export interface PluginRegistration {
  /** 被校验的原始插件对象。 */
  plugin: WorkspacePlugin;
  /** `ready` 表示可启用，`error` 表示注册失败。 */
  status: 'ready' | 'error';
  /** 注册阶段发现的全部错误原因。 */
  errors: string[];
}

function contributionDuplicates(plugins: readonly WorkspacePlugin[], selectIds: (plugin: WorkspacePlugin) => string[]) {
  const counts = new Map<string, number>();
  for (const plugin of plugins) {
    for (const id of selectIds(plugin)) counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  return new Set([...counts].filter(([, count]) => count > 1).map(([id]) => id));
}

/** 校验所有已安装插件及其跨插件贡献，返回与输入顺序一致的注册结果。 */
export function validatePlugins(plugins: readonly WorkspacePlugin[], options: PluginValidationOptions): PluginRegistration[] {
  const pluginIdDuplicates = contributionDuplicates(plugins, (plugin) => [plugin.manifest.id]);
  const routeIdDuplicates = contributionDuplicates(plugins, (plugin) => plugin.routes?.map((route) => route.id) ?? []);
  const routePathDuplicates = contributionDuplicates(plugins, (plugin) => plugin.routes?.map((route) => route.path) ?? []);
  const routeLinkIdDuplicates = contributionDuplicates(
    plugins,
    (plugin) => plugin.routeLinks?.map((routeLink) => routeLink.id) ?? [],
  );
  const moduleIdDuplicates = contributionDuplicates(plugins, (plugin) => plugin.modules?.map((module) => module.id) ?? []);
  const reservedPaths = new Set(options.reservedPaths);

  const pluginsById = new Map<string, WorkspacePlugin[]>();
  const routesByTarget = new Map<string, Array<{ plugin: WorkspacePlugin; route: PluginRouteContribution }>>();
  for (const plugin of plugins) {
    pluginsById.set(plugin.manifest.id, [...(pluginsById.get(plugin.manifest.id) ?? []), plugin]);
    for (const route of plugin.routes ?? []) {
      const key = `${plugin.manifest.id}\0${route.id}`;
      routesByTarget.set(key, [...(routesByTarget.get(key) ?? []), { plugin, route }]);
    }
  }

  return plugins.map((plugin) => {
    const errors: string[] = [];
    const { manifest } = plugin;

    if (!manifest.id.trim()) errors.push('插件 ID 不能为空');
    if (!manifest.name.trim()) errors.push('插件名称不能为空');
    if ((manifest.apiVersion as number) !== PLUGIN_API_VERSION) errors.push(`不支持的 API 版本：${String(manifest.apiVersion)}`);
    if (pluginIdDuplicates.has(manifest.id)) errors.push(`插件 ID 重复：${manifest.id}`);

    const seenExtensionSlots = new Set<string>();
    for (const slot of plugin.extensionSlots ?? []) {
      const key = `${slot.routeId}\0${slot.id}`;
      if (seenExtensionSlots.has(key)) errors.push(`扩展插槽重复：${slot.routeId}/${slot.id}`);
      seenExtensionSlots.add(key);
      if (!slot.id.trim()) errors.push('扩展插槽 ID 不能为空');

      const ownsRoute = plugin.routes?.some((route) => route.id === slot.routeId);
      const usesHostRoute = Object.hasOwn(options.knownSlots, slot.routeId);
      if (!ownsRoute && !usesHostRoute) errors.push(`扩展插槽使用未知路由：${slot.routeId}/${slot.id}`);

      if (slot.ownerModuleId) {
        const ownerModule = plugin.modules?.find((module) => module.id === slot.ownerModuleId);
        if (!ownerModule) errors.push(`扩展插槽所属模块不存在：${slot.ownerModuleId}`);
        else if (ownerModule.routeId !== slot.routeId) errors.push(`扩展插槽与所属模块路由不一致：${slot.id}`);
      }
    }

    for (const route of plugin.routes ?? []) {
      if (!route.path.startsWith('/')) errors.push(`路由必须使用绝对路径：${route.path}`);
      if (reservedPaths.has(route.path)) errors.push(`路由为宿主保留路由：${route.path}`);
      if (routeIdDuplicates.has(route.id)) errors.push(`路由 ID 重复：${route.id}`);
      if (routePathDuplicates.has(route.path)) errors.push(`路由路径重复：${route.path}`);
      if (!route.permission.trim()) errors.push(`路由缺少权限码：${route.id}`);
    }

    for (const routeLink of plugin.routeLinks ?? []) {
      if (!routeLink.id.trim()) errors.push('路由入口 ID 不能为空');
      if (routeLinkIdDuplicates.has(routeLink.id)) errors.push(`路由入口 ID 重复：${routeLink.id}`);
      const parentTargets = routesByTarget.get(`${routeLink.parentRoute.pluginId}\0${routeLink.parentRoute.routeId}`) ?? [];
      if (parentTargets.length !== 1) {
        errors.push(`父路由不存在或不唯一：${routeLink.parentRoute.pluginId}/${routeLink.parentRoute.routeId}`);
      }
      const targetRoutes = routesByTarget.get(`${routeLink.targetRoute.pluginId}\0${routeLink.targetRoute.routeId}`) ?? [];
      if (targetRoutes.length !== 1) {
        errors.push(`跳转路由不存在或不唯一：${routeLink.targetRoute.pluginId}/${routeLink.targetRoute.routeId}`);
      }
      if (routeLink.permission !== undefined && !routeLink.permission.trim()) {
        errors.push(`路由入口权限码不能为空：${routeLink.id}`);
      }
    }

    for (const module of plugin.modules ?? []) {
      if (moduleIdDuplicates.has(module.id)) errors.push(`模块 ID 重复：${module.id}`);
      if (module.targetPluginId) {
        const targetPlugins = pluginsById.get(module.targetPluginId) ?? [];
        if (targetPlugins.length !== 1) {
          errors.push(`目标插件不存在或不唯一：${module.targetPluginId}`);
        } else {
          const targetPlugin = targetPlugins[0];
          const targetSlot = targetPlugin?.extensionSlots?.some(
            (slot) => slot.routeId === module.routeId && slot.id === module.slotId,
          );
          if (!targetSlot) errors.push(`目标插件未开放插槽：${module.targetPluginId}/${module.routeId}/${module.slotId}`);
        }
      } else {
        const slots = options.knownSlots[module.routeId];
        if (!slots?.includes(module.slotId)) errors.push(`未知插槽：${module.routeId}/${module.slotId}`);
      }
    }

    return { plugin, status: errors.length === 0 ? 'ready' : 'error', errors };
  });
}

/** 按优先级降序、模块 ID 升序返回新的模块贡献数组。 */
export function sortModuleContributions(modules: readonly PluginModuleContribution[]): PluginModuleContribution[] {
  return [...modules].sort((left, right) => {
    const priorityDifference = (right.priority ?? 0) - (left.priority ?? 0);
    return priorityDifference || left.id.localeCompare(right.id);
  });
}
