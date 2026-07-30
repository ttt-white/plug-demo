import { PluginApiError, type PluginComponentProps } from '@fms/plugin-sdk';
import { PluginContainer, type PluginContentState } from '@fms/plugin-shared';
import { Statistic, Tag } from 'antd';
import { ArrowDownRight, ArrowUpRight, Boxes, CircleDollarSign, Truck } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

interface DashboardMetric {
  id: string;
  label: string;
  value: string;
  change: number;
}

interface DashboardResponse {
  metrics: DashboardMetric[];
}

function failureState(error: unknown): PluginContentState<DashboardResponse> {
  if (error instanceof PluginApiError && error.status === 403) return { status: 'forbidden' };
  if (!navigator.onLine) return { status: 'offline' };
  return { status: 'error', error };
}

const metricIcons = [CircleDollarSign, Boxes, Truck];

export default function MetricsModule({ runtime }: PluginComponentProps) {
  const [state, setState] = useState<PluginContentState<DashboardResponse>>({ status: 'loading' });

  const loadMetrics = useCallback(() => {
    setState({ status: 'loading' });
    void runtime.api
      .get<DashboardResponse>('/api/dashboard')
      .then((data) => setState(data.metrics.length ? { status: 'ready', data } : { status: 'empty' }))
      .catch((error: unknown) => setState(failureState(error)));
  }, [runtime.api]);

  useEffect(() => {
    let active = true;
    void runtime.api
      .get<DashboardResponse>('/api/dashboard')
      .then((data) => {
        if (active) setState(data.metrics.length ? { status: 'ready', data } : { status: 'empty' });
      })
      .catch((error: unknown) => {
        if (active) setState(failureState(error));
      });
    return () => {
      active = false;
    };
  }, [runtime.api]);

  return (
    <PluginContainer
      title="实时经营指标"
      description="来自经营指标插件，数据每次进入工作台时刷新"
      state={state}
      onRetry={loadMetrics}
    >
      {(data) => (
        <div className="grid divide-y divide-[#edf0ee] sm:grid-cols-3 sm:divide-x sm:divide-y-0">
          {data.metrics.map((metric, index) => {
            const Icon = metricIcons[index] ?? Boxes;
            const ChangeIcon = metric.change >= 0 ? ArrowUpRight : ArrowDownRight;
            return (
              <article className="flex min-w-0 items-start gap-3.5 px-5.5 py-6" key={metric.id}>
                <div className="grid size-10 shrink-0 place-items-center rounded-md bg-[#e6f5ee] text-[#197451]">
                  <Icon aria-hidden="true" size={20} />
                </div>
                <div className="min-w-0">
                  <Statistic styles={{ content: { fontSize: 24 } }} title={metric.label} value={metric.value} />
                  <Tag
                    className="mt-1"
                    color={metric.change >= 0 ? 'success' : 'error'}
                    icon={<ChangeIcon aria-hidden="true" size={13} />}
                    variant="filled"
                  >
                    {Math.abs(metric.change)}%
                  </Tag>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </PluginContainer>
  );
}
