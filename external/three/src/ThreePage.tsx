import { fmsDataContract, twoContract, type CarrierRating, type CarrierRisk } from '@fms/plugin-contracts';
import { usePluginQuery, type PluginComponentProps } from '@fms/plugin-sdk';
import { Alert, Button, Empty, Result, Segmented, Spin, Table, Tag, Tooltip, Typography, type TableProps } from 'antd';
import { ArrowDownRight, ArrowRight, ArrowUpRight, RefreshCw, ShieldAlert } from 'lucide-react';
import { useState } from 'react';

type RiskFilter = 'all' | CarrierRisk;

const riskLabels: Record<CarrierRisk, string> = {
  low: '低风险',
  medium: '中风险',
  high: '高风险',
};

const riskColors: Record<CarrierRisk, string> = {
  low: 'green',
  medium: 'gold',
  high: 'red',
};

const levelColors = { A: 'green', B: 'blue', C: 'gold', D: 'red' } as const;

export default function ThreePage({ runtime }: PluginComponentProps) {
  const [riskFilter, setRiskFilter] = useState<RiskFilter>('all');
  const ratingsQuery = usePluginQuery(runtime.query, {
    queryKey: fmsDataContract.carrierRatings.queryKey,
    schema: fmsDataContract.carrierRatings.schema,
    queryFn: ({ signal }) => runtime.api.get<unknown>(fmsDataContract.carrierRatings.path, { signal }),
  });
  const ratings = ratingsQuery.data;
  const visibleRows = ratings?.rows.filter((row) => riskFilter === 'all' || row.risk === riskFilter) ?? [];
  const averageScore = ratings?.rows.length
    ? Math.round(ratings.rows.reduce((total, row) => total + row.score, 0) / ratings.rows.length)
    : 0;
  const highRiskCount = ratings?.rows.filter((row) => row.risk === 'high').length ?? 0;
  const improvingCount = ratings?.rows.filter((row) => row.trend > 0).length ?? 0;

  const columns: TableProps<CarrierRating>['columns'] = [
    {
      title: '承运商',
      dataIndex: 'carrier',
      key: 'carrier',
      render: (value: string) => <Typography.Text className="three:font-medium">{value}</Typography.Text>,
    },
    {
      title: '等级',
      dataIndex: 'level',
      key: 'level',
      align: 'center',
      render: (value: CarrierRating['level']) => <Tag color={levelColors[value]}>{value}</Tag>,
    },
    {
      title: '综合评分',
      dataIndex: 'score',
      key: 'score',
      align: 'right',
      sorter: (left, right) => left.score - right.score,
    },
    {
      title: '准时率',
      dataIndex: 'onTimeRate',
      key: 'onTimeRate',
      align: 'right',
      sorter: (left, right) => left.onTimeRate - right.onTimeRate,
      render: (value: number) => `${value}%`,
    },
    {
      title: '事故数',
      dataIndex: 'incidents',
      key: 'incidents',
      align: 'right',
      sorter: (left, right) => left.incidents - right.incidents,
    },
    {
      title: '趋势',
      dataIndex: 'trend',
      key: 'trend',
      align: 'right',
      sorter: (left, right) => left.trend - right.trend,
      render: (value: number) => {
        const improved = value >= 0;
        const Icon = improved ? ArrowUpRight : ArrowDownRight;
        return (
          <span
            className={`three:inline-flex three:items-center three:gap-1 ${
              improved ? 'three:text-emerald-700' : 'three:text-red-700'
            }`}
          >
            <Icon aria-hidden="true" size={14} />
            {Math.abs(value)}%
          </span>
        );
      },
    },
    {
      title: '风险',
      dataIndex: 'risk',
      key: 'risk',
      render: (value: CarrierRisk) => <Tag color={riskColors[value]}>{riskLabels[value]}</Tag>,
    },
    {
      title: '操作',
      key: 'action',
      fixed: 'right',
      width: 120,
      render: (_, row) => (
        <Button
          icon={<ArrowRight aria-hidden="true" size={14} />}
          onClick={() => runtime.extensions.navigateTo(twoContract.routes.two, { search: { carrier: row.carrier } })}
          size="small"
          type="link"
        >
          查看履约
        </Button>
      ),
    },
  ];

  return (
    <section aria-labelledby="carrier-ratings-title" className="three:grid three:w-full three:min-w-0 three:gap-4">
      <header className="three:flex three:min-w-0 three:items-start three:justify-between three:gap-3">
        <div className="three:min-w-0">
          <Typography.Title id="carrier-ratings-title" className="three:m-0! three:text-2xl!" level={1}>
            承运商评级
          </Typography.Title>
          {ratings ? (
            <Typography.Text className="three:text-xs" type="secondary">
              数据更新于 {ratings.updatedAt}
            </Typography.Text>
          ) : null}
        </div>
        <Tooltip title="刷新承运商评级">
          <Button
            aria-label="刷新承运商评级"
            icon={<RefreshCw aria-hidden="true" size={16} />}
            loading={ratingsQuery.isFetching && ratings !== undefined}
            onClick={() => void ratingsQuery.refetch().catch(() => undefined)}
          />
        </Tooltip>
      </header>

      {ratingsQuery.status === 'error' && ratings ? (
        <Alert message="评级刷新失败，当前仍显示上次成功数据" showIcon type="warning" />
      ) : null}

      <div aria-live="polite" className="three:min-h-40 three:w-full three:min-w-0 three:max-w-full">
        {(ratingsQuery.status === 'loading' || ratingsQuery.status === 'idle') && !ratings ? (
          <Spin description="正在加载承运商评级" />
        ) : ratingsQuery.status === 'error' && !ratings ? (
          <Result
            extra={
              <Button
                icon={<RefreshCw aria-hidden="true" size={16} />}
                onClick={() => void ratingsQuery.refetch().catch(() => undefined)}
              >
                重试
              </Button>
            }
            status="error"
            subTitle={ratingsQuery.error?.message}
            title="承运商评级加载失败"
          />
        ) : ratings && ratings.rows.length === 0 ? (
          <Empty description="暂无承运商评级" image={Empty.PRESENTED_IMAGE_SIMPLE} />
        ) : ratings ? (
          <div className="three:grid three:gap-4">
            <div className="three:grid three:grid-cols-2 three:gap-3 three:lg:grid-cols-4">
              <article className="three:rounded-md three:border three:border-slate-200 three:bg-white three:p-4">
                <Typography.Text className="three:block three:text-xs" type="secondary">
                  已评级承运商
                </Typography.Text>
                <Typography.Text className="three:text-xl three:font-semibold">{ratings.rows.length}</Typography.Text>
              </article>
              <article className="three:rounded-md three:border three:border-slate-200 three:bg-white three:p-4">
                <Typography.Text className="three:block three:text-xs" type="secondary">
                  平均评分
                </Typography.Text>
                <Typography.Text className="three:text-xl three:font-semibold">{averageScore}</Typography.Text>
              </article>
              <article className="three:rounded-md three:border three:border-red-200 three:bg-red-50 three:p-4">
                <Typography.Text className="three:block three:text-xs three:text-red-700">高风险</Typography.Text>
                <Typography.Text className="three:text-xl three:font-semibold three:text-red-800">
                  {highRiskCount}
                </Typography.Text>
              </article>
              <article className="three:rounded-md three:border three:border-emerald-200 three:bg-emerald-50 three:p-4">
                <Typography.Text className="three:block three:text-xs three:text-emerald-700">趋势改善</Typography.Text>
                <Typography.Text className="three:text-xl three:font-semibold three:text-emerald-800">
                  {improvingCount}
                </Typography.Text>
              </article>
            </div>

            <div className="three:flex three:flex-wrap three:items-center three:justify-between three:gap-3">
              <Segmented<RiskFilter>
                aria-label="按风险等级筛选"
                onChange={setRiskFilter}
                options={[
                  { label: '全部', value: 'all' },
                  { label: '高风险', value: 'high', icon: <ShieldAlert aria-hidden="true" size={14} /> },
                  { label: '中风险', value: 'medium' },
                  { label: '低风险', value: 'low' },
                ]}
                value={riskFilter}
              />
              <Typography.Text type="secondary">当前 {visibleRows.length} 家</Typography.Text>
            </div>

            <Table<CarrierRating>
              className="three:w-full three:min-w-0 three:max-w-full"
              columns={columns}
              dataSource={visibleRows}
              locale={{ emptyText: <Empty description="当前风险筛选下暂无承运商" image={Empty.PRESENTED_IMAGE_SIMPLE} /> }}
              pagination={false}
              rowKey="id"
              scroll={{ x: 860 }}
              size="small"
            />
          </div>
        ) : null}
      </div>
    </section>
  );
}
