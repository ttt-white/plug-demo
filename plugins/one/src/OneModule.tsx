import { fmsDataContract } from '@fms/plugin-contracts';
import { usePluginQuery, type PluginComponentProps } from '@fms/plugin-sdk';
import { Alert, Button, Empty, Result, Spin, Typography } from 'antd';
import { RefreshCw, TrendingDown, TrendingUp } from 'lucide-react';

export default function OneModule({ runtime }: PluginComponentProps) {
  const metricsQuery = usePluginQuery(runtime.query, {
    queryKey: fmsDataContract.dashboard.queryKey,
    schema: fmsDataContract.dashboard.schema,
    queryFn: ({ signal }) => runtime.api.get<unknown>(fmsDataContract.dashboard.path, { signal }),
  });
  const dashboard = metricsQuery.data;

  if ((metricsQuery.status === 'loading' || metricsQuery.status === 'idle') && !dashboard) {
    return <Spin description="正在加载 one" />;
  }
  if (metricsQuery.status === 'error' && !dashboard) {
    return (
      <Result
        extra={
          <Button
            icon={<RefreshCw aria-hidden="true" size={16} />}
            onClick={() => void metricsQuery.refetch().catch(() => undefined)}
          >
            重试
          </Button>
        }
        status="error"
        title="one 加载失败"
      />
    );
  }
  if (!dashboard || dashboard.metrics.length === 0) {
    return <Empty description="暂无扩展业务指标" image={Empty.PRESENTED_IMAGE_SIMPLE} />;
  }

  return (
    <section aria-labelledby="business-metrics-title" className="grid gap-3">
      <Typography.Title className="m-0! text-base!" id="business-metrics-title" level={2}>
        业务指标
      </Typography.Title>
      {metricsQuery.status === 'error' ? (
        <Alert message="业务指标刷新失败，当前仍显示上次成功数据" showIcon type="warning" />
      ) : null}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        {dashboard.metrics.map((metric) => {
          const improved = metric.change >= 0;
          const TrendIcon = improved ? TrendingUp : TrendingDown;
          return (
            <article className="min-h-24 rounded-md border border-slate-200 bg-slate-50 p-4" key={metric.id}>
              <Typography.Text className="block text-xs" type="secondary">
                {metric.label}
              </Typography.Text>
              <div className="mt-2 flex items-end justify-between gap-3">
                <Typography.Text className="text-xl font-semibold text-slate-900">{metric.value}</Typography.Text>
                <span className={`inline-flex items-center gap-1 text-xs ${improved ? 'text-emerald-700' : 'text-red-700'}`}>
                  <TrendIcon aria-hidden="true" size={14} />
                  {Math.abs(metric.change)}%
                </span>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
