import { Button, Card, Empty, Result, Spin, Typography } from 'antd';
import { RefreshCw, WifiOff } from 'lucide-react';
import { Component, Suspense, type ErrorInfo, type ReactNode } from 'react';

export type PluginContentState<T> =
  | { status: 'loading'; message?: string }
  | { status: 'empty'; message?: string }
  | { status: 'error'; error?: unknown; message?: string }
  | { status: 'forbidden'; message?: string }
  | { status: 'offline'; message?: string }
  | { status: 'ready'; data: T };

interface PluginContainerProps<T> {
  title?: string;
  description?: string;
  actions?: ReactNode;
  state: PluginContentState<T>;
  onRetry?: () => void;
  children(data: T): ReactNode;
  className?: string;
}

const stateDefaults = {
  loading: '正在加载内容',
  empty: '暂无可展示的数据',
  error: '内容加载失败',
  forbidden: '你没有查看此内容的权限',
  offline: '网络连接不可用',
} as const;

export function PluginContainer<T>({
  title,
  description,
  actions,
  state,
  onRetry,
  children,
  className,
}: PluginContainerProps<T>) {
  const rootClassName = ['w-full min-w-0 overflow-hidden shadow-sm [&_.ant-card-body]:p-0', className].filter(Boolean).join(' ');

  const cardTitle =
    title || description ? (
      <div>
        {title && (
          <Typography.Title className="m-0! text-base!" level={2}>
            {title}
          </Typography.Title>
        )}
        {description && (
          <Typography.Paragraph className="mt-1! mb-0! text-xs! font-normal! text-[#69736e]!">{description}</Typography.Paragraph>
        )}
      </div>
    ) : undefined;

  const fallback = (() => {
    if (state.status === 'ready') return null;
    const message = state.message ?? stateDefaults[state.status];
    if (state.status === 'loading') {
      return (
        <div className="flex min-h-48 items-center justify-center" role="status">
          <Spin description={message} size="large">
            <div className="h-14 w-40" />
          </Spin>
        </div>
      );
    }
    if (state.status === 'empty') {
      return (
        <div className="grid min-h-48 place-items-center px-6 py-8" role="status">
          <Empty description={message} image={Empty.PRESENTED_IMAGE_SIMPLE} />
        </div>
      );
    }
    return (
      <div className="min-h-48" role={state.status === 'error' ? 'alert' : 'status'}>
        <Result
          className="py-8!"
          extra={
            onRetry && (state.status === 'error' || state.status === 'offline') ? (
              <Button icon={<RefreshCw aria-hidden="true" size={16} />} onClick={onRetry}>
                重试
              </Button>
            ) : undefined
          }
          icon={state.status === 'offline' ? <WifiOff aria-hidden="true" /> : undefined}
          status={state.status === 'forbidden' ? '403' : state.status === 'error' ? 'error' : 'warning'}
          title={message}
        />
      </div>
    );
  })();

  return (
    <Card className={rootClassName} extra={actions} title={cardTitle}>
      {state.status === 'ready' ? <div className="min-w-0">{children(state.data)}</div> : fallback}
    </Card>
  );
}

interface PluginErrorBoundaryProps {
  children: ReactNode;
  onReset?: () => void;
  title?: string;
}

interface PluginErrorBoundaryState {
  error: Error | null;
}

export class PluginErrorBoundary extends Component<PluginErrorBoundaryProps, PluginErrorBoundaryState> {
  override state: PluginErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): PluginErrorBoundaryState {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Plugin render failed', error, info.componentStack);
  }

  private readonly reset = () => {
    this.setState({ error: null });
    this.props.onReset?.();
  };

  override render() {
    if (this.state.error) {
      return (
        <PluginContainer
          title={this.props.title ?? '插件暂不可用'}
          state={{ status: 'error', error: this.state.error, message: '该插件发生了渲染错误，其他内容不受影响。' }}
          onRetry={this.reset}
        >
          {() => null}
        </PluginContainer>
      );
    }
    return this.props.children;
  }
}

export function PluginSuspense({ children }: { children: ReactNode }) {
  return <Suspense fallback={<PluginContainer state={{ status: 'loading' }}>{() => null}</PluginContainer>}>{children}</Suspense>;
}
