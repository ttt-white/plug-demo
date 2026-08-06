import { threeContract, twoContract, workspaceContract } from '@tt-plug/plugin-contracts';
import { PLUGIN_API_VERSION, type PluginComponentProps, type WorkspacePlugin } from '@tt-plug/plugin-sdk';
import { Button, Typography } from 'antd';

function RemotePluginPage({ runtime }: PluginComponentProps) {
  return (
    <section aria-labelledby="remote-plugin-title">
      <Typography.Title id="remote-plugin-title" level={1}>
        外部插件 three
      </Typography.Title>
      <Button
        onClick={() =>
          runtime.extensions.navigateTo(twoContract.routes.page, {
            search: { from: runtime.pluginId, message: '来自 three 的路由参数' },
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
        three 注入的扩展模块
      </Typography.Title>
      <Button onClick={() => runtime.channel.publish(twoContract.channels.message, { message: '来自 three 扩展模块' })}>
        发送给 two
      </Button>
      <Button
        onClick={() => runtime.channel.publishPublic(workspaceContract.channels.publicMessage, { message: 'three 模块广播' })}
      >
        公共广播
      </Button>
    </section>
  );
}

export const remotePluginFixture: WorkspacePlugin = {
  manifest: {
    id: threeContract.pluginId,
    name: 'three',
    version: '1.0.0',
    apiVersion: PLUGIN_API_VERSION,
    requires: {
      plugins: [{ id: twoContract.pluginId, range: '^1.0.0', optional: true }],
      capabilities: [{ id: 'demo.receive-message', range: '^1.0.0', optional: true }],
    },
  },
  routes: [
    {
      id: threeContract.routes.page.routeId,
      path: threeContract.routes.page.path,
      permission: 'demo:three:view',
      menu: { label: '外部插件 three', icon: 'badge-check', order: 35 },
      load: async () => ({ default: RemotePluginPage }),
    },
  ],
  routeLinks: [
    {
      id: 'two.three',
      parentRoute: twoContract.routes.page,
      targetRoute: threeContract.routes.page,
      permission: 'demo:three:view',
      menu: { label: '打开外部插件 three', icon: 'badge-check', order: 10 },
    },
  ],
  modules: [
    {
      id: 'three.two-demo',
      targetPluginId: twoContract.slots.demo.pluginId,
      routeId: twoContract.slots.demo.routeId,
      slotId: twoContract.slots.demo.slotId,
      permission: 'demo:three:view',
      priority: 20,
      load: async () => ({ default: RemotePluginModule }),
    },
  ],
};
