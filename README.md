# FMS Workspace

FMS Workspace 是一个基于 React 19、Ant Design 6、Tailwind CSS 4、Vite、TypeScript 6 和 pnpm workspace 的前端插件基座。宿主负责登录、RBAC、菜单、路由、API 鉴权与插件生命周期；插件可以贡献完整页面、宿主路由模块，也可以通过有类型约束的通道、扩展插槽和页面入口扩展其他插件。

插件包结构、开发规范、本机联调和远程联调流程见 [FMS 插件开发与联调规范](docs/plugin-development.md)。

## 快速开始

```bash
pnpm install
pnpm dev
```

`pnpm install` 会同时安装并构建 `external/three` 本地外部插件示例。

开发服务器默认运行在 [http://localhost:3000](http://localhost:3000)。Mock 账号：

| 身份     | 用户名   | 密码        | 权限                                                 |
| -------- | -------- | ----------- | ---------------------------------------------------- |
| 管理员   | `admin`  | `admin123`  | one 工作台、two 履约报表、three 承运商评级、插件管理 |
| 普通用户 | `viewer` | `viewer123` | 仅 one 工作台                                        |

常用检查命令：

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm build
```

## Workspace 结构

```text
apps/web                    宿主应用、路由、鉴权、Mock API
packages/plugin-sdk         npm 插件协议、运行时类型、注册校验
packages/plugin-contracts   one/two/three 共享配置与公共通道契约
plugins/one                 工作台插槽模块示例
plugins/two                 履约报表整页插件示例
external/three              承运商评级外部插件与本机链接示例
```

宿主当前公开一个模块插槽：`routeId: dashboard` + `slotId: dashboard.metrics`。新增插槽时需要同时在宿主页渲染 `PluginSlot`，并将插槽加入 `HOST_SLOTS` 白名单。

`workspaceContract.plugins` 集中提供 one、two、three 的类型化配置，任意插件都能读取其他插件的真实 URL、路由、插槽和通道。`plugins/two` 同时演示插件开放扩展插槽；外部 `three` 插件向该插槽贡献模块，并在 two 页面注册一个跳到唯一真实路由 `/carrier-ratings` 的类型化入口。

通信分为两类：`publish/subscribe` 向指定插件发送定向消息；`publishPublic/subscribePublic` 通过 `workspaceContract.channels.publicMessage` 向所有当前订阅插件广播。详细协议见开发规范的“跨插件扩展、页面入口与通信”。

## 依赖 Catalog

第三方依赖版本统一维护在 `pnpm-workspace.yaml` 的 `catalog` 中，各 workspace 包通过 `catalog:` 引用，不在子包重复声明版本。升级公共依赖时只修改 catalog 并运行：

```bash
pnpm install
pnpm typecheck
pnpm test
```

`workspace:*` 继续用于仓库内部包。可发布插件的 `peerDependencies` 保留显式兼容范围，例如 `react: ^19.0.0`、`antd: ^6.0.0`，不使用 `catalog:`，避免把宿主当前安装版本误当成插件的最小兼容版本。

pnpm 10 的 catalog 不支持 `link:` 协议。本机联调时仍在 catalog 中维护插件的目标发布版本，并通过根 `package.json` 的 `pnpm.overrides` 将该包替换为本地目录；远程或生产构建删除 override 后会恢复从 Registry 安装 catalog 版本。

## 外部仓库本机联调

仓库内提供了完整示例 [`external/three`](external/three/README.md)。首次安装由根脚本自动完成，也可以显式执行：

```bash
pnpm external:setup
```

持续开发时可以直接从外部插件仓库启动：

```bash
pnpm --dir external/three dev:host
```

外部仓库会根据 `fms.dev.json` 中的 `workspaceRoot` 和 `host.url` 启动宿主及插件 watcher；插件源码由宿主 Vite 直接加载并支持 React Fast Refresh。管理员登录后可从顶部菜单进入 `three`，也可在插件中心即时启停。

外部插件仓库的 `fms.dev.json` 控制宿主地址，例如 `http://localhost:3000`。根 `pnpm dev` 会按该地址启动宿主并等待其 Vite HMR 就绪；将 `host.start` 设为 `false` 可连接已经运行的宿主。

## 第三方 npm 插件

第三方插件在构建期安装，并作为可信 React 代码与宿主同进程运行。首版不支持浏览器运行时下载插件，也不提供 iframe 隔离。

1. 在 `pnpm-workspace.yaml` 的 catalog 中登记插件版本：

```yaml
catalog:
  '@vendor/fms-plugin': 1.0.0
```

2. 在 `apps/web/package.json` 添加 `"@vendor/fms-plugin": "catalog:"` 并运行 `pnpm install`。

3. 在插件包 `package.json` 增加 `"fmsPlugin": { "apiVersion": 1 }`；宿主 Vite 会从 `apps/web/package.json` 的依赖自动发现并注册插件，不需要修改宿主源码。

4. Tailwind 插件推荐在 `fmsPlugin.style` 声明 `./styles.css` 并通过 package exports 暴露；宿主会自动导入该样式。本仓库使用 `@source '../../../plugins'` 扫描 workspace 示例插件。

5. 重新启动或构建宿主。管理员可在插件中心启用、停用已打包插件。

最小插件入口：

插件包还需要在 `package.json` 声明 `"fmsPlugin": { "apiVersion": 1 }`，宿主会自动发现它。

```ts
import { PLUGIN_API_VERSION, type WorkspacePlugin } from '@fms/plugin-sdk';

export const plugin: WorkspacePlugin = {
  manifest: {
    id: 'vendor-reports',
    name: '供应商报表',
    version: '1.0.0',
    apiVersion: PLUGIN_API_VERSION,
  },
  routes: [
    {
      id: 'vendor-reports.page',
      path: '/vendor-reports',
      permission: 'vendor-reports:view',
      menu: { label: '供应商报表', order: 40 },
      load: () => import('./VendorReportsPage'),
    },
  ],
};
```

插件组件接收 `runtime`：

```tsx
import type { PluginComponentProps } from '@fms/plugin-sdk';
import { Button } from 'antd';

export default function VendorReportsPage({ runtime }: PluginComponentProps) {
  const canExport = runtime.can('vendor-reports:export');
  // runtime.api 会自动携带宿主 Bearer token，并统一处理 401/403。
  return (
    <div className="grid gap-4">
      <Button disabled={!canExport} type="primary">
        导出报表
      </Button>
    </div>
  );
}
```

插件包应将 `react`、`antd`、`@fms/plugin-sdk` 和使用到的 `@fms/plugin-contracts` 声明为 peer dependencies，输出 ESM 与 `.d.ts`。交互组件使用 Ant Design，布局和定制样式使用 Tailwind utility。插件 ID、路由 ID、路由路径和模块 ID 必须唯一；`/login`、`/dashboard`、`/plugins` 为宿主保留路径。无效插件不会注入菜单、路由或模块，错误原因会显示在插件中心。

## 鉴权与 Mock

- Bearer token 保存在 `sessionStorage`，关闭标签页后失效。
- 菜单、路由和模块使用同一套权限码过滤；Mock API 再独立校验 token 和权限。
- 401 会清理会话并返回登录页，403 只展示无权限状态，不会退出登录。
- 插件启停状态保存在 Mock 工作区全局数据中，不随账号退出而清除。
- 设置 `VITE_ENABLE_MOCKS=false` 可关闭 MSW，连接真实后端时保持现有 API Client 接口即可。
