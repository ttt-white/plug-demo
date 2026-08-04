import { fmsDataContract, twoContract, type CarrierRisk } from '@fms/plugin-contracts';
import { usePluginQuery, type PluginComponentProps } from '@fms/plugin-sdk';
import { Button, Empty, Result, Spin, Tag, Typography } from 'antd';
import { ArrowRight, RefreshCw } from 'lucide-react';
import { threeContract } from './contract';

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

export default function ThreeTwoModule({ runtime }: PluginComponentProps) {
  const ratingsQuery = usePluginQuery(runtime.query, {
    queryKey: fmsDataContract.carrierRatings.queryKey,
    schema: fmsDataContract.carrierRatings.schema,
    queryFn: ({ signal }) => runtime.api.get<unknown>(fmsDataContract.carrierRatings.path, { signal }),
  });
  const ratings = ratingsQuery.data;

  if ((ratingsQuery.status === 'loading' || ratingsQuery.status === 'idle') && !ratings) {
    return <Spin description="正在加载承运商风险摘要" />;
  }
  if (ratingsQuery.status === 'error' && !ratings) {
    return (
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
        title="承运商风险摘要加载失败"
      />
    );
  }
  if (!ratings || ratings.rows.length === 0) {
    return <Empty description="暂无承运商风险数据" image={Empty.PRESENTED_IMAGE_SIMPLE} />;
  }

  const rows = ratings.rows.slice().sort((left, right) => left.score - right.score);
  return (
    <section
      aria-labelledby="carrier-risk-summary-title"
      className="three:grid three:gap-3 three:border-t three:border-slate-200 three:pt-4"
    >
      <div className="three:flex three:flex-wrap three:items-center three:justify-between three:gap-3">
        <div>
          <Typography.Title className="three:m-0! three:text-base!" id="carrier-risk-summary-title" level={2}>
            承运商风险摘要
          </Typography.Title>
          <Typography.Text className="three:text-xs" type="secondary">
            按综合评分升序
          </Typography.Text>
        </div>
        <Button
          icon={<ArrowRight aria-hidden="true" size={16} />}
          onClick={() => runtime.extensions.navigateTo(threeContract.routes.three)}
        >
          查看全部评级
        </Button>
      </div>
      <div className="three:grid three:grid-cols-1 three:gap-2 three:lg:grid-cols-2">
        {rows.map((row) => (
          <article
            className="three:flex three:min-w-0 three:items-center three:gap-3 three:rounded-md three:border three:border-slate-200 three:bg-slate-50 three:p-3"
            key={row.id}
          >
            <div className="three:min-w-0 three:flex-1">
              <div className="three:flex three:flex-wrap three:items-center three:gap-2">
                <Typography.Text className="three:font-medium">{row.carrier}</Typography.Text>
                <Tag color={riskColors[row.risk]}>{riskLabels[row.risk]}</Tag>
              </div>
              <Typography.Text className="three:text-xs" type="secondary">
                评分 {row.score} · 准时率 {row.onTimeRate}% · 事故 {row.incidents}
              </Typography.Text>
            </div>
            <Button
              aria-label={`筛选${row.carrier}履约报表`}
              onClick={() => runtime.channel.publish(twoContract.channels.filterCarrier, { carrier: row.carrier })}
              size="small"
            >
              筛选
            </Button>
          </article>
        ))}
      </div>
    </section>
  );
}
