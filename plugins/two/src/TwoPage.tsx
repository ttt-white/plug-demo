import { workspaceContract } from '@fms/plugin-contracts';
import { type PluginComponentProps } from '@fms/plugin-sdk';
import { Button, Typography } from 'antd';
import { ArrowRight, Radio } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { twoContract } from './contract';

export default function TwoPage({ runtime }: PluginComponentProps) {
  const [searchParams] = useSearchParams();
  const [directMessage, setDirectMessage] = useState('尚未收到定向消息');
  const [publicMessage, setPublicMessage] = useState('尚未收到公共消息');
  const linkedRoutes = runtime.extensions.routesFor(twoContract.routes.page);
  const routeMessage = searchParams.get('message');
  const routeSource = searchParams.get('from');

  useEffect(
    () => runtime.channel.subscribe(twoContract.channels.message, ({ message }) => setDirectMessage(message)),
    [runtime.channel],
  );
  useEffect(
    () =>
      runtime.channel.subscribePublic(workspaceContract.channels.publicMessage, ({ message }, context) => {
        setPublicMessage(`${context.fromPluginId}: ${message}`);
      }),
    [runtime.channel],
  );

  return (
    <section aria-labelledby="two-title" className="grid gap-5">
      <header>
        <Typography.Title className="m-0! text-2xl!" id="two-title" level={1}>
          页面插件 two
        </Typography.Title>
        <Typography.Text type="secondary">当前用户：{runtime.user.displayName}</Typography.Text>
      </header>

      <div className="grid gap-2" aria-live="polite">
        <Typography.Text>路由参数：{routeMessage ? `${routeSource ?? 'unknown'}: ${routeMessage}` : '无'}</Typography.Text>
        <Typography.Text>定向消息：{directMessage}</Typography.Text>
        <Typography.Text>公共消息：{publicMessage}</Typography.Text>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          icon={<Radio aria-hidden="true" size={16} />}
          onClick={() => runtime.channel.publishPublic(workspaceContract.channels.publicMessage, { message: 'two 已收到' })}
        >
          发送公共消息
        </Button>
        {linkedRoutes.map((route) => (
          <Button
            icon={<ArrowRight aria-hidden="true" size={16} />}
            key={`${route.pluginId}:${route.id}`}
            onClick={() => runtime.extensions.navigateTo(route.targetRoute)}
          >
            {route.label}
          </Button>
        ))}
      </div>

      {runtime.extensions.renderSlot(
        twoContract.slots.demo,
        <Typography.Text type="secondary">three 扩展模块当前未启用</Typography.Text>,
      )}
    </section>
  );
}
