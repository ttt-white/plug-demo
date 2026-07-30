import type { PluginComponentProps } from '@fms/plugin-sdk';
import { Button, Result, Spin, Typography } from 'antd';
import { RefreshCw } from 'lucide-react';
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
  return <Typography.Text>这是 one 插件开发在工作台的指标模块</Typography.Text>;
}
