import {
  createPluginChannelBus,
  validatePlugins,
  type PluginExtensionRoute,
  type PluginExtensionRuntime,
  type PluginModuleContribution,
  type PluginRegistration,
  type PluginRouteContribution,
  type PluginRuntime,
  type WorkspacePlugin,
} from '@fms/plugin-sdk';
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { installedPlugins } from 'virtual:fms-installed-plugins';
import { useAuth } from '@/auth/AuthProvider';
import { apiClient } from '@/services/api-client';

export const HOST_ROUTES = ['/login', '/dashboard', '/plugins'] as const;
export const HOST_SLOTS = { dashboard: ['dashboard.metrics'] } as const;

export interface ResolvedRoute {
  plugin: WorkspacePlugin;
  contribution: PluginRouteContribution;
}

export interface ResolvedModule {
  plugin: WorkspacePlugin;
  contribution: PluginModuleContribution;
}

interface PluginState {
  id: string;
  enabled: boolean;
}

interface LoadedPluginStates {
  owner: NonNullable<ReturnType<typeof useAuth>['user']>;
  states: PluginState[];
}

interface PluginRegistryContextValue {
  registrations: PluginRegistration[];
  states: PluginState[];
  loading: boolean;
  routes: ResolvedRoute[];
  modulesFor(routeId: string, slotId: string, targetPluginId?: string): ResolvedModule[];
  runtimeFor(pluginId: string, renderSlot: PluginExtensionRuntime['renderSlot']): PluginRuntime | null;
  setEnabled(id: string, enabled: boolean): Promise<void>;
}

const PluginRegistryContext = createContext<PluginRegistryContextValue | null>(null);
const registrations = validatePlugins(installedPlugins, { reservedPaths: HOST_ROUTES, knownSlots: HOST_SLOTS });
const EMPTY_PLUGIN_STATES: PluginState[] = [];

export function PluginRegistryProvider({ children }: { children: ReactNode }) {
  const { user, can } = useAuth();
  const navigate = useNavigate();
  const [loaded, setLoaded] = useState<LoadedPluginStates | null>(null);
  const channelBus = useMemo(() => createPluginChannelBus(), []);

  useEffect(() => {
    if (!user) return;
    let active = true;
    void apiClient
      .get<{ plugins: PluginState[] }>('/api/plugins')
      .then((response) => {
        if (active) setLoaded({ owner: user, states: response.plugins });
      })
      .catch(() => {
        if (active) setLoaded({ owner: user, states: [] });
      });
    return () => {
      active = false;
    };
  }, [user]);

  const states = loaded?.owner === user ? loaded.states : EMPTY_PLUGIN_STATES;
  const loading = Boolean(user && loaded?.owner !== user);
  const enabledIds = useMemo(() => new Set(states.filter((state) => state.enabled).map((state) => state.id)), [states]);
  const activeRegistrations = useMemo(
    () =>
      registrations.filter((registration) => registration.status === 'ready' && enabledIds.has(registration.plugin.manifest.id)),
    [enabledIds],
  );

  const routes = useMemo(
    () =>
      activeRegistrations
        .flatMap((registration) =>
          (registration.plugin.routes ?? []).map((contribution) => ({ plugin: registration.plugin, contribution })),
        )
        .sort((left, right) => {
          const order = left.contribution.menu.order - right.contribution.menu.order;
          return order || left.plugin.manifest.id.localeCompare(right.plugin.manifest.id);
        }),
    [activeRegistrations],
  );

  const routeLinks = useMemo(
    () =>
      activeRegistrations.flatMap((registration) =>
        (registration.plugin.routeLinks ?? []).map((contribution) => ({ plugin: registration.plugin, contribution })),
      ),
    [activeRegistrations],
  );

  const value = useMemo<PluginRegistryContextValue>(
    () => ({
      registrations,
      states,
      loading,
      routes,
      modulesFor(routeId, slotId, targetPluginId) {
        return activeRegistrations
          .flatMap((registration) =>
            (registration.plugin.modules ?? [])
              .filter(
                (module) =>
                  module.routeId === routeId &&
                  module.slotId === slotId &&
                  (module.targetPluginId ?? null) === (targetPluginId ?? null),
              )
              .map((contribution) => ({ plugin: registration.plugin, contribution })),
          )
          .filter(({ contribution }) => !contribution.permission || can(contribution.permission))
          .sort((left, right) => {
            const priority = (right.contribution.priority ?? 0) - (left.contribution.priority ?? 0);
            const plugin = left.plugin.manifest.id.localeCompare(right.plugin.manifest.id);
            return priority || plugin || left.contribution.id.localeCompare(right.contribution.id);
          });
      },
      runtimeFor(pluginId, renderSlot) {
        if (!user) return null;
        return {
          pluginId,
          api: apiClient,
          user,
          can,
          channel: channelBus.forPlugin(pluginId),
          extensions: {
            renderSlot,
            routesFor(route): PluginExtensionRoute[] {
              if (route.pluginId !== pluginId) return [];
              return routeLinks
                .filter(
                  ({ contribution }) =>
                    contribution.parentRoute.pluginId === route.pluginId &&
                    contribution.parentRoute.routeId === route.routeId &&
                    (!contribution.permission || can(contribution.permission)),
                )
                .flatMap(({ plugin, contribution }) => {
                  const target = routes.find(
                    (route) =>
                      route.plugin.manifest.id === contribution.targetRoute.pluginId &&
                      route.contribution.id === contribution.targetRoute.routeId,
                  );
                  if (!target || !can(target.contribution.permission)) return [];
                  return [
                    {
                      id: contribution.id,
                      pluginId: plugin.manifest.id,
                      targetRoute: contribution.targetRoute,
                      path: target.contribution.path,
                      label: contribution.menu.label,
                      ...(contribution.menu.icon ? { icon: contribution.menu.icon } : {}),
                      order: contribution.menu.order,
                    },
                  ];
                })
                .sort((left, right) => left.order - right.order || left.pluginId.localeCompare(right.pluginId));
            },
            navigateTo(route) {
              const target = routes.find(
                ({ plugin, contribution }) => plugin.manifest.id === route.pluginId && contribution.id === route.routeId,
              );
              if (target && can(target.contribution.permission)) void navigate(target.contribution.path);
            },
          },
        };
      },
      async setEnabled(id, enabled) {
        const response = await apiClient.patch<{ plugins: PluginState[] }>(`/api/plugins/${id}`, { enabled });
        if (user) setLoaded({ owner: user, states: response.plugins });
      },
    }),
    [activeRegistrations, can, channelBus, loading, navigate, routeLinks, routes, states, user],
  );

  return <PluginRegistryContext.Provider value={value}>{children}</PluginRegistryContext.Provider>;
}

export function usePluginRegistry() {
  const context = useContext(PluginRegistryContext);
  if (!context) throw new Error('usePluginRegistry must be used inside PluginRegistryProvider');
  return context;
}
