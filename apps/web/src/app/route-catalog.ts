import { hostContract } from '@fms/plugin-contracts';
import type { PluginContributionCatalogHost, PluginRouteContribution } from '@fms/plugin-sdk';

export type HostRouteId = 'dashboard' | 'plugins' | 'forbidden';

export interface HostRouteDefinition {
  id: HostRouteId;
  path: string;
  permission: string | null;
  menu?: {
    label: string;
    title: string;
    icon: 'blocks' | 'house';
    order: number;
  };
}

export const LOGIN_PATH = '/login';
export const FORBIDDEN_PATH = '/forbidden';

export const HOST_ROUTE_CATALOG: readonly HostRouteDefinition[] = [
  {
    id: hostContract.routes.dashboard.routeId,
    path: hostContract.routes.dashboard.path,
    permission: 'dashboard:view',
    menu: { label: '工作台', title: '宿主：工作台', icon: 'house', order: 10 },
  },
  {
    id: 'plugins',
    path: '/plugins',
    permission: 'plugins:manage',
    menu: { label: '插件中心', title: '宿主：插件中心', icon: 'blocks', order: 100 },
  },
  { id: 'forbidden', path: FORBIDDEN_PATH, permission: null },
];

export const HOST_ROUTES = [LOGIN_PATH, ...HOST_ROUTE_CATALOG.map(({ path }) => path)] as const;
export const HOST_SLOTS = {
  [hostContract.slots.dashboard.routeId]: [hostContract.slots.dashboard.slotId],
} as const;

export const HOST_CONTRIBUTION_CATALOG: PluginContributionCatalogHost = {
  id: 'host',
  name: '主体',
  routes: HOST_ROUTE_CATALOG.map((route) => ({ id: route.id, path: route.path, label: route.menu?.label ?? route.id })),
  extensionSlots: [
    {
      id: hostContract.slots.dashboard.slotId,
      routeId: hostContract.slots.dashboard.routeId,
      description: '工作台主内容区扩展模块。',
    },
  ],
};

interface PluginRouteEntry {
  contribution: PluginRouteContribution;
}

export function getWorkspaceHome(can: (permission: string) => boolean, pluginRoutes: readonly PluginRouteEntry[]) {
  const candidates = [
    ...HOST_ROUTE_CATALOG.flatMap((route) =>
      route.menu && route.permission && can(route.permission) ? [{ path: route.path, order: route.menu.order }] : [],
    ),
    ...pluginRoutes.flatMap(({ contribution }) =>
      can(contribution.permission) ? [{ path: contribution.path, order: contribution.menu.order }] : [],
    ),
  ].sort((left, right) => left.order - right.order || left.path.localeCompare(right.path));
  return candidates[0]?.path ?? FORBIDDEN_PATH;
}

export function safeReturnPath(value: unknown) {
  if (
    typeof value !== 'string' ||
    !value.startsWith('/') ||
    value.startsWith('//') ||
    value === LOGIN_PATH ||
    value.startsWith(`${LOGIN_PATH}?`) ||
    value.startsWith(`${LOGIN_PATH}#`)
  ) {
    return null;
  }
  return value;
}
