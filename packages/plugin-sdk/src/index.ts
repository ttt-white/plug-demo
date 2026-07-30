import type { ComponentType } from 'react';

export const PLUGIN_API_VERSION = 1 as const;

export interface PluginUser {
  id: string;
  username: string;
  displayName: string;
  role: string;
  permissions: string[];
}

export interface PluginApiRequestOptions extends Omit<RequestInit, 'body' | 'method'> {
  body?: unknown;
}

export interface PluginApiClient {
  get<T>(path: string, options?: PluginApiRequestOptions): Promise<T>;
  post<T>(path: string, body?: unknown, options?: PluginApiRequestOptions): Promise<T>;
  patch<T>(path: string, body?: unknown, options?: PluginApiRequestOptions): Promise<T>;
}

export class PluginApiError extends Error {
  readonly status: number;
  readonly details: unknown;

  constructor(status: number, message: string, details?: unknown) {
    super(message);
    this.name = 'PluginApiError';
    this.status = status;
    this.details = details;
  }
}

export interface PluginRuntime {
  api: PluginApiClient;
  user: PluginUser;
  can(permission: string): boolean;
}

export interface PluginComponentProps {
  runtime: PluginRuntime;
}

export type PluginComponentLoader = () => Promise<{ default: ComponentType<PluginComponentProps> }>;

export interface PluginManifest {
  id: string;
  name: string;
  version: string;
  apiVersion: typeof PLUGIN_API_VERSION;
  description?: string;
}

export interface PluginRouteContribution {
  id: string;
  path: string;
  permission: string;
  menu: {
    label: string;
    icon?: string;
    order: number;
  };
  load: PluginComponentLoader;
}

export interface PluginModuleContribution {
  id: string;
  routeId: string;
  slotId: string;
  permission?: string;
  priority?: number;
  load: PluginComponentLoader;
}

export interface WorkspacePlugin {
  manifest: PluginManifest;
  routes?: PluginRouteContribution[];
  modules?: PluginModuleContribution[];
}

export interface PluginValidationOptions {
  reservedPaths: readonly string[];
  knownSlots: Readonly<Record<string, readonly string[]>>;
}

export interface PluginRegistration {
  plugin: WorkspacePlugin;
  status: 'ready' | 'error';
  errors: string[];
}

function contributionDuplicates(plugins: readonly WorkspacePlugin[], selectIds: (plugin: WorkspacePlugin) => string[]) {
  const counts = new Map<string, number>();
  for (const plugin of plugins) {
    for (const id of selectIds(plugin)) counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  return new Set([...counts].filter(([, count]) => count > 1).map(([id]) => id));
}

export function validatePlugins(plugins: readonly WorkspacePlugin[], options: PluginValidationOptions): PluginRegistration[] {
  const pluginIdDuplicates = contributionDuplicates(plugins, (plugin) => [plugin.manifest.id]);
  const routeIdDuplicates = contributionDuplicates(plugins, (plugin) => plugin.routes?.map((route) => route.id) ?? []);
  const routePathDuplicates = contributionDuplicates(plugins, (plugin) => plugin.routes?.map((route) => route.path) ?? []);
  const moduleIdDuplicates = contributionDuplicates(plugins, (plugin) => plugin.modules?.map((module) => module.id) ?? []);
  const reservedPaths = new Set(options.reservedPaths);

  return plugins.map((plugin) => {
    const errors: string[] = [];
    const { manifest } = plugin;

    if (!manifest.id.trim()) errors.push('插件 ID 不能为空');
    if (!manifest.name.trim()) errors.push('插件名称不能为空');
    if ((manifest.apiVersion as number) !== PLUGIN_API_VERSION) errors.push(`不支持的 API 版本：${String(manifest.apiVersion)}`);
    if (pluginIdDuplicates.has(manifest.id)) errors.push(`插件 ID 重复：${manifest.id}`);

    for (const route of plugin.routes ?? []) {
      if (!route.path.startsWith('/')) errors.push(`路由必须使用绝对路径：${route.path}`);
      if (reservedPaths.has(route.path)) errors.push(`路由为宿主保留路由：${route.path}`);
      if (routeIdDuplicates.has(route.id)) errors.push(`路由 ID 重复：${route.id}`);
      if (routePathDuplicates.has(route.path)) errors.push(`路由路径重复：${route.path}`);
      if (!route.permission.trim()) errors.push(`路由缺少权限码：${route.id}`);
    }

    for (const module of plugin.modules ?? []) {
      if (moduleIdDuplicates.has(module.id)) errors.push(`模块 ID 重复：${module.id}`);
      const slots = options.knownSlots[module.routeId];
      if (!slots?.includes(module.slotId)) errors.push(`未知插槽：${module.routeId}/${module.slotId}`);
    }

    return { plugin, status: errors.length === 0 ? 'ready' : 'error', errors };
  });
}

export function sortModuleContributions(modules: readonly PluginModuleContribution[]): PluginModuleContribution[] {
  return [...modules].sort((left, right) => {
    const priorityDifference = (right.priority ?? 0) - (left.priority ?? 0);
    return priorityDifference || left.id.localeCompare(right.id);
  });
}
