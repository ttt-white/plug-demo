import type { PluginComponentLoader, PluginComponentProps } from '@fms/plugin-sdk';
import { PluginErrorBoundary, PluginSuspense } from '@fms/plugin-shared';
import { createElement, lazy, type LazyExoticComponent, type ComponentType, type ReactNode } from 'react';
import { FullScreenLoading } from '@/components/FullScreenLoading';
import { installedPlugins } from './installedPlugins';
import { usePluginRegistry, type ResolvedRoute } from './PluginRegistryProvider';

const componentCache = new WeakMap<PluginComponentLoader, LazyExoticComponent<ComponentType<PluginComponentProps>>>();

for (const plugin of installedPlugins) {
  for (const contribution of [...(plugin.routes ?? []), ...(plugin.modules ?? [])]) {
    if (!componentCache.has(contribution.load)) componentCache.set(contribution.load, lazy(contribution.load));
  }
}

function getLazyComponent(loader: PluginComponentLoader) {
  const component = componentCache.get(loader);
  if (!component) throw new Error('插件组件未在 installedPlugins 中注册');
  return component;
}

export function PluginPageRenderer({ route }: { route: ResolvedRoute }) {
  const { runtime } = usePluginRegistry();
  if (!runtime) return <FullScreenLoading />;
  return (
    <PluginErrorBoundary title={`${route.plugin.manifest.name}暂不可用`}>
      <PluginSuspense>{createElement(getLazyComponent(route.contribution.load), { runtime })}</PluginSuspense>
    </PluginErrorBoundary>
  );
}

export function PluginSlot({ routeId, slotId, fallback = null }: { routeId: string; slotId: string; fallback?: ReactNode }) {
  const { modulesFor, runtime } = usePluginRegistry();
  if (!runtime) return fallback;
  const modules = modulesFor(routeId, slotId);
  if (modules.length === 0) return fallback;

  return (
    <div className="grid gap-4.5" data-route-id={routeId} data-slot-id={slotId}>
      {modules.map(({ plugin, contribution }) => {
        return (
          <PluginErrorBoundary key={`${plugin.manifest.id}:${contribution.id}`} title={`${plugin.manifest.name}暂不可用`}>
            <PluginSuspense>{createElement(getLazyComponent(contribution.load), { runtime })}</PluginSuspense>
          </PluginErrorBoundary>
        );
      })}
    </div>
  );
}
