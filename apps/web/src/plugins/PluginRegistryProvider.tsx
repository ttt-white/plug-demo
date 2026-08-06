import { HOST_ROUTES, HOST_SLOTS } from '@/app/route-catalog';
import { useAuth } from '@/auth/AuthProvider';
import { apiClient } from '@/services/api-client';
import { createWorkspaceQueryClient } from '@/services/query-client';
import {
  createRemotePluginDefinition,
  remotePluginHealthInterval,
  type RemotePluginConfiguration,
  type RemotePluginDefinition,
} from '@/plugins/remote-plugin-catalog';
import { discoverRemotePluginConfiguration, inspectRemotePlugins } from '@/plugins/remote-plugin-loader';
import {
  createPluginChannelBus,
  loadPluginRegistrations,
  type PluginExtensionRoute,
  type PluginExtensionRuntime,
  type PluginModuleContribution,
  type PluginQueryClient,
  type PluginRegistration,
  type PluginRouteContribution,
  type PluginRuntime,
  type ReadyPluginRegistration,
  type WorkspacePlugin,
} from '@tt-plug/plugin-sdk';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { installedPluginDescriptors } from 'virtual:fms-installed-plugins';

export interface ResolvedRoute {
  plugin: WorkspacePlugin;
  contribution: PluginRouteContribution;
}

interface ResolvedModule {
  plugin: WorkspacePlugin;
  contribution: PluginModuleContribution;
}

interface PluginState {
  id: string;
  enabled: boolean;
}

type PluginStatesState =
  | { status: 'idle'; states: PluginState[]; error: null }
  | { status: 'loading'; states: PluginState[]; error: null }
  | { status: 'ready'; states: PluginState[]; error: null }
  | { status: 'error'; states: PluginState[]; error: string };

type OwnedPluginStatesState = PluginStatesState & { ownerId: string | null };

interface PluginRegistryContextValue {
  registrations: PluginRegistration[];
  states: PluginState[];
  statesState: PluginStatesState;
  loading: boolean;
  refreshing: boolean;
  remoteConfigurations: RemotePluginConfiguration[];
  routes: ResolvedRoute[];
  query: PluginQueryClient;
  modulesFor(routeId: string, slotId: string, targetPluginId?: string): ResolvedModule[];
  runtimeFor(pluginId: string, renderSlot: PluginExtensionRuntime['renderSlot']): PluginRuntime | null;
  reloadStates(): Promise<void>;
  importRemotePlugin(origin: string): Promise<void>;
  updateRemotePlugin(id: string, origin: string): Promise<void>;
  removeRemotePlugin(id: string): Promise<void>;
  setEnabled(id: string, enabled: boolean): Promise<void>;
}

const PluginRegistryContext = createContext<PluginRegistryContextValue | null>(null);
const EMPTY_PLUGIN_STATES: PluginState[] = [];
const IDLE_PLUGIN_STATES: PluginStatesState = { status: 'idle', states: EMPTY_PLUGIN_STATES, error: null };
const PLUGIN_VALIDATION_OPTIONS = { reservedPaths: HOST_ROUTES, knownSlots: HOST_SLOTS } as const;

function errorMessage(reason: unknown) {
  return reason instanceof Error ? reason.message : '无法读取插件状态';
}

export function PluginRegistryProvider({ children }: { children: ReactNode }) {
  const { user, can } = useAuth();
  const navigate = useNavigate();
  const [ownedStates, setOwnedStates] = useState<OwnedPluginStatesState>({
    ownerId: null,
    status: 'idle',
    states: EMPTY_PLUGIN_STATES,
    error: null,
  });
  const [registrations, setRegistrations] = useState<PluginRegistration[]>([]);
  const [registrationsLoading, setRegistrationsLoading] = useState(true);
  const [registrationsRefreshing, setRegistrationsRefreshing] = useState(false);
  const [remoteConfigurations, setRemoteConfigurations] = useState<RemotePluginConfiguration[]>([]);
  const [remoteConfigurationOwnerId, setRemoteConfigurationOwnerId] = useState<string | null>(null);
  const remoteDefinitions = useRef<RemotePluginDefinition[]>([]);
  const registrationRefreshPromise = useRef<Promise<void> | null>(null);
  const registrationRequestSequence = useRef(0);
  const remoteConfigurationRequestSequence = useRef(0);
  const stateRequestSequence = useRef(0);
  const channelBus = useMemo(() => createPluginChannelBus(), []);
  const query = useMemo(() => createWorkspaceQueryClient(user?.id ?? null), [user?.id]);

  useEffect(() => () => query.clear(), [query]);

  const syncRemoteDefinitions = useCallback((configurations: readonly RemotePluginConfiguration[]) => {
    const previous = new Map(remoteDefinitions.current.map((definition) => [definition.id, definition]));
    const next = configurations.map((configuration) => {
      const existing = previous.get(configuration.manifest.id);
      if (existing && JSON.stringify(existing.configuration) === JSON.stringify(configuration)) {
        previous.delete(configuration.manifest.id);
        return existing;
      }
      existing?.invalidate();
      previous.delete(configuration.manifest.id);
      return createRemotePluginDefinition(configuration);
    });
    for (const removed of previous.values()) removed.invalidate();
    remoteDefinitions.current = next;
    return next;
  }, []);

  const refreshRegistrations = useCallback(async (foreground = false, definitions = remoteDefinitions.current) => {
    if (foreground) setRegistrationsRefreshing(true);
    let request = registrationRefreshPromise.current;
    if (!request) {
      const requestSequence = ++registrationRequestSequence.current;
      request = (async () => {
        try {
          const remoteDescriptors = await inspectRemotePlugins(definitions);
          const nextRegistrations = await loadPluginRegistrations(
            [...installedPluginDescriptors, ...remoteDescriptors],
            PLUGIN_VALIDATION_OPTIONS,
          );
          if (requestSequence !== registrationRequestSequence.current) return;
          setRegistrations(nextRegistrations);
        } catch (reason) {
          console.error('刷新插件注册表失败', reason);
        } finally {
          if (requestSequence === registrationRequestSequence.current) setRegistrationsLoading(false);
        }
      })();
      registrationRefreshPromise.current = request;
      void request.finally(() => {
        if (registrationRefreshPromise.current === request) registrationRefreshPromise.current = null;
      });
    }
    try {
      await request;
    } finally {
      if (foreground) setRegistrationsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void refreshRegistrations(true);
    const interval = window.setInterval(
      () => void refreshRegistrations(false, remoteDefinitions.current),
      remotePluginHealthInterval,
    );
    return () => {
      window.clearInterval(interval);
      registrationRequestSequence.current += 1;
      registrationRefreshPromise.current = null;
    };
  }, [refreshRegistrations]);

  const applyRemoteConfigurations = useCallback(
    async (configurations: RemotePluginConfiguration[]) => {
      const definitions = syncRemoteDefinitions(configurations);
      setRemoteConfigurations(configurations);
      await registrationRefreshPromise.current;
      await refreshRegistrations(true, definitions);
    },
    [refreshRegistrations, syncRemoteDefinitions],
  );

  const reloadEnabledStates = useCallback(async () => {
    if (!user) return;
    const ownerId = user.id;
    const requestSequence = ++stateRequestSequence.current;
    setOwnedStates((current) => ({
      ownerId,
      status: 'loading',
      states: current.ownerId === ownerId ? current.states : EMPTY_PLUGIN_STATES,
      error: null,
    }));
    try {
      const response = await apiClient.get<{ plugins: PluginState[] }>('/api/plugins');
      if (requestSequence !== stateRequestSequence.current) return;
      setOwnedStates({ ownerId, status: 'ready', states: response.plugins, error: null });
    } catch (reason) {
      if (requestSequence !== stateRequestSequence.current) return;
      setOwnedStates((current) => ({
        ownerId,
        status: 'error',
        states: current.ownerId === ownerId ? current.states : EMPTY_PLUGIN_STATES,
        error: errorMessage(reason),
      }));
    }
  }, [user]);

  const reloadRemoteConfigurations = useCallback(async () => {
    if (!user) return;
    const ownerId = user.id;
    const requestSequence = ++remoteConfigurationRequestSequence.current;
    const response = await apiClient.get<{ plugins: RemotePluginConfiguration[] }>('/api/remote-plugins');
    if (requestSequence !== remoteConfigurationRequestSequence.current) return;
    await applyRemoteConfigurations(response.plugins);
    if (requestSequence === remoteConfigurationRequestSequence.current) setRemoteConfigurationOwnerId(ownerId);
  }, [applyRemoteConfigurations, user]);

  const reloadStates = useCallback(async () => {
    try {
      await reloadRemoteConfigurations();
    } catch (reason) {
      console.error('读取远程插件配置失败', reason);
      if (user) setRemoteConfigurationOwnerId(user.id);
    }
    await reloadEnabledStates();
  }, [reloadEnabledStates, reloadRemoteConfigurations, user]);

  useEffect(() => {
    if (!user) return;
    void reloadStates();
    return () => {
      remoteConfigurationRequestSequence.current += 1;
      stateRequestSequence.current += 1;
      registrationRequestSequence.current += 1;
      registrationRefreshPromise.current = null;
      syncRemoteDefinitions([]);
      setRemoteConfigurations([]);
      setRemoteConfigurationOwnerId(null);
      setRegistrations((current) => current.filter(({ source }) => source.sourceType !== 'remote'));
    };
  }, [reloadStates, syncRemoteDefinitions, user]);

  const statesState = useMemo<PluginStatesState>(() => {
    if (!user || ownedStates.ownerId !== user.id) return IDLE_PLUGIN_STATES;
    const { ownerId: _, ...current } = ownedStates;
    return current;
  }, [ownedStates, user]);
  const states = statesState.states;
  const loading =
    registrationsLoading ||
    Boolean(user && remoteConfigurationOwnerId !== user.id) ||
    Boolean(user && (statesState.status === 'idle' || (statesState.status === 'loading' && statesState.states.length === 0)));
  const enabledIds = useMemo(() => new Set(states.filter((state) => state.enabled).map((state) => state.id)), [states]);
  const activeRegistrations = useMemo(
    () =>
      registrations.filter(
        (registration): registration is ReadyPluginRegistration =>
          registration.status === 'ready' && enabledIds.has(registration.plugin.manifest.id),
      ),
    [enabledIds, registrations],
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
      statesState,
      loading,
      refreshing: registrationsRefreshing || statesState.status === 'loading',
      remoteConfigurations,
      routes,
      query,
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
          query,
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
            navigateTo(route, options) {
              const target = routes.find(
                ({ plugin, contribution }) => plugin.manifest.id === route.pluginId && contribution.id === route.routeId,
              );
              if (!target || !can(target.contribution.permission)) return;
              const search = new URLSearchParams();
              for (const [key, value] of Object.entries(options?.search ?? {})) {
                if (value !== null && value !== undefined) search.set(key, String(value));
              }
              const destination = search.size ? `${target.contribution.path}?${search.toString()}` : target.contribution.path;
              void navigate(destination, options?.replace === undefined ? {} : { replace: options.replace });
            },
          },
        };
      },
      reloadStates,
      async importRemotePlugin(origin) {
        const configuration = await discoverRemotePluginConfiguration(origin);
        const response = await apiClient.post<{ plugins: RemotePluginConfiguration[] }>('/api/remote-plugins', configuration);
        await applyRemoteConfigurations(response.plugins);
        await reloadEnabledStates();
      },
      async updateRemotePlugin(id, origin) {
        const configuration = await discoverRemotePluginConfiguration(origin);
        if (configuration.manifest.id !== id) {
          throw new Error(`新地址返回了其他插件：${configuration.manifest.id}`);
        }
        const response = await apiClient.put<{ plugins: RemotePluginConfiguration[] }>(
          `/api/remote-plugins/${encodeURIComponent(id)}`,
          configuration,
        );
        await applyRemoteConfigurations(response.plugins);
        await reloadEnabledStates();
      },
      async removeRemotePlugin(id) {
        const response = await apiClient.delete<{ plugins: RemotePluginConfiguration[] }>(
          `/api/remote-plugins/${encodeURIComponent(id)}`,
        );
        await applyRemoteConfigurations(response.plugins);
        await reloadEnabledStates();
      },
      async setEnabled(id, enabled) {
        const response = await apiClient.patch<{ plugins: PluginState[] }>(`/api/plugins/${id}`, { enabled });
        if (user) {
          stateRequestSequence.current += 1;
          setOwnedStates({ ownerId: user.id, status: 'ready', states: response.plugins, error: null });
        }
      },
    }),
    [
      activeRegistrations,
      applyRemoteConfigurations,
      can,
      channelBus,
      loading,
      navigate,
      query,
      registrations,
      registrationsRefreshing,
      reloadEnabledStates,
      reloadStates,
      remoteConfigurations,
      routeLinks,
      routes,
      states,
      statesState,
      user,
    ],
  );

  return <PluginRegistryContext.Provider value={value}>{children}</PluginRegistryContext.Provider>;
}

export function usePluginRegistry() {
  const context = useContext(PluginRegistryContext);
  if (!context) throw new Error('usePluginRegistry must be used inside PluginRegistryProvider');
  return context;
}
