import { workspaceContract } from '@fms/plugin-contracts';
import type { PluginComponentProps } from '@fms/plugin-sdk';
import { Button, Result, Space, Spin, Typography } from 'antd';
import { Radio, RefreshCw } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

interface ThreeResponse {
  rows: unknown[];
}

type ViewState = 'loading' | 'ready' | 'error';

export default function ThreePage({ runtime }: PluginComponentProps) {
  const [state, setState] = useState<ViewState>('loading');
  const [publicMessage, setPublicMessage] = useState('尚未收到公共消息');

  const load = useCallback(() => {
    setState('loading');
    void runtime.api
      .get<ThreeResponse>('/api/carrier-ratings')
      .then(() => setState('ready'))
      .catch(() => setState('error'));
  }, [runtime.api]);

  useEffect(
    () =>
      runtime.channel.subscribePublic(workspaceContract.channels.publicMessage, ({ message }, { fromPluginId }) => {
        setPublicMessage(`公共消息来自 ${fromPluginId}：${message}`);
      }),
    [runtime.channel],
  );

  useEffect(() => {
    let active = true;
    void runtime.api
      .get<ThreeResponse>('/api/carrier-ratings')
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

  if (state === 'loading') return <Spin description="正在加载 three" />;
  if (state === 'error') {
    return (
      <Result
        extra={
          <Button icon={<RefreshCw aria-hidden="true" size={16} />} onClick={load}>
            重试
          </Button>
        }
        status="error"
        title="three 加载失败"
      />
    );
  }
  const { one, two } = workspaceContract.plugins;
  return (
    <Space orientation="vertical" size={4}>
      <Typography.Text>这是 three 插件的外部页面1112</Typography.Text>
      <Typography.Text type="secondary">
        three 已获取配置：one {one.targets.dashboardMetrics.path}，two {two.routes.two.path}
      </Typography.Text>
      <Typography.Text type="secondary">{publicMessage}</Typography.Text>
      <Button
        icon={<Radio aria-hidden="true" size={16} />}
        onClick={() =>
          runtime.channel.publishPublic(workspaceContract.channels.publicMessage, {
            message: 'three 发出的工作区广播',
          })
        }
      >
        three 公共广播
      </Button>
    </Space>
  );
}
