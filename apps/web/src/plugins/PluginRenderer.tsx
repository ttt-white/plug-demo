import type { PluginComponentLoader, PluginComponentProps, PluginSlotReference } from '@fms/plugin-sdk';
import { Button, Result, Spin } from 'antd';
import { RefreshCw } from 'lucide-react';
import {
  Component,
  Suspense,
  createElement,
  lazy,
  useCallback,
  type ComponentType,
  type ErrorInfo,
  type LazyExoticComponent,
  type ReactNode,
} from 'react';
import { installedPlugins } from 'virtual:fms-installed-plugins';
import { FullScreenLoading } from '@/components/FullScreenLoading';
import { usePluginRegistry, type ResolvedRoute } from './PluginRegistryProvider';

const componentCache = new WeakMap<PluginComponentLoader, LazyExoticComponent<ComponentType<PluginComponentProps>>>();

interface PluginErrorBoundaryProps {
  children: ReactNode;
  title: string;
}

interface PluginErrorBoundaryState {
  error: Error | null;
}

class PluginErrorBoundary extends Component<PluginErrorBoundaryProps, PluginErrorBoundaryState> {
  override state: PluginErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): PluginErrorBoundaryState {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Plugin render failed', error, info.componentStack);
  }

  override render() {
    if (!this.state.error) return this.props.children;
    return (
      <Result
        extra={
          <Button icon={<RefreshCw aria-hidden="true" size={16} />} onClick={() => this.setState({ error: null })}>
            重试
          </Button>
        }
        role="alert"
        status="error"
        title={this.props.title}
      />
    );
  }
}

function PluginSuspense({ children }: { children: ReactNode }) {
  return <Suspense fallback={<Spin description="正在加载插件" />}>{children}</Suspense>;
}

for (const plugin of installedPlugins) {
  for (const contribution of [...(plugin.routes ?? []), ...(plugin.modules ?? [])]) {
    if (!componentCache.has(contribution.load)) componentCache.set(contribution.load, lazy(contribution.load));
  }
}

function getLazyComponent(loader: PluginComponentLoader) {
  const component = componentCache.get(loader);
  if (!component) throw new Error('插件组件未被自动发现');
  return component;
}

function usePluginRuntime(pluginId: string) {
  const { runtimeFor } = usePluginRegistry();
  const renderSlot = useCallback(
    (slot: PluginSlotReference, fallback?: ReactNode) =>
      slot.pluginId === pluginId ? (
        <PluginContributionSlot fallback={fallback} routeId={slot.routeId} slotId={slot.slotId} targetPluginId={pluginId} />
      ) : (
        (fallback ?? null)
      ),
    [pluginId],
  );
  return runtimeFor(pluginId, renderSlot);
}

export function PluginPageRenderer({ route }: { route: ResolvedRoute }) {
  const runtime = usePluginRuntime(route.plugin.manifest.id);
  if (!runtime) return <FullScreenLoading />;
  return (
    <PluginErrorBoundary title={`${route.plugin.manifest.name}暂不可用`}>
      <PluginSuspense>{createElement(getLazyComponent(route.contribution.load), { runtime })}</PluginSuspense>
    </PluginErrorBoundary>
  );
}

function PluginModuleRenderer({ module }: { module: ReturnType<ReturnType<typeof usePluginRegistry>['modulesFor']>[number] }) {
  const runtime = usePluginRuntime(module.plugin.manifest.id);
  if (!runtime) return null;
  return (
    <PluginErrorBoundary title={`${module.plugin.manifest.name}暂不可用`}>
      <PluginSuspense>{createElement(getLazyComponent(module.contribution.load), { runtime })}</PluginSuspense>
    </PluginErrorBoundary>
  );
}

function PluginContributionSlot({
  routeId,
  slotId,
  targetPluginId,
  fallback = null,
}: {
  routeId: string;
  slotId: string;
  targetPluginId?: string;
  fallback?: ReactNode;
}) {
  const { modulesFor } = usePluginRegistry();
  const modules = modulesFor(routeId, slotId, targetPluginId);
  if (modules.length === 0) return fallback;

  return (
    <div className="grid gap-4.5" data-route-id={routeId} data-slot-id={slotId} data-target-plugin-id={targetPluginId}>
      {modules.map((module) => (
        <PluginModuleRenderer key={`${module.plugin.manifest.id}:${module.contribution.id}`} module={module} />
      ))}
    </div>
  );
}

export function PluginSlot({ routeId, slotId, fallback = null }: { routeId: string; slotId: string; fallback?: ReactNode }) {
  return <PluginContributionSlot fallback={fallback} routeId={routeId} slotId={slotId} />;
}
