import { PluginApiError } from '@fms/plugin-sdk';
import { PluginContainer, type PluginContentState } from '@fms/plugin-shared';
import { Statistic, Tag, Typography } from 'antd';
import { AlertTriangle, CheckCircle2, Clock3, Route } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { PluginSlot } from '@/plugins/PluginRenderer';
import { apiClient } from '@/services/api-client';

interface DashboardSummary {
  updatedAt: string;
  activeTasks: number;
  alerts: number;
  metrics: unknown[];
}

function failureState(error: unknown): PluginContentState<DashboardSummary> {
  if (error instanceof PluginApiError && error.status === 403) return { status: 'forbidden' };
  return { status: 'error', error };
}

export function DashboardPage() {
  const [state, setState] = useState<PluginContentState<DashboardSummary>>({ status: 'loading' });

  const load = useCallback(() => {
    setState({ status: 'loading' });
    void apiClient
      .get<DashboardSummary>('/api/dashboard')
      .then((data) => setState({ status: 'ready', data }))
      .catch((error: unknown) => setState(failureState(error)));
  }, []);

  useEffect(() => {
    let active = true;
    void apiClient
      .get<DashboardSummary>('/api/dashboard')
      .then((data) => {
        if (active) setState({ status: 'ready', data });
      })
      .catch((error: unknown) => {
        if (active) setState(failureState(error));
      });
    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="grid gap-5.5">
      <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <span className="text-xs font-extrabold text-[#21845d] uppercase">工作区概览</span>
          <Typography.Title className="mt-1! mb-1! text-3xl!" level={1}>
            早上好，运输团队
          </Typography.Title>
          <Typography.Paragraph className="m-0! text-sm! text-[#707b75]!">这里是今天需要关注的业务进展。</Typography.Paragraph>
        </div>
        <Tag icon={<CheckCircle2 aria-hidden="true" size={15} />} color="success">
          数据已同步
        </Tag>
      </div>

      <PluginContainer state={state} onRetry={load}>
        {(data) => (
          <div className="grid divide-y divide-[#edf0ee] sm:grid-cols-[1fr_1fr_1.25fr] sm:divide-x sm:divide-y-0">
            <div className="flex items-center gap-3 px-5.5 py-5">
              <span className="grid size-10 shrink-0 place-items-center rounded-md bg-[#e7f5ee] text-[#1b7a55]">
                <Route aria-hidden="true" size={18} />
              </span>
              <Statistic title="进行中任务" value={data.activeTasks} />
            </div>
            <div className="flex items-center gap-3 px-5.5 py-5">
              <span className="grid size-10 shrink-0 place-items-center rounded-md bg-[#fff2d7] text-[#a17220]">
                <AlertTriangle aria-hidden="true" size={18} />
              </span>
              <Statistic title="待处理预警" value={data.alerts} />
            </div>
            <div className="flex items-center gap-3 px-5.5 py-5">
              <span className="grid size-10 shrink-0 place-items-center rounded-md bg-[#e9f1fb] text-[#326999]">
                <Clock3 aria-hidden="true" size={18} />
              </span>
              <Statistic className="[&_.ant-statistic-content]:text-base!" title="数据更新时间" value={data.updatedAt} />
            </div>
          </div>
        )}
      </PluginContainer>

      <PluginSlot routeId="dashboard" slotId="dashboard.metrics" />
    </div>
  );
}
