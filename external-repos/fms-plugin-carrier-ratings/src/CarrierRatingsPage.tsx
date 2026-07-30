import { PluginApiError, type PluginComponentProps } from '@fms/plugin-sdk';
import { PluginContainer, type PluginContentState } from '@fms/plugin-shared';
import { Input, Progress, Statistic, Table, Tag, Typography, type TableColumnsType } from 'antd';
import { BadgeCheck, Search } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';

interface CarrierRating {
  id: string;
  carrier: string;
  level: 'A' | 'B' | 'C';
  score: number;
  onTimeRate: number;
  incidents: number;
  trend: number;
}

interface CarrierRatingsResponse {
  rows: CarrierRating[];
  updatedAt: string;
}

function failureState(error: unknown): PluginContentState<CarrierRatingsResponse> {
  if (error instanceof PluginApiError && error.status === 403) return { status: 'forbidden' };
  if (!navigator.onLine) return { status: 'offline' };
  return { status: 'error', error };
}

const columns: TableColumnsType<CarrierRating> = [
  {
    title: '承运商',
    dataIndex: 'carrier',
    key: 'carrier',
    render: (carrier: string) => <Typography.Text strong>{carrier}</Typography.Text>,
  },
  {
    title: '评级',
    dataIndex: 'level',
    key: 'level',
    render: (level: CarrierRating['level']) => (
      <Tag color={level === 'A' ? 'success' : level === 'B' ? 'blue' : 'warning'}>{level} 级</Tag>
    ),
  },
  {
    title: '综合分',
    dataIndex: 'score',
    key: 'score',
    render: (score: number) => <Progress percent={score} size="small" status="active" />,
  },
  {
    title: '准时率',
    dataIndex: 'onTimeRate',
    key: 'onTimeRate',
    render: (rate: number) => `${rate}%`,
  },
  { title: '近 30 天异常', dataIndex: 'incidents', key: 'incidents' },
  {
    title: '评分变化',
    dataIndex: 'trend',
    key: 'trend',
    render: (trend: number) => (
      <Typography.Text type={trend < 0 ? 'danger' : 'success'}>{trend > 0 ? `+${trend}` : trend}</Typography.Text>
    ),
  },
];

export default function CarrierRatingsPage({ runtime }: PluginComponentProps) {
  const [query, setQuery] = useState('');
  const [state, setState] = useState<PluginContentState<CarrierRatingsResponse>>({ status: 'loading' });

  const retry = useCallback(() => {
    setState({ status: 'loading' });
    void runtime.api
      .get<CarrierRatingsResponse>('/api/carrier-ratings')
      .then((data) => setState(data.rows.length ? { status: 'ready', data } : { status: 'empty' }))
      .catch((error: unknown) => setState(failureState(error)));
  }, [runtime.api]);

  useEffect(() => {
    let active = true;
    void runtime.api
      .get<CarrierRatingsResponse>('/api/carrier-ratings')
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
    return state.data.rows.filter((row) => row.carrier.toLowerCase().includes(normalizedQuery));
  }, [query, state]);

  const visibleState: PluginContentState<CarrierRatingsResponse> =
    state.status === 'ready' && visibleRows.length === 0 ? { status: 'empty', message: '没有匹配的承运商' } : state;

  return (
    <div className="grid min-w-0 gap-5.5">
      <div className="flex flex-col items-stretch justify-between gap-4 md:flex-row md:items-end">
        <div className="min-w-0">
          <span className="inline-flex items-center gap-1.5 text-xs font-extrabold text-emerald-700 uppercase">
            <BadgeCheck aria-hidden="true" size={15} />
            外部页面插件1112
          </span>
          <Typography.Title className="mt-1! mb-1! text-3xl!" level={1}>
            承运商评级
          </Typography.Title>
          <Typography.Paragraph className="m-0! text-sm! text-neutral-500!">
            根据准时履约、运输异常和近期趋势评估合作质量。
          </Typography.Paragraph>
        </div>
        <Input
          allowClear
          aria-label="搜索承运商"
          className="w-full! md:w-80!"
          placeholder="搜索承运商"
          prefix={<Search aria-hidden="true" size={17} />}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </div>

      <PluginContainer
        description={state.status === 'ready' ? `数据更新于 ${state.data.updatedAt}` : '综合最近 30 天的履约数据'}
        state={visibleState}
        title="评级明细"
        onRetry={retry}
      >
        {(data) => {
          const averageScore = Math.round(data.rows.reduce((total, row) => total + row.score, 0) / data.rows.length);
          const topLevelCount = data.rows.filter((row) => row.level === 'A').length;
          return (
            <div className="min-w-0">
              <div className="grid grid-cols-2 gap-4 border-b border-neutral-200 px-5 py-4 sm:grid-cols-3">
                <Statistic title="参评承运商" value={data.rows.length} suffix="家" />
                <Statistic title="平均综合分" value={averageScore} suffix="分" />
                <Statistic className="col-span-2 sm:col-span-1" title="A 级承运商" value={topLevelCount} suffix="家" />
              </div>
              <Table<CarrierRating>
                columns={columns}
                dataSource={visibleRows}
                pagination={false}
                rowKey="id"
                scroll={{ x: 760 }}
              />
            </div>
          );
        }}
      </PluginContainer>
    </div>
  );
}
