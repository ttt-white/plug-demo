import { twoContract, workspaceContract } from '@tt-plug/plugin-contracts';
import {
  PLUGIN_API_VERSION,
  type PluginComponentProps,
  type PluginRouteReference,
  type WorkspacePlugin,
} from '@tt-plug/plugin-sdk';
import { Button, Typography } from 'antd';

// 这个 fixture 模拟一个主体之外的远程插件，因此在本地声明它的契约，
// 而不是从 @tt-plug/plugin-contracts 取——该包只收录 plugins/ 下的插件。
const remotePluginContract = {
  pluginId: 'sample',
  routes: {
    page: { pluginId: 'sample', routeId: 'sample', path: '/plugin-sample' },
  },
} as const satisfies {
  pluginId: string;
  routes: { page: PluginRouteReference<'sample', 'sample'> & { path: string } };
};

function RemotePluginPage({ runtime }: PluginComponentProps) {
  return (
    <section aria-labelledby="remote-plugin-title">
      <Typography.Title id="remote-plugin-title" level={1}>
        外部插件 sample
      </Typography.Title>
      <Button
        onClick={() =>
          runtime.extensions.navigateTo(twoContract.routes.page, {
            search: { from: runtime.pluginId, message: '来自 sample 的路由参数' },
          })
        }
      >
        携带参数打开 two
      </Button>
    </section>
  );
}

function RemotePluginModule({ runtime }: PluginComponentProps) {
  return (
    <section aria-labelledby="remote-module-title">
      <Typography.Title id="remote-module-title" level={2}>
        sample 注入的扩展模块
      </Typography.Title>
      <Button onClick={() => runtime.channel.publish(twoContract.channels.message, { message: '来自 sample 扩展模块' })}>
        发送给 two
      </Button>
      <Button
        onClick={() => runtime.channel.publishPublic(workspaceContract.channels.publicMessage, { message: 'sample 模块广播' })}
      >
        公共广播
      </Button>
    </section>
  );
}

export const remotePluginFixture: WorkspacePlugin = {
  manifest: {
    id: remotePluginContract.pluginId,
    name: 'sample',
    version: '1.0.0',
    apiVersion: PLUGIN_API_VERSION,
    requires: {
      plugins: [{ id: twoContract.pluginId, range: '^1.0.0', optional: true }],
      capabilities: [{ id: 'demo.receive-message', range: '^1.0.0', optional: true }],
    },
  },
  routes: [
    {
      id: remotePluginContract.routes.page.routeId,
      path: remotePluginContract.routes.page.path,
      permission: 'demo:sample:view',
      menu: { label: '外部插件 sample', icon: 'badge-check', order: 35 },
      load: async () => ({ default: RemotePluginPage }),
    },
  ],
  routeLinks: [
    {
      id: 'two.sample',
      parentRoute: twoContract.routes.page,
      targetRoute: remotePluginContract.routes.page,
      permission: 'demo:sample:view',
      menu: { label: '打开外部插件 sample', icon: 'badge-check', order: 10 },
    },
  ],
  modules: [
    {
      id: 'sample.two-demo',
      targetPluginId: twoContract.slots.demo.pluginId,
      routeId: twoContract.slots.demo.routeId,
      slotId: twoContract.slots.demo.slotId,
      permission: 'demo:sample:view',
      priority: 20,
      load: async () => ({ default: RemotePluginModule }),
    },
  ],
};
