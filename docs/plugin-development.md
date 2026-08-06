# 插件开发

## 插件形态

一个 `WorkspacePlugin` 可以贡献：

- `routes`：登录后布局中的完整页面。
- `modules`：注入宿主插槽或其他插件开放的插槽。
- `extensionSlots`：允许其他插件向自己的页面注入模块。
- `routeLinks`：在目标插件页面增加指向既有真实路由的入口。
- `manifest.requires/provides`：声明插件与能力依赖。

本地插件由宿主从 Web 应用的直接依赖中读取插件元数据。远程插件由宿主先读取服务端插件 manifest，再通过 Module Federation 加载。两类插件都会经过 SDK 的 manifest、路由、插槽和依赖校验；无效插件不会参与运行时解析，诊断会显示在插件中心。

## 最小包

```json
{
  "name": "@vendor/plugin-demo",
  "version": "1.0.0",
  "type": "module",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js"
    }
  },
  "peerDependencies": {
    "@tt-plug/plugin-sdk": "^1.0.0",
    "react": "^19.0.0"
  },
  "plugin": {
    "id": "demo",
    "apiVersion": 1
  }
}
```

`plugin` 是宿主的本地插件发现元数据，可选的 `style` 字段用于声明样式入口。

```ts
import { PLUGIN_API_VERSION, type WorkspacePlugin } from '@tt-plug/plugin-sdk';

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

## 契约放在哪里

**每个插件自带契约**：在自己的 `src/contract.ts` 里声明，挂到 `plugin.contract` 上，并用 declaration merging 把类型登记进 SDK。没有中心化的契约包，也不需要代码生成器。

```ts
// plugins/two/src/contract.ts
import type {
  PluginChannelReference,
  PluginMessagePayload,
  PluginRouteReference,
  PluginSlotReference,
} from '@tt-plug/plugin-sdk';

export interface TwoPluginContract {
  readonly pluginId: 'two';
  readonly routes: { readonly page: PluginRouteReference<'two', 'two'> & { readonly path: '/plugin-two' } };
  readonly slots: { readonly demo: PluginSlotReference<'two', 'two', 'two.demo'> };
  readonly channels: { readonly message: PluginChannelReference<PluginMessagePayload, 'two', 'two:message'> };
}

export const twoContract: TwoPluginContract = {/* ... */};

// 登记后，其他插件的 runtime.contracts.two 就有精确类型
declare module '@tt-plug/plugin-sdk' {
  interface WorkspacePluginContracts {
    two: TwoPluginContract;
  }
}
```

宿主级契约（`hostContract` 的页面与插槽、`workspaceContract.channels`、`dataContract`）由 `@tt-plug/plugin-sdk` 直接导出，本地插件和第三方插件取用方式相同。

基座在注册时会校验契约与贡献是否一致：契约 `pluginId` 与 manifest 不符、声明了不存在的路由或插槽、声明了别人的通道，都会产生 contribution 阶段的 error 级诊断。

### 用别人的契约

- **自己的契约**：直接 `import { twoContract } from './contract'`，永远存在、类型最准。
- **别人的契约**：在组件里用 `runtime.contracts.<pluginId>`，值由基座按当前**已启用**插件下发，插件停用或离线时为 `undefined`。

```tsx
const twoPage = runtime.contracts.two?.routes.page;
if (twoPage) runtime.extensions.navigateTo(twoPage, { search: { from: runtime.pluginId } });
```

要拿到 `runtime.contracts.two` 的精确类型，需要让目标插件的类型登记进入你的 TS 程序，即 `import type {} from '@tt-plug/plugin-two'`（运行时会被擦除）。拿不到对方类型时用 `runtime.contracts['two']`，退化为 `PluginContract | undefined`。

manifest 是静态结构，拿不到运行时的 `runtime.contracts`。跨插件注入插槽时在本地声明目标：

```ts
const twoTarget = { pluginId: 'two', routeId: 'two', slotId: 'two.demo' } as const satisfies PluginSlotReference<
  'two',
  'two',
  'two.demo'
>;
```

写错的目标不会静默失败：基座在 contribution 阶段会报 `MODULE_TARGET_PLUGIN_INVALID` 或 `MODULE_TARGET_SLOT_MISSING`。

## Runtime

页面和模块接收 `PluginComponentProps`：

```tsx
import type { PluginComponentProps } from '@tt-plug/plugin-sdk';

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
| `contracts`    | 所有已启用插件公开的契约       |
| `extensions`   | 插槽渲染、页面入口和类型化导航 |

共享 query 示例：

```tsx
const status = usePluginQuery(runtime.query, {
  queryKey: dataContract.status.queryKey,
  schema: dataContract.status.schema,
  queryFn: ({ signal }) => runtime.api.get(dataContract.status.path, { signal }),
});
```

相同用户、相同 query key 的请求会共享缓存。query key 必须完整表达请求参数。

## 插槽

宿主页面和插槽由共享契约公开，页面、白名单和插件贡献都引用同一个 ID：

```tsx
<PluginSlot routeId={hostContract.slots.dashboard.routeId} slotId={hostContract.slots.dashboard.slotId} />
```

```ts
export const HOST_SLOTS = {
  [hostContract.slots.dashboard.routeId]: [hostContract.slots.dashboard.slotId],
} as const;
```

one 的贡献：

```ts
modules: [
  {
    id: 'one.module',
    routeId: hostContract.slots.dashboard.routeId,
    slotId: hostContract.slots.dashboard.slotId,
    permission: 'dashboard:view',
    load: () => import('./OneModule'),
  },
];
```

插件间插槽需要目标插件声明 `extensionSlots`，贡献方的 module 同时声明 `targetPluginId`。当前 two 开放插槽、five 注入模块，是完整示例。

## 贡献关系

插件中心的“贡献关系”分别列出页面、页面入口、模块和开放插槽。模块会显示完整的目标页面与插槽，页面入口会同时显示挂载页面和跳转页面。禁用插件的已校验声明仍可查看；无法加载的远程插件会在诊断列表中标明原因。

SDK 也公开同一份纯数据目录，可用于生成二开文档或其他管理工具：

```ts
const catalog = catalogPluginContributions(plugins, hostCatalog);
```

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

远程服务需要在同一服务基地址下公开 manifest 和 Federation 入口。例如服务基地址为 `https://plugins.example.com/catalog/demo` 时，至少公开：

```text
https://plugins.example.com/catalog/demo/plugin.json  健康检查和远程身份
https://plugins.example.com/catalog/demo/remoteEntry.js  Module Federation 入口
```

manifest 示例：

```json
{
  "schemaVersion": 1,
  "id": "demo",
  "name": "demo",
  "version": "1.0.0",
  "apiVersion": 1,
  "remote": {
    "name": "plugin_demo",
    "entry": "./remoteEntry.js",
    "module": "./plugin"
  }
}
```

`remote.entry` 可以是相对服务基地址的路径，也可以是完整的 HTTP(S) 地址。若插件部署在带路径前缀的位置，应使用 `./remoteEntry.js`；以 `/` 开头的入口会从远程域名根路径解析。

管理员在插件中心输入服务基地址或完整的 `plugin.json` 地址完成导入。插件 ID、服务地址和 Federation 容器名在工作区内必须唯一；修改地址时，新服务必须返回同一个插件 ID。宿主保存完整 manifest 快照，因此健康检查失败时仍会显示插件身份和离线诊断，但不会加载远程代码；下一次健康检查成功后自动恢复注册。

React、React DOM、Ant Design、SDK 和共享契约必须在宿主与 remote 的 Federation 配置中声明为单例共享依赖，避免出现多个运行时实例。

## 发布检查

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm build
```

远程构建应同时包含 `plugin.json`、Federation 入口和样式产物。部署在不同域名或端口时，manifest、入口脚本及其动态资源都需要返回允许宿主来源访问的 CORS 响应头。

共享 SDK 或 contracts 变更后，发布新的 npm 版本；外部插件通过正常的 semver 依赖升级，不与主体目录建立文件同步关系。
