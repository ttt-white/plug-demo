import { PluginApiError, type PluginComponentProps } from '@fms/plugin-sdk';
import { PluginContainer, type PluginContentState } from '@fms/plugin-shared';
import { Input, Table, Tag, Typography, type TableColumnsType } from 'antd';
import { Search } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';

interface ReportRow {
  id: string;
  destination: string;
  carrier: string;
  status: '已完成' | '运输中' | '待处理';
  amount: string;
  updatedAt: string;
}

interface ReportsResponse {
  rows: ReportRow[];
}

const columns: TableColumnsType<ReportRow> = [
  { title: '任务单号', dataIndex: 'id', key: 'id', render: (value: string) => <Typography.Text strong>{value}</Typography.Text> },
  { title: '目的地', dataIndex: 'destination', key: 'destination' },
  { title: '承运商', dataIndex: 'carrier', key: 'carrier' },
  {
    title: '状态',
    dataIndex: 'status',
    key: 'status',
    render: (status: ReportRow['status']) => (
      <Tag color={status === '已完成' ? 'success' : status === '运输中' ? 'processing' : 'warning'}>{status}</Tag>
    ),
  },
  { title: '金额', dataIndex: 'amount', key: 'amount' },
  { title: '更新时间', dataIndex: 'updatedAt', key: 'updatedAt' },
];

function failureState(error: unknown): PluginContentState<ReportsResponse> {
  if (error instanceof PluginApiError && error.status === 403) return { status: 'forbidden' };
  if (!navigator.onLine) return { status: 'offline' };
  return { status: 'error', error };
}

export default function ReportsPage({ runtime }: PluginComponentProps) {
  const [query, setQuery] = useState('');
  const [state, setState] = useState<PluginContentState<ReportsResponse>>({ status: 'loading' });

  const loadReports = useCallback(() => {
    setState({ status: 'loading' });
    void runtime.api
      .get<ReportsResponse>('/api/reports')
      .then((data) => setState(data.rows.length ? { status: 'ready', data } : { status: 'empty' }))
      .catch((error: unknown) => setState(failureState(error)));
  }, [runtime.api]);

  useEffect(() => {
    let active = true;
    void runtime.api
      .get<ReportsResponse>('/api/reports')
      .then((data) => {
        if (active) setState(data.rows.length ? { status: 'ready', data } : { status: 'empty' });
      })
      .catch((error: unknown) => {
        if (active) setState(failureState(error));
      });
    return () => {
      active = false;
    };
  }, [runtime.api]);

  const visibleRows = useMemo(() => {
    if (state.status !== 'ready') return [];
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return state.data.rows;
    return state.data.rows.filter((row) =>
      [row.id, row.destination, row.carrier, row.status].some((value) => value.toLowerCase().includes(normalizedQuery)),
    );
  }, [query, state]);

  return (
    <div className="grid gap-5.5">
      <div className="flex flex-col items-stretch justify-between gap-4 md:flex-row md:items-end">
        <div>
          <span className="text-xs font-extrabold text-[#21845d] uppercase">页面插件</span>
          <Typography.Title className="mt-1! mb-1! text-3xl!" level={1}>
            履约报表
          </Typography.Title>
          <Typography.Paragraph className="m-0! text-sm! text-[#68736d]!">查看近期运输任务及其履约状态。</Typography.Paragraph>
        </div>
        <Input
          allowClear
          aria-label="搜索报表"
          className="w-full! md:w-85!"
          placeholder="搜索单号、目的地或承运商"
          prefix={<Search aria-hidden="true" size={17} />}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </div>

      <PluginContainer
        state={state.status === 'ready' && visibleRows.length === 0 ? { status: 'empty', message: '没有匹配的履约记录' } : state}
        onRetry={loadReports}
      >
        {() => <Table<ReportRow> columns={columns} dataSource={visibleRows} pagination={false} rowKey="id" scroll={{ x: 760 }} />}
      </PluginContainer>
    </div>
  );
}
