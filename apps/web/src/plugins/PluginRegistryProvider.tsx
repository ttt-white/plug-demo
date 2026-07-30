import {
  validatePlugins,
  type PluginModuleContribution,
  type PluginRegistration,
  type PluginRouteContribution,
  type PluginRuntime,
  type WorkspacePlugin,
} from '@fms/plugin-sdk';
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useAuth } from '@/auth/AuthProvider';
import { apiClient } from '@/services/api-client';
import { installedPlugins } from './installedPlugins';

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
  modulesFor(routeId: string, slotId: string): ResolvedModule[];
  runtime: PluginRuntime | null;
  setEnabled(id: string, enabled: boolean): Promise<void>;
}

const PluginRegistryContext = createContext<PluginRegistryContextValue | null>(null);
const registrations = validatePlugins(installedPlugins, { reservedPaths: HOST_ROUTES, knownSlots: HOST_SLOTS });
const EMPTY_PLUGIN_STATES: PluginState[] = [];

export function PluginRegistryProvider({ children }: { children: ReactNode }) {
  const { user, can } = useAuth();
  const [loaded, setLoaded] = useState<LoadedPluginStates | null>(null);

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
        .sort((left, right) => left.contribution.menu.order - right.contribution.menu.order),
    [activeRegistrations],
  );

  const runtime = useMemo<PluginRuntime | null>(() => (user ? { api: apiClient, user, can } : null), [can, user]);

  const value = useMemo<PluginRegistryContextValue>(
    () => ({
      registrations,
      states,
      loading,
      routes,
      runtime,
      modulesFor(routeId, slotId) {
        return activeRegistrations
          .flatMap((registration) =>
            (registration.plugin.modules ?? [])
              .filter((module) => module.routeId === routeId && module.slotId === slotId)
              .map((contribution) => ({ plugin: registration.plugin, contribution })),
          )
          .filter(({ contribution }) => !contribution.permission || can(contribution.permission))
          .sort((left, right) => {
            const priority = (right.contribution.priority ?? 0) - (left.contribution.priority ?? 0);
            return priority || left.plugin.manifest.id.localeCompare(right.plugin.manifest.id);
          });
      },
      async setEnabled(id, enabled) {
        const response = await apiClient.patch<{ plugins: PluginState[] }>(`/api/plugins/${id}`, { enabled });
        if (user) setLoaded({ owner: user, states: response.plugins });
      },
    }),
    [activeRegistrations, can, loading, routes, runtime, states, user],
  );

  return <PluginRegistryContext.Provider value={value}>{children}</PluginRegistryContext.Provider>;
}

export function usePluginRegistry() {
  const context = useContext(PluginRegistryContext);
  if (!context) throw new Error('usePluginRegistry must be used inside PluginRegistryProvider');
  return context;
}
