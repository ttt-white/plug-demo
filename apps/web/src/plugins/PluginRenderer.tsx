import { FullScreenLoading } from '@/components/FullScreenLoading';
import type { PluginComponentLoader, PluginComponentProps, PluginSlotReference } from '@fms/plugin-sdk';
import { Button, Result, Space, Spin } from 'antd';
import { RefreshCw } from 'lucide-react';
import { Component, Suspense, createElement, lazy, useCallback, useMemo, useState, type ErrorInfo, type ReactNode } from 'react';
import { usePluginRegistry, type ResolvedRoute } from './PluginRegistryProvider';

interface PluginErrorBoundaryProps {
  children: ReactNode;
  title: string;
  onRetry(): void;
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
    const chunkLoadFailed = isChunkLoadError(this.state.error);
    return (
      <Result
        extra={
          <Space wrap>
            <Button icon={<RefreshCw aria-hidden="true" size={16} />} onClick={this.props.onRetry}>
              重试
            </Button>
            {chunkLoadFailed && <Button onClick={() => window.location.reload()}>刷新页面</Button>}
          </Space>
        }
        role="alert"
        status="error"
        title={this.props.title}
      />
    );
  }
}

function isChunkLoadError(error: Error) {
  return /ChunkLoadError|Failed to fetch dynamically imported module|Importing a module script failed|Loading chunk/i.test(
    `${error.name}: ${error.message}`,
  );
}

function PluginSuspense({ children }: { children: ReactNode }) {
  return <Suspense fallback={<Spin description="正在加载插件" />}>{children}</Suspense>;
}

function PluginComponentRenderer({
  loader,
  runtime,
  title,
}: {
  loader: PluginComponentLoader;
  runtime: PluginComponentProps['runtime'];
  title: string;
}) {
  const [attempt, setAttempt] = useState(0);
  const component = useMemo(
    () =>
      lazy(() => {
        void attempt;
        return loader();
      }),
    [attempt, loader],
  );
  return (
    <PluginErrorBoundary key={attempt} title={title} onRetry={() => setAttempt((current) => current + 1)}>
      <PluginSuspense>{createElement(component, { runtime })}</PluginSuspense>
    </PluginErrorBoundary>
  );
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
    <PluginComponentRenderer loader={route.contribution.load} runtime={runtime} title={`${route.plugin.manifest.name}暂不可用`} />
  );
}

function PluginModuleRenderer({ module }: { module: ReturnType<ReturnType<typeof usePluginRegistry>['modulesFor']>[number] }) {
  const runtime = usePluginRuntime(module.plugin.manifest.id);
  if (!runtime) return null;
  return (
    <PluginComponentRenderer
      loader={module.contribution.load}
      runtime={runtime}
      title={`${module.plugin.manifest.name}暂不可用`}
    />
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
