import {
  PLUGIN_API_VERSION,
  workspaceContract,
  type PluginComponentProps,
  type PluginRouteReference,
  type PluginSlotReference,
  type WorkspacePlugin,
} from '@tt-plug/plugin-sdk';
import { Button, Typography } from 'antd';
// 仅引入类型登记（运行时会被擦除）：拿到 two 的契约类型后 runtime.contracts.two 才是精确类型，
// 否则退化为 PluginContract，只能用 runtime.contracts['two'] 访问。
import type {} from '@tt-plug/plugin-two';

// 这个 fixture 模拟一个主体之外的远程插件：它自己声明自己的契约，
// 以及它对 two 的期望——manifest 是静态结构，拿不到运行时的 runtime.contracts，
// 写错的目标会在基座 contribution 阶段产生诊断。
const remotePluginContract = {
  pluginId: 'sample',
  routes: {
    page: { pluginId: 'sample', routeId: 'sample', path: '/plugin-sample' },
  },
} as const satisfies {
  pluginId: string;
  routes: { page: PluginRouteReference<'sample', 'sample'> & { path: string } };
};

const twoTarget = {
  pluginId: 'two',
  routeId: 'two',
  slotId: 'two.demo',
} as const satisfies PluginSlotReference<'two', 'two', 'two.demo'>;

// one 注入到 two 页面的模块内部再开的插槽：插槽归 one，位置在 two 的页面上。
const oneNestedTarget = {
  pluginId: 'one',
  routeId: 'two',
  slotId: 'one.nested',
} as const satisfies PluginSlotReference<'one', 'two', 'one.nested'>;

function RemotePluginPage({ runtime }: PluginComponentProps) {
  // two 的契约由基座通过 runtime 下发；two 未启用时为 undefined。
  const twoPage = runtime.contracts.two?.routes.page;
  return (
    <section aria-labelledby="remote-plugin-title">
      <Typography.Title id="remote-plugin-title" level={1}>
        外部插件 sample
      </Typography.Title>
      <Button
        disabled={!twoPage}
        onClick={() =>
          twoPage &&
          runtime.extensions.navigateTo(twoPage, {
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
  const twoMessage = runtime.contracts.two?.channels.message;
  return (
    <section aria-labelledby="remote-module-title">
      <Typography.Title id="remote-module-title" level={2}>
        sample 注入的扩展模块
      </Typography.Title>
      <Button
        disabled={!twoMessage}
        onClick={() => twoMessage && runtime.channel.publish(twoMessage, { message: '来自 sample 扩展模块' })}
      >
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

function RemotePluginNestedModule({ runtime }: PluginComponentProps) {
  return (
    <section aria-labelledby="remote-nested-title">
      <Typography.Title id="remote-nested-title" level={3}>
        sample 注入 one 的嵌套模块
      </Typography.Title>
      <Typography.Text type="secondary">运行身份 {runtime.pluginId}</Typography.Text>
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
      plugins: [
        { id: twoTarget.pluginId, range: '^1.0.0', optional: true },
        { id: oneNestedTarget.pluginId, range: '^1.0.0', optional: true },
      ],
      capabilities: [{ id: 'demo.receive-message', range: '^1.0.0', optional: true }],
    },
  },
  contract: remotePluginContract,
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
      parentRoute: { pluginId: twoTarget.pluginId, routeId: twoTarget.routeId },
      targetRoute: remotePluginContract.routes.page,
      permission: 'demo:sample:view',
      menu: { label: '打开外部插件 sample', icon: 'badge-check', order: 10 },
    },
  ],
  modules: [
    {
      id: 'sample.two-demo',
      targetPluginId: twoTarget.pluginId,
      routeId: twoTarget.routeId,
      slotId: twoTarget.slotId,
      permission: 'demo:sample:view',
      priority: 20,
      load: async () => ({ default: RemotePluginModule }),
    },
    // 注入到 one 开在 two 页面上的嵌套插槽：two 页面 → one 的模块 → 这里。
    {
      id: 'sample.one-nested',
      targetPluginId: oneNestedTarget.pluginId,
      routeId: oneNestedTarget.routeId,
      slotId: oneNestedTarget.slotId,
      permission: 'demo:sample:view',
      priority: 5,
      load: async () => ({ default: RemotePluginNestedModule }),
    },
  ],
};
