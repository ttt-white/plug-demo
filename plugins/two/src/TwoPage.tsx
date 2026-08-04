import { workspaceContract } from '@fms/plugin-contracts';
import type { PluginComponentProps } from '@fms/plugin-sdk';
import { Button, Result, Space, Spin, Typography } from 'antd';
import { ArrowRight, Radio, RefreshCw } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { twoContract } from './contract';

interface TwoResponse {
  rows: unknown[];
}

type ViewState = 'loading' | 'ready' | 'error';

export default function TwoPage({ runtime }: PluginComponentProps) {
  const [message, setMessage] = useState('尚未收到其他插件的消息');
  const [publicMessage, setPublicMessage] = useState('尚未收到公共消息');
  const [state, setState] = useState<ViewState>('loading');

  const loadReports = useCallback(() => {
    setState('loading');
    void runtime.api
      .get<TwoResponse>('/api/reports')
      .then(() => setState('ready'))
      .catch(() => setState('error'));
  }, [runtime.api]);

  useEffect(() => {
    let active = true;
    void runtime.api
      .get<TwoResponse>('/api/reports')
      .then(() => {
        if (active) setState('ready');
      })
      .catch(() => {
        if (active) setState('error');
      });
    return () => {
      active = false;
    };
  }, [runtime.api]);

  useEffect(
    () =>
      runtime.channel.subscribe(twoContract.channels.filterCarrier, ({ carrier }) => {
        setMessage(`收到承运商筛选消息：${carrier}`);
      }),
    [runtime.channel],
  );

  useEffect(
    () =>
      runtime.channel.subscribePublic(workspaceContract.channels.publicMessage, ({ message }, { fromPluginId }) => {
        setPublicMessage(`公共消息来自 ${fromPluginId}：${message}`);
      }),
    [runtime.channel],
  );

  if (state === 'loading') return <Spin description="正在加载 two" />;
  if (state === 'error') {
    return (
      <Result
        extra={
          <Button icon={<RefreshCw aria-hidden="true" size={16} />} onClick={loadReports}>
            重试
          </Button>
        }
        status="error"
        title="two 加载失败"
      />
    );
  }

  const linkedRoutes = runtime.extensions.routesFor(twoContract.routes.two);
  const { one, three } = workspaceContract.plugins;
  return (
    <div className="grid gap-4">
      <Space orientation="vertical" size={4}>
        <Typography.Text>这是 two 插件的履约报表页面</Typography.Text>
        <Typography.Text type="secondary">
          two 已获取配置：one {one.targets.dashboardMetrics.path}，three {three.routes.three.path}
        </Typography.Text>
        <Typography.Text type="secondary">{message}</Typography.Text>
        <Typography.Text type="secondary">{publicMessage}</Typography.Text>
        <Button
          icon={<Radio aria-hidden="true" size={16} />}
          onClick={() =>
            runtime.channel.publishPublic(workspaceContract.channels.publicMessage, {
              message: 'two 发出的工作区广播',
            })
          }
        >
          two 公共广播
        </Button>
        {linkedRoutes.map((route) => (
          <Button
            key={`${route.pluginId}:${route.id}`}
            icon={<ArrowRight aria-hidden="true" size={16} />}
            onClick={() => runtime.extensions.navigateTo(route.targetRoute)}
          >
            {route.label}11112
          </Button>
        ))}
      </Space>
      {runtime.extensions.renderSlot(twoContract.slots.summary)}
    </div>
  );
}
