import { dataContract, usePluginQuery, workspaceContract, type PluginComponentProps } from '@tt-plug/plugin-sdk';
import { Button, Typography } from 'antd';
import { Radio } from 'lucide-react';
import { useEffect, useState } from 'react';

export default function OneModule({ runtime }: PluginComponentProps) {
  const [publicMessage, setPublicMessage] = useState('尚未收到公共消息');
  const statusQuery = usePluginQuery(runtime.query, {
    queryKey: dataContract.status.queryKey,
    schema: dataContract.status.schema,
    queryFn: ({ signal }) => runtime.api.get<unknown>(dataContract.status.path, { signal }),
  });

  useEffect(
    () =>
      runtime.channel.subscribePublic(workspaceContract.channels.publicMessage, ({ message }, context) => {
        setPublicMessage(`${context.fromPluginId}: ${message}`);
      }),
    [runtime.channel],
  );

  return (
    <section aria-labelledby="one-title" className="grid gap-3 border-t border-slate-200 pt-4">
      <div>
        <Typography.Title className="m-0! text-base!" id="one-title" level={2}>
          插槽模块 one
        </Typography.Title>
        <Typography.Text type="secondary">
          {runtime.user.displayName} · {runtime.can('dashboard:view') ? '已授权' : '未授权'}
        </Typography.Text>
      </div>
      <Typography.Text>{statusQuery.data?.message ?? '正在读取共享 API'}</Typography.Text>
      <Typography.Text aria-live="polite">公共消息：{publicMessage}</Typography.Text>
      <div>
        <Button
          icon={<Radio aria-hidden="true" size={16} />}
          onClick={() => runtime.channel.publishPublic(workspaceContract.channels.publicMessage, { message: 'one 已就绪' })}
        >
          发送公共消息
        </Button>
      </div>
    </section>
  );
}
