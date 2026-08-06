import { usePluginRegistry } from '@/plugins/PluginRegistryProvider';
import { PluginSlot } from '@/plugins/PluginRenderer';
import { apiClient } from '@/services/api-client';
import { fmsDataContract, hostContract } from '@tt-plug/plugin-contracts';
import { usePluginQuery } from '@tt-plug/plugin-sdk';
import { Button, Typography } from 'antd';
import { RefreshCw } from 'lucide-react';

export function DashboardPage() {
  const { query } = usePluginRegistry();
  const statusQuery = usePluginQuery(query, {
    queryKey: fmsDataContract.status.queryKey,
    schema: fmsDataContract.status.schema,
    queryFn: ({ signal }) => apiClient.get<unknown>(fmsDataContract.status.path, { signal }),
  });

  return (
    <section aria-labelledby="dashboard-title" className="grid gap-5">
      <header className="flex items-start justify-between gap-3">
        <div>
          <Typography.Title className="m-0! text-2xl!" id="dashboard-title" level={1}>
            工作台
          </Typography.Title>
          <Typography.Text type="secondary">宿主应用</Typography.Text>
        </div>
        <Button
          aria-label="刷新共享状态"
          icon={<RefreshCw aria-hidden="true" size={16} />}
          loading={statusQuery.isFetching}
          onClick={() => void statusQuery.refetch().catch(() => undefined)}
        />
      </header>

      <Typography.Text aria-live="polite">
        {statusQuery.data?.message ?? (statusQuery.status === 'error' ? '共享 API 暂不可用' : '正在读取共享状态')}
      </Typography.Text>

      <PluginSlot
        fallback={<Typography.Text type="secondary">one 当前未启用</Typography.Text>}
        routeId={hostContract.slots.dashboard.routeId}
        slotId={hostContract.slots.dashboard.slotId}
      />
    </section>
  );
}
