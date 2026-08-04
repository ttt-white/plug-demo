import { REPORT_STATUSES, fmsDataContract, type ReportRow, type ReportStatus } from '@fms/plugin-contracts';
import { usePluginQuery, type PluginComponentProps, type PluginQueryKeyPart } from '@fms/plugin-sdk';
import { Alert, Button, Empty, Result, Select, Spin, Table, Tag, Tooltip, Typography, type TableProps } from 'antd';
import { ArrowRight, RefreshCw, RotateCcw } from 'lucide-react';
import { useCallback, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { twoContract } from './contract';

const SORT_FIELDS = ['id', 'carrier', 'status', 'amount', 'updatedAt'] as const;
type SortField = (typeof SORT_FIELDS)[number];
type SortOrder = 'asc' | 'desc';

const statusColors: Record<ReportStatus, string> = {
  待处理: 'gold',
  运输中: 'blue',
  已完成: 'green',
  异常: 'red',
};

function isReportStatus(value: string | null): value is ReportStatus {
  return value !== null && REPORT_STATUSES.includes(value as ReportStatus);
}

function isSortField(value: string | null): value is SortField {
  return value !== null && SORT_FIELDS.includes(value as SortField);
}

function formatAmount(amount: number) {
  return new Intl.NumberFormat('zh-CN', { style: 'currency', currency: 'CNY', maximumFractionDigits: 0 }).format(amount);
}

export default function TwoPage({ runtime }: PluginComponentProps) {
  const [searchParams, setSearchParams] = useSearchParams();
  const carrier = searchParams.get('carrier')?.trim() || null;
  const statusParam = searchParams.get('status');
  const status = isReportStatus(statusParam) ? statusParam : null;
  const sortParam = searchParams.get('sort');
  const sort = isSortField(sortParam) ? sortParam : null;
  const order: SortOrder = searchParams.get('order') === 'desc' ? 'desc' : 'asc';

  const updateSearch = useCallback(
    (updates: Record<string, string | null>, replace = true) => {
      setSearchParams(
        (current) => {
          const next = new URLSearchParams(current);
          for (const [key, value] of Object.entries(updates)) {
            if (value) next.set(key, value);
            else next.delete(key);
          }
          return next;
        },
        { replace },
      );
    },
    [setSearchParams],
  );

  useEffect(
    () =>
      runtime.channel.subscribe(twoContract.channels.filterCarrier, ({ carrier: nextCarrier }) => {
        updateSearch({ carrier: nextCarrier }, false);
      }),
    [runtime.channel, updateSearch],
  );

  const requestSearch = new URLSearchParams();
  if (carrier) requestSearch.set('carrier', carrier);
  if (status) requestSearch.set('status', status);
  if (sort) {
    requestSearch.set('sort', sort);
    requestSearch.set('order', order);
  }
  const requestPath = requestSearch.size
    ? `${fmsDataContract.reports.path}?${requestSearch.toString()}`
    : fmsDataContract.reports.path;
  const queryKey: PluginQueryKeyPart[] = [...fmsDataContract.reports.queryKey, carrier, status, sort, sort ? order : null];
  const reportsQuery = usePluginQuery(runtime.query, {
    queryKey,
    schema: fmsDataContract.reports.schema,
    queryFn: ({ signal }) => runtime.api.get<unknown>(requestPath, { signal }),
  });
  const reports = reportsQuery.data;
  const linkedRoutes = runtime.extensions.routesFor(twoContract.routes.two);

  const columns: TableProps<ReportRow>['columns'] = [
    {
      title: '运单号',
      dataIndex: 'id',
      key: 'id',
      sorter: true,
      sortOrder: sort === 'id' ? (order === 'asc' ? 'ascend' : 'descend') : null,
      render: (value: string) => <Typography.Text className="font-medium">{value}</Typography.Text>,
    },
    {
      title: '运输线路',
      key: 'route',
      render: (_, row) => (
        <span className="whitespace-nowrap">
          {row.origin} <span className="text-slate-400">→</span> {row.destination}
        </span>
      ),
    },
    {
      title: '承运商',
      dataIndex: 'carrier',
      key: 'carrier',
      sorter: true,
      sortOrder: sort === 'carrier' ? (order === 'asc' ? 'ascend' : 'descend') : null,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      sorter: true,
      sortOrder: sort === 'status' ? (order === 'asc' ? 'ascend' : 'descend') : null,
      render: (value: ReportStatus) => <Tag color={statusColors[value]}>{value}</Tag>,
    },
    {
      title: '运输费用',
      dataIndex: 'amount',
      key: 'amount',
      align: 'right',
      sorter: true,
      sortOrder: sort === 'amount' ? (order === 'asc' ? 'ascend' : 'descend') : null,
      render: (value: number) => formatAmount(value),
    },
    {
      title: '更新时间',
      dataIndex: 'updatedAt',
      key: 'updatedAt',
      sorter: true,
      sortOrder: sort === 'updatedAt' ? (order === 'asc' ? 'ascend' : 'descend') : null,
    },
  ];

  const handleTableChange: TableProps<ReportRow>['onChange'] = (_, __, sorter) => {
    const activeSorter = Array.isArray(sorter) ? sorter[0] : sorter;
    const field = typeof activeSorter?.field === 'string' && isSortField(activeSorter.field) ? activeSorter.field : null;
    updateSearch({
      sort: activeSorter?.order && field ? field : null,
      order: activeSorter?.order === 'descend' ? 'desc' : activeSorter?.order ? 'asc' : null,
    });
  };

  return (
    <section aria-labelledby="reports-title" className="grid w-full min-w-0 gap-4">
      <header className="flex min-w-0 items-start justify-between gap-3">
        <div className="min-w-0">
          <Typography.Title id="reports-title" className="m-0! text-2xl!" level={1}>
            履约报表
          </Typography.Title>
          {reports ? (
            <Typography.Text className="text-xs" type="secondary">
              共 {reports.total} 条 · 数据更新于 {reports.updatedAt}
            </Typography.Text>
          ) : null}
        </div>
        <Tooltip title="刷新履约报表">
          <Button
            aria-label="刷新履约报表"
            icon={<RefreshCw aria-hidden="true" size={16} />}
            loading={reportsQuery.isFetching && reports !== undefined}
            onClick={() => void reportsQuery.refetch().catch(() => undefined)}
          />
        </Tooltip>
      </header>

      <div className="flex flex-wrap items-center gap-2" role="search">
        <Select
          allowClear
          aria-label="按承运商筛选"
          className="min-w-40"
          onChange={(value: string | undefined) => updateSearch({ carrier: value ?? null })}
          options={(reports?.facets.carriers ?? []).map((value) => ({ label: value, value }))}
          placeholder="全部承运商"
          value={carrier ?? undefined}
        />
        <Select
          allowClear
          aria-label="按状态筛选"
          className="min-w-32"
          onChange={(value: ReportStatus | undefined) => updateSearch({ status: value ?? null })}
          options={REPORT_STATUSES.map((value) => ({ label: value, value }))}
          placeholder="全部状态"
          value={status ?? undefined}
        />
        {carrier || status || sort ? (
          <Tooltip title="清除全部筛选和排序">
            <Button
              aria-label="清除全部筛选和排序"
              icon={<RotateCcw aria-hidden="true" size={16} />}
              onClick={() => updateSearch({ carrier: null, status: null, sort: null, order: null })}
            />
          </Tooltip>
        ) : null}
        <div className="ml-auto flex flex-wrap gap-2">
          {linkedRoutes.map((route) => (
            <Button
              icon={<ArrowRight aria-hidden="true" size={16} />}
              key={`${route.pluginId}:${route.id}`}
              onClick={() => runtime.extensions.navigateTo(route.targetRoute)}
            >
              {route.label}
            </Button>
          ))}
        </div>
      </div>

      {reportsQuery.status === 'error' && reports ? (
        <Alert
          action={
            <Button onClick={() => void reportsQuery.refetch().catch(() => undefined)} size="small">
              重试
            </Button>
          }
          message="报表刷新失败，当前仍显示上次成功数据"
          showIcon
          type="warning"
        />
      ) : null}

      <div aria-live="polite" className="min-h-40 w-full max-w-full min-w-0">
        {(reportsQuery.status === 'loading' || reportsQuery.status === 'idle') && !reports ? (
          <Spin description="正在加载履约报表" />
        ) : reportsQuery.status === 'error' && !reports ? (
          <Result
            extra={
              <Button
                icon={<RefreshCw aria-hidden="true" size={16} />}
                onClick={() => void reportsQuery.refetch().catch(() => undefined)}
              >
                重试
              </Button>
            }
            status="error"
            subTitle={reportsQuery.error?.message}
            title="履约报表加载失败"
          />
        ) : reports ? (
          <Table<ReportRow>
            className="w-full max-w-full min-w-0"
            columns={columns}
            dataSource={reports.rows}
            locale={{ emptyText: <Empty description="当前筛选条件下暂无运单" image={Empty.PRESENTED_IMAGE_SIMPLE} /> }}
            onChange={handleTableChange}
            pagination={false}
            rowKey="id"
            scroll={{ x: 840 }}
            size="small"
          />
        ) : null}
      </div>

      {runtime.extensions.renderSlot(twoContract.slots.summary)}
    </section>
  );
}
