import { twoContract } from '@fms/plugin-two';
import type { PluginComponentProps } from '@fms/plugin-sdk';
import { Button, Result, Space, Spin, Typography } from 'antd';
import { ArrowRight, RefreshCw, Send } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { threeContract } from './contract';

interface ThreeRating {
  carrier: string;
}

interface ThreeResponse {
  rows: ThreeRating[];
}

type ViewState = { status: 'loading' } | { status: 'ready'; data: ThreeResponse } | { status: 'error' };

export default function ThreeTwoModule({ runtime }: PluginComponentProps) {
  const [state, setState] = useState<ViewState>({ status: 'loading' });

  const load = useCallback(() => {
    setState({ status: 'loading' });
    void runtime.api
      .get<ThreeResponse>('/api/carrier-ratings')
      .then((data) => setState({ status: 'ready', data }))
      .catch(() => setState({ status: 'error' }));
  }, [runtime.api]);

  useEffect(() => {
    let active = true;
    void runtime.api
      .get<ThreeResponse>('/api/carrier-ratings')
      .then((data) => {
        if (active) setState({ status: 'ready', data });
      })
      .catch(() => {
        if (active) setState({ status: 'error' });
      });
    return () => {
      active = false;
    };
  }, [runtime.api]);

  if (state.status === 'loading') return <Spin description="正在加载 three 模块" />;
  if (state.status === 'error') {
    return (
      <Result
        extra={
          <Button icon={<RefreshCw aria-hidden="true" size={16} />} onClick={load}>
            重试
          </Button>
        }
        status="error"
        title="three 模块加载失败"
      />
    );
  }

  return (
    <Space wrap>
      <Typography.Text>这是 three 插件开发在 two 页面中的模块</Typography.Text>
      <Button
        icon={<Send aria-hidden="true" size={16} />}
        onClick={() =>
          runtime.channel.publish(twoContract.channels.filterCarrier, {
            carrier: state.data.rows[0]?.carrier ?? '东驰物流',
          })
        }
      >
        发送到 two
      </Button>
      <Button
        icon={<ArrowRight aria-hidden="true" size={16} />}
        type="primary"
        onClick={() => runtime.extensions.navigateTo(threeContract.routes.three)}
      >
        打开 three
      </Button>
    </Space>
  );
}
