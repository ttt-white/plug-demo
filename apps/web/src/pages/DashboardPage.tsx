import { PluginSlot } from '@/plugins/PluginRenderer';
import { apiClient } from '@/services/api-client';
import { Button, Result, Spin, Typography } from 'antd';
import { RefreshCw } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

interface DashboardSummary {
  updatedAt: string;
  activeTasks: number;
  alerts: number;
  metrics: unknown[];
}

type ViewState = 'loading' | 'ready' | 'error';

export function DashboardPage() {
  const [state, setState] = useState<ViewState>('loading');

  const load = useCallback(() => {
    setState('loading');
    void apiClient
      .get<DashboardSummary>('/api/dashboard')
      .then(() => setState('ready'))
      .catch(() => setState('error'));
  }, []);

  useEffect(() => {
    let active = true;
    void apiClient
      .get<DashboardSummary>('/api/dashboard')
      .then(() => {
        if (active) setState('ready');
      })
      .catch(() => {
        if (active) setState('error');
      });
    return () => {
      active = false;
    };
  }, []);

  if (state === 'loading') return <Spin description="正在加载工作台" />;
  if (state === 'error') {
    return (
      <Result
        extra={
          <Button icon={<RefreshCw aria-hidden="true" size={16} />} onClick={load}>
            重试
          </Button>
        }
        status="error"
        title="工作台加载失败"
      />
    );
  }

  return (
    <div className="grid gap-4">
      <Typography.Text>这是宿主的工作台页面，对应菜单 one</Typography.Text>
      <PluginSlot routeId="dashboard" slotId="dashboard.metrics" />
    </div>
  );
}
