import { workspaceContract } from '@fms/plugin-contracts';
import type { PluginComponentProps } from '@fms/plugin-sdk';
import { Button, Result, Space, Spin, Typography } from 'antd';
import { Radio, RefreshCw } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

interface OneMetric {
  id: string;
  label: string;
  value: string;
  change: number;
}

interface OneResponse {
  metrics: OneMetric[];
}

type ViewState = 'loading' | 'ready' | 'error';

export default function OneModule({ runtime }: PluginComponentProps) {
  const [state, setState] = useState<ViewState>('loading');
  const [publicMessage, setPublicMessage] = useState('尚未收到公共消息');

  const loadMetrics = useCallback(() => {
    setState('loading');
    void runtime.api
      .get<OneResponse>('/api/dashboard')
      .then(() => setState('ready'))
      .catch(() => setState('error'));
  }, [runtime.api]);

  useEffect(() => {
    let active = true;
    void runtime.api
      .get<OneResponse>('/api/dashboard')
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
      runtime.channel.subscribePublic(workspaceContract.channels.publicMessage, ({ message }, { fromPluginId }) => {
        setPublicMessage(`公共消息来自 ${fromPluginId}：${message}`);
      }),
    [runtime.channel],
  );

  if (state === 'loading') return <Spin description="正在加载 one" />;
  if (state === 'error') {
    return (
      <Result
        extra={
          <Button icon={<RefreshCw aria-hidden="true" size={16} />} onClick={loadMetrics}>
            重试
          </Button>
        }
        status="error"
        title="one 加载失败"
      />
    );
  }
  const { three, two } = workspaceContract.plugins;
  return (
    <Space orientation="vertical" size={4}>
      <Typography.Text>这是 one 插件开发在工作台的指标模块</Typography.Text>
      <Typography.Text type="secondary">
        one 已获取配置：two {two.routes.two.path}，three {three.routes.three.path}
      </Typography.Text>
      <Typography.Text type="secondary">{publicMessage}</Typography.Text>
      <Button
        icon={<Radio aria-hidden="true" size={16} />}
        onClick={() =>
          runtime.channel.publishPublic(workspaceContract.channels.publicMessage, {
            message: 'one 发出的工作区广播',
          })
        }
      >
        one 公共广播
      </Button>
    </Space>
  );
}
