/*
 * 插件贡献的声明式写法。
 *
 * PageRouter / ModuleRouter 不是会被渲染的组件：宿主在注册阶段就要拿到静态的
 * routes / modules（PluginRegistryProvider → loadPluginRegistrations），那时插件
 * 页面还没挂载，跨插件注入的目标页面可能已经渲染完了。它们只用来在 JSX 里描述
 * 贡献，由 createPluginContributions 在模块求值时遍历成清单——与 React Router 的
 * createRoutesFromElements 同一个套路。
 *
 * 本文件刻意不写 JSX，只用 createElement，这样 SDK 的 tsup 构建不需要额外配置。
 */
import type { ComponentType, ReactElement, ReactNode } from 'react';
import { createContext, createElement, Fragment, isValidElement, useContext } from 'react';
import type {
  HostSlotReference,
  PluginComponentLoader,
  PluginComponentProps,
  PluginExtensionSlotContribution,
  PluginModuleContribution,
  PluginRouteContribution,
  PluginRouteLinkContribution,
  PluginRouteReference,
  PluginRuntime,
  PluginSlotReference,
} from './index';

// ---------------------------------------------------------------- 运行时上下文

/**
 * 宿主注入的运行时。声明树里以 children 形式写的内容拿不到 props，
 * 统一从这里取；通过 load 加载的组件仍然会收到宿主传下来的 runtime prop，
 * 两条路径的内容都被收集器包在同一个 Provider 里，所以 hook 在两边都可用。
 */
export const PluginRuntimeContext = createContext<PluginRuntime | null>(null);

/** 读取宿主运行时；在插件宿主之外调用会抛错。 */
export function usePluginRuntime(): PluginRuntime {
  const runtime = useContext(PluginRuntimeContext);
  if (!runtime) throw new Error('usePluginRuntime 必须在插件宿主渲染的贡献内部调用');
  return runtime;
}

/** 读取宿主运行时；插件独立运行（不在宿主内）时返回 null。 */
export function useOptionalPluginRuntime(): PluginRuntime | null {
  return useContext(PluginRuntimeContext);
}

// ---------------------------------------------------------------- 声明组件

/** 入口/菜单展示配置，与 SDK 贡献里的 menu 结构一致。 */
export interface ContributionMenu {
  label: string;
  icon?: string;
  order: number;
}

/**
 * 内容有两种写法，互斥：
 * - children：内容直接写在声明里，代价是进入入口 chunk，没有分包。
 * - load：保留 () => import() 的懒加载分包。
 */
export type ContributionContent = { children: ReactNode; load?: never } | { children?: never; load: PluginComponentLoader };

export type PageRouterProps = {
  /** 路由 ID，在工作区内唯一。 */
  routeId: string;
  /** 唯一绝对 URL。 */
  path: string;
  /** 访问该页面所需的权限码，宿主强制必填。 */
  permission: string;
  /** 主菜单展示配置。 */
  menu: ContributionMenu;
  /** 给出目标页面时，额外在该页面上生成一个跳回本页面的入口链接。 */
  target?: PluginRouteReference;
  /** 入口链接 ID，默认 `${routeId}.link.${target.pluginId}`。 */
  linkId?: string;
  /** 入口链接展示配置，默认复用 menu。 */
  linkMenu?: ContributionMenu;
  /** 入口链接所需权限码，默认复用 permission。 */
  linkPermission?: string;
} & ContributionContent;

export type ModuleRouterProps = {
  /** 模块贡献 ID，在工作区内唯一。 */
  moduleId: string;
  /** 注入目标插槽。带 pluginId 表示插件插槽，不带表示宿主插槽。 */
  target: PluginSlotReference | HostSlotReference;
  /** 渲染该模块所需的权限码，缺省表示不额外限制。 */
  permission?: string;
  /** 数值越大越靠前。 */
  priority?: number;
} & ContributionContent;

export interface ExtensionSlotProps {
  /** 插槽引用，提供 routeId 与 slotId。带 pluginId 时必须是本插件自己。 */
  target: PluginSlotReference | HostSlotReference;
  /** 插槽位于某个模块内时，该模块的贡献 ID。 */
  ownerModuleId?: string;
  /** 插槽可承载内容的用途说明。 */
  description?: string;
}

/** 声明一个页面路由。误渲染时返回 null，不产生副作用。 */
export function PageRouter(_props: PageRouterProps): ReactNode {
  return null;
}

/** 声明一个注入到目标插槽的模块。误渲染时返回 null，不产生副作用。 */
export function ModuleRouter(_props: ModuleRouterProps): ReactNode {
  return null;
}

/**
 * 声明一个开放给其他插件注入的插槽。误渲染时返回 null，不产生副作用。
 *
 * 只是登记一个具名的洞；真正把注入内容渲染出来靠页面里的
 * `runtime.extensions.renderSlot(slot, fallback)`。
 */
export function ExtensionSlot(_props: ExtensionSlotProps): ReactNode {
  return null;
}

// ---------------------------------------------------------------- 收集器

export interface PluginContributions {
  routes: PluginRouteContribution[];
  routeLinks: PluginRouteLinkContribution[];
  modules: PluginModuleContribution[];
  extensionSlots: PluginExtensionSlotContribution[];
}

export interface CreatePluginContributionsOptions {
  /** 当前插件 ID，用于把入口链接指回本插件自己的路由。 */
  pluginId: string;
}

/** 把声明树展开成扁平的声明元素列表；Fragment 和数组透明穿过。 */
function flattenDeclarations(node: ReactNode, collected: ReactElement[]): void {
  if (node === null || node === undefined || typeof node === 'boolean') return;
  if (Array.isArray(node)) {
    for (const child of node as ReactNode[]) flattenDeclarations(child, collected);
    return;
  }
  if (!isValidElement(node)) {
    throw new Error(`插件声明树只能包含 PageRouter / ModuleRouter / ExtensionSlot，收到了 ${typeof node}：${String(node)}`);
  }
  if (node.type === Fragment) {
    flattenDeclarations((node.props as { children?: ReactNode }).children, collected);
    return;
  }
  collected.push(node);
}

function buildMenu(menu: ContributionMenu) {
  return {
    label: menu.label,
    order: menu.order,
    ...(menu.icon === undefined ? {} : { icon: menu.icon }),
  };
}

/** children 路径：内容是静态元素，只需要补一个 Provider 让 usePluginRuntime() 可用。 */
function createContentComponent(children: ReactNode, displayName: string): ComponentType<PluginComponentProps> {
  function PluginContributionContent({ runtime }: PluginComponentProps) {
    return createElement(PluginRuntimeContext.Provider, { value: runtime }, children);
  }
  PluginContributionContent.displayName = `PluginContribution(${displayName})`;
  return PluginContributionContent;
}

/**
 * load 路径：既提供 Provider，也把 runtime 原样作为 prop 透传给被加载的组件。
 *
 * 两者都要——用 hook 写的组件靠 Provider，用 `{ runtime }: PluginComponentProps`
 * 写的组件靠 prop，宿主 PluginRenderer 只认后者的调用约定。
 */
function wrapLoadedComponent(
  Component: ComponentType<PluginComponentProps>,
  displayName: string,
): ComponentType<PluginComponentProps> {
  function PluginContributionContent({ runtime }: PluginComponentProps) {
    return createElement(PluginRuntimeContext.Provider, { value: runtime }, createElement(Component, { runtime }));
  }
  PluginContributionContent.displayName = `PluginContribution(${displayName})`;
  return PluginContributionContent;
}

/**
 * 解析内容来源。
 *
 * children 路径的包装组件在收集时只建一次；load 路径缓存整个 Promise，
 * 这样重复调用 load() 拿到的组件 identity 稳定，宿主重试时不会多余重挂载。
 */
function resolveLoader(content: ContributionContent, displayName: string) {
  if (content.load !== undefined) {
    const load = content.load;
    let pending: Promise<{ default: ComponentType<PluginComponentProps> }> | undefined;
    return () => (pending ??= load().then((module) => ({ default: wrapLoadedComponent(module.default, displayName) })));
  }
  const component = createContentComponent(content.children, displayName);
  return () => Promise.resolve({ default: component });
}

/**
 * 收集 JSX 声明树，产出宿主注册阶段需要的静态贡献清单。
 *
 * 在插件入口模块求值时调用，此时只是遍历已经创建好的 React 元素对象，
 * 不触发任何渲染。
 */
export function createPluginContributions(root: ReactNode, options: CreatePluginContributionsOptions): PluginContributions {
  const declarations: ReactElement[] = [];
  flattenDeclarations(root, declarations);

  const routes: PluginRouteContribution[] = [];
  const routeLinks: PluginRouteLinkContribution[] = [];
  const modules: PluginModuleContribution[] = [];
  const extensionSlots: PluginExtensionSlotContribution[] = [];

  for (const declaration of declarations) {
    if (declaration.type === PageRouter) {
      const props = declaration.props as PageRouterProps;
      routes.push({
        id: props.routeId,
        path: props.path,
        permission: props.permission,
        menu: buildMenu(props.menu),
        load: resolveLoader(props, `page:${props.routeId}`),
      });
      if (props.target !== undefined) {
        routeLinks.push({
          id: props.linkId ?? `${props.routeId}.link.${props.target.pluginId}`,
          parentRoute: props.target,
          targetRoute: { pluginId: options.pluginId, routeId: props.routeId },
          permission: props.linkPermission ?? props.permission,
          menu: buildMenu(props.linkMenu ?? props.menu),
        });
      }
      continue;
    }

    if (declaration.type === ModuleRouter) {
      const props = declaration.props as ModuleRouterProps;
      const target = props.target;
      modules.push({
        id: props.moduleId,
        routeId: target.routeId,
        slotId: target.slotId,
        // 不带 pluginId 的目标表示宿主插槽，此时必须省略 targetPluginId。
        ...('pluginId' in target ? { targetPluginId: target.pluginId } : {}),
        ...(props.permission === undefined ? {} : { permission: props.permission }),
        ...(props.priority === undefined ? {} : { priority: props.priority }),
        load: resolveLoader(props, `module:${props.moduleId}`),
      });
      continue;
    }

    if (declaration.type === ExtensionSlot) {
      const props = declaration.props as ExtensionSlotProps;
      const target = props.target;
      // 插槽按定义属于声明方自己；不带 pluginId 的是宿主路由上的插槽，合法。
      if ('pluginId' in target && target.pluginId !== options.pluginId) {
        throw new Error(`ExtensionSlot 只能声明本插件的插槽：${target.pluginId} !== ${options.pluginId}`);
      }
      extensionSlots.push({
        id: target.slotId,
        routeId: target.routeId,
        ...(props.ownerModuleId === undefined ? {} : { ownerModuleId: props.ownerModuleId }),
        ...(props.description === undefined ? {} : { description: props.description }),
      });
      continue;
    }

    // memo / forwardRef 之类的外来元素类型是对象而不是函数，兜底成 unknown。
    const type: unknown = declaration.type;
    const name = typeof type === 'string' ? type : typeof type === 'function' ? type.name : 'unknown';
    throw new Error(`插件声明树只能包含 PageRouter / ModuleRouter / ExtensionSlot，收到了 <${name} />`);
  }

  return { routes, routeLinks, modules, extensionSlots };
}
