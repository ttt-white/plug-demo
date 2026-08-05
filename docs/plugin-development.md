# 插件开发

## 插件形态

一个 `WorkspacePlugin` 可以贡献：

- `routes`：登录后布局中的完整页面。
- `modules`：注入宿主插槽或其他插件开放的插槽。
- `extensionSlots`：允许其他插件向自己的页面注入模块。
- `routeLinks`：在目标插件页面增加指向既有真实路由的入口。
- `manifest.requires/provides`：声明插件与能力依赖。

本地插件由宿主从 Web 应用的直接依赖中读取 `package.json.fmsPlugin`。远程插件由宿主先读取服务端 `fms-plugin.json`，再通过 Module Federation 加载。两类插件都会经过 SDK 的 manifest、路由、插槽和依赖校验；无效插件不会参与运行时解析，诊断会显示在插件中心。

## 最小包

```json
{
  "name": "@vendor/fms-plugin-demo",
  "version": "1.0.0",
  "type": "module",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js"
    }
  },
  "peerDependencies": {
    "@fms/plugin-sdk": "^1.0.0",
    "react": "^19.0.0"
  },
  "fmsPlugin": {
    "id": "demo",
    "apiVersion": 1
  }
}
```

```ts
import { PLUGIN_API_VERSION, type WorkspacePlugin } from '@fms/plugin-sdk';

export const plugin: WorkspacePlugin = {
  manifest: {
    id: 'demo',
    name: 'demo',
    version: '1.0.0',
    apiVersion: PLUGIN_API_VERSION,
  },
  routes: [
    {
      id: 'demo',
      path: '/plugin-demo',
      permission: 'demo:view',
      menu: { label: '插件 demo', order: 40 },
      load: () => import('./DemoPage'),
    },
  ],
};
```

入口必须导出名为 `plugin` 的对象。插件 ID、路由 ID、路径和模块 ID 在工作区内必须唯一。

## Runtime

页面和模块接收 `PluginComponentProps`：

```tsx
import type { PluginComponentProps } from '@fms/plugin-sdk';

export default function DemoPage({ runtime }: PluginComponentProps) {
  return <p>{runtime.user.displayName}</p>;
}
```

`runtime` 提供：

| 字段           | 用途                           |
| -------------- | ------------------------------ |
| `pluginId`     | 当前组件所属插件               |
| `user` / `can` | 当前用户与权限判断             |
| `api`          | 自动使用宿主认证的 HTTP 客户端 |
| `query`        | 宿主级共享查询缓存             |
| `channel`      | 类型化定向消息与公共广播       |
| `extensions`   | 插槽渲染、页面入口和类型化导航 |

共享 query 示例：

```tsx
const status = usePluginQuery(runtime.query, {
  queryKey: fmsDataContract.status.queryKey,
  schema: fmsDataContract.status.schema,
  queryFn: ({ signal }) => runtime.api.get(fmsDataContract.status.path, { signal }),
});
```

相同用户、相同 query key 的请求会共享缓存。query key 必须完整表达请求参数。

## 插槽

宿主先渲染插槽并加入白名单：

```tsx
<PluginSlot routeId="dashboard" slotId="dashboard.demo" />
```

```ts
export const HOST_SLOTS = { dashboard: ['dashboard.demo'] } as const;
```

one 的贡献：

```ts
modules: [
  {
    id: 'one.module',
    routeId: 'dashboard',
    slotId: 'dashboard.demo',
    permission: 'dashboard:view',
    load: () => import('./OneModule'),
  },
];
```

插件间插槽需要目标插件声明 `extensionSlots`，贡献方的 module 同时声明 `targetPluginId`。当前 two/three 是完整示例。

## 类型化通信

共享契约集中定义通道：

```ts
export const twoMessage = {
  pluginId: 'two',
  topic: 'two:message',
} satisfies PluginChannelReference<{ message: string }, 'two', 'two:message'>;
```

```ts
runtime.channel.subscribe(twoMessage, ({ message }, { fromPluginId }) => {
  console.log(fromPluginId, message);
});

runtime.channel.publish(twoMessage, { message: 'hello' });
```

定向消息只发送给通道所属插件。公共广播使用 `publishPublic/subscribePublic`，只会到达当前已挂载的订阅者。监听必须在组件卸载时退订；直接从 `useEffect` 返回 `subscribe` 的清理函数即可。

## 路由与参数

不要复制路径字符串，使用类型化路由引用：

```ts
runtime.extensions.navigateTo(twoContract.routes.page, {
  search: { from: runtime.pluginId, message: 'hello' },
});
```

`routeLinks` 只贡献入口，不注册第二条 URL。目标页面用 `runtime.extensions.routesFor(...)` 读取入口，并通过 `navigateTo` 跳转。

## 远程插件

远程服务至少公开：

```text
/fms-plugin.json  健康检查和远程身份
/remoteEntry.js   Module Federation 入口
```

manifest 示例：

```json
{
  "schemaVersion": 1,
  "id": "three",
  "name": "three",
  "version": "1.0.0",
  "apiVersion": 1,
  "remote": {
    "name": "plugin_three",
    "entry": "/remoteEntry.js",
    "module": "./plugin"
  }
}
```

宿主配置的插件 ID、容器名、入口和暴露模块必须与 manifest 一致。健康检查失败时，宿主保留离线诊断但不加载远程代码；下一次健康检查成功后自动恢复注册。

React、React DOM、Ant Design、SDK 和共享契约必须在宿主与 remote 的 Federation 配置中声明为单例共享依赖，避免出现多个运行时实例。

## 发布检查

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm build
```

远程构建应同时包含 `fms-plugin.json`、`remoteEntry.js` 和样式产物。部署时需要允许宿主跨域读取这些文件。
