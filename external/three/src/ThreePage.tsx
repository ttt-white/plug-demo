import type { PluginComponentProps } from '@fms/plugin-sdk';
import { Button, Result, Spin, Typography } from 'antd';
import { RefreshCw } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

interface ThreeResponse {
  rows: unknown[];
}

type ViewState = 'loading' | 'ready' | 'error';

export default function ThreePage({ runtime }: PluginComponentProps) {
  const [state, setState] = useState<ViewState>('loading');

  const load = useCallback(() => {
    setState('loading');
    void runtime.api
      .get<ThreeResponse>('/api/carrier-ratings')
      .then(() => setState('ready'))
      .catch(() => setState('error'));
  }, [runtime.api]);

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
  return <Typography.Text>这是 three 插件的外部页面1112</Typography.Text>;
}
