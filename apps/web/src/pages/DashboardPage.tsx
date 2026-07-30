import { PluginSlot } from '@/plugins/PluginRenderer';
import { apiClient } from '@/services/api-client';
import { PluginApiError } from '@fms/plugin-sdk';
import { PluginContainer, type PluginContentState } from '@fms/plugin-shared';
import { Col, Row, Statistic, Tag, Typography } from 'antd';
import { AlertTriangle, CheckCircle2, Clock3, Route } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

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
    <div className="grid gap-6">
      <section
        className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center"
        aria-labelledby="dashboard-title"
      >
        <div>
          <Typography.Text type="secondary">工作区概览</Typography.Text>
          <Typography.Title id="dashboard-title" level={2}>
            早上好，运输团队
          </Typography.Title>
          <Typography.Paragraph type="secondary">这里是今天需要关注的业务进展。</Typography.Paragraph>
        </div>
        <Tag icon={<CheckCircle2 aria-hidden="true" size={15} />} color="success">
          数据已同步
        </Tag>
      </section>

      <PluginContainer state={state} onRetry={load}>
        {(data) => (
          <Row gutter={[24, 24]}>
            <Col xs={24} md={8}>
              <Statistic
                prefix={<Route aria-hidden="true" size={20} />}
                suffix="项"
                title="进行中任务"
                value={data.activeTasks}
              />
            </Col>
            <Col xs={24} md={8}>
              <Statistic
                prefix={<AlertTriangle aria-hidden="true" size={20} />}
                suffix="条"
                title="待处理预警"
                value={data.alerts}
              />
            </Col>
            <Col xs={24} md={8}>
              <Statistic prefix={<Clock3 aria-hidden="true" size={20} />} title="数据更新时间" value={data.updatedAt} />
            </Col>
          </Row>
        )}
      </PluginContainer>

      <section aria-label="经营指标">
        <PluginSlot routeId="dashboard" slotId="dashboard.metrics" />
      </section>
    </div>
  );
}
