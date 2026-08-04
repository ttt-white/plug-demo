import { usePluginRegistry } from '@/plugins/PluginRegistryProvider';
import { PluginSlot } from '@/plugins/PluginRenderer';
import { apiClient } from '@/services/api-client';
import { fmsDataContract } from '@fms/plugin-contracts';
import { usePluginQuery } from '@fms/plugin-sdk';
import { Alert, Button, Empty, Result, Spin, Tooltip, Typography } from 'antd';
import { CircleCheck, Clock3, RefreshCw, Send, TriangleAlert, Truck, type LucideIcon } from 'lucide-react';

interface KpiDefinition {
  id: string;
  label: string;
  value: number;
  suffix?: string;
  icon: LucideIcon;
  iconClassName: string;
  iconBackgroundClassName: string;
}

export function DashboardPage() {
  const { query } = usePluginRegistry();
  const dashboardQuery = usePluginQuery(query, {
    queryKey: fmsDataContract.dashboard.queryKey,
    schema: fmsDataContract.dashboard.schema,
    queryFn: ({ signal }) => apiClient.get<unknown>(fmsDataContract.dashboard.path, { signal }),
  });
  const dashboard = dashboardQuery.data;
  const kpis: KpiDefinition[] = dashboard
    ? [
        {
          id: 'in-transit',
          label: '在途运单',
          value: dashboard.inTransit,
          icon: Truck,
          iconClassName: 'text-blue-700',
          iconBackgroundClassName: 'bg-blue-50',
        },
        {
          id: 'pending-dispatch',
          label: '待调度',
          value: dashboard.pendingDispatch,
          icon: Send,
          iconClassName: 'text-amber-700',
          iconBackgroundClassName: 'bg-amber-50',
        },
        {
          id: 'exceptions',
          label: '异常待处理',
          value: dashboard.exceptions,
          icon: TriangleAlert,
          iconClassName: 'text-red-700',
          iconBackgroundClassName: 'bg-red-50',
        },
        {
          id: 'completed-today',
          label: '今日完成',
          value: dashboard.completedToday,
          icon: CircleCheck,
          iconClassName: 'text-emerald-700',
          iconBackgroundClassName: 'bg-emerald-50',
        },
        {
          id: 'on-time-rate',
          label: '准时交付率',
          value: dashboard.onTimeRate,
          suffix: '%',
          icon: Clock3,
          iconClassName: 'text-cyan-700',
          iconBackgroundClassName: 'bg-cyan-50',
        },
      ]
    : [];
  const isEmpty = dashboard !== undefined && kpis.every(({ value }) => value === 0) && dashboard.metrics.length === 0;

  return (
    <section aria-labelledby="dashboard-title" className="grid gap-4">
      <header className="flex min-w-0 items-start justify-between gap-3">
        <div className="min-w-0">
          <Typography.Title id="dashboard-title" className="m-0! text-2xl!" level={1}>
            工作台
          </Typography.Title>
          {dashboard ? (
            <Typography.Text className="text-xs" type="secondary">
              数据更新于 {dashboard.updatedAt}
            </Typography.Text>
          ) : null}
        </div>
        <Tooltip title="刷新工作台数据">
          <Button
            aria-label="刷新工作台数据"
            icon={<RefreshCw aria-hidden="true" size={16} />}
            loading={dashboardQuery.isFetching && dashboard !== undefined}
            onClick={() => void dashboardQuery.refetch().catch(() => undefined)}
          />
        </Tooltip>
      </header>
      {dashboardQuery.status === 'error' && dashboard ? (
        <Alert message="工作台刷新失败，当前仍显示上次成功数据" showIcon type="warning" />
      ) : null}
      <div aria-live="polite" className="min-h-24">
        {(dashboardQuery.status === 'loading' || dashboardQuery.status === 'idle') && !dashboard ? (
          <Spin description="正在加载工作台" />
        ) : dashboardQuery.status === 'error' && !dashboard ? (
          <Result
            extra={
              <Button
                icon={<RefreshCw aria-hidden="true" size={16} />}
                onClick={() => void dashboardQuery.refetch().catch(() => undefined)}
              >
                重试
              </Button>
            }
            status="error"
            subTitle={dashboardQuery.error?.message}
            title="工作台加载失败"
          />
        ) : !dashboard || isEmpty ? (
          <Empty description="暂无工作台数据" image={Empty.PRESENTED_IMAGE_SIMPLE} />
        ) : (
          <div className="grid gap-5">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
              {kpis.map(({ id, label, value, suffix, icon: Icon, iconClassName, iconBackgroundClassName }) => (
                <article className="flex min-h-24 items-center gap-3 rounded-md border border-slate-200 bg-white p-4" key={id}>
                  <span className={`grid size-10 shrink-0 place-items-center rounded-md ${iconBackgroundClassName}`}>
                    <Icon aria-hidden="true" className={iconClassName} size={20} />
                  </span>
                  <div className="min-w-0">
                    <Typography.Text className="block text-xs" type="secondary">
                      {label}
                    </Typography.Text>
                    <Typography.Text className="block text-xl font-semibold text-slate-900">
                      {value.toLocaleString('zh-CN')}
                      {suffix}
                    </Typography.Text>
                  </div>
                </article>
              ))}
            </div>
            <PluginSlot routeId="dashboard" slotId="dashboard.metrics" />
          </div>
        )}
      </div>
    </section>
  );
}
