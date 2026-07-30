# FMS Workspace

FMS Workspace 是一个基于 React 19、Ant Design 6、Tailwind CSS 4、Vite、TypeScript 6 和 pnpm workspace 的前端插件基座。宿主负责登录、RBAC、菜单、路由、API 鉴权与插件生命周期；插件可以贡献一个完整页面，也可以只挂载到某个宿主路由的指定插槽。

插件包结构、开发规范、本机联调和远程联调流程见 [FMS 插件开发与联调规范](docs/plugin-development.md)。

## 快速开始

```bash
pnpm install
pnpm dev
```

开发服务器默认运行在 [http://localhost:3000](http://localhost:3000)。Mock 账号：

| 身份     | 用户名   | 密码        | 权限                                    |
| -------- | -------- | ----------- | --------------------------------------- |
| 管理员   | `admin`  | `admin123`  | Dashboard、指标模块、履约报表、插件管理 |
| 普通用户 | `viewer` | `viewer123` | 仅基础 Dashboard                        |

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
plugins/shared              公共 PluginContainer 与错误边界
plugins/dashboard-metrics   Dashboard 插槽模块示例
plugins/reports             独立页面插件示例
```

宿主当前公开一个模块插槽：`routeId: dashboard` + `slotId: dashboard.metrics`。新增插槽时需要同时在宿主页渲染 `PluginSlot`，并将插槽加入 `HOST_SLOTS` 白名单。

## 依赖 Catalog

第三方依赖版本统一维护在 `pnpm-workspace.yaml` 的 `catalog` 中，各 workspace 包通过 `catalog:` 引用，不在子包重复声明版本。升级公共依赖时只修改 catalog 并运行：

```bash
pnpm install
pnpm typecheck
pnpm test
```

`workspace:*` 继续用于仓库内部包。可发布插件的 `peerDependencies` 保留显式兼容范围，例如 `react: ^19.0.0`、`antd: ^6.0.0`，不使用 `catalog:`，避免把宿主当前安装版本误当成插件的最小兼容版本。

## 第三方 npm 插件

第三方插件在构建期安装，并作为可信 React 代码与宿主同进程运行。首版不支持浏览器运行时下载插件，也不提供 iframe 隔离。

1. 安装包：

```bash
pnpm --filter @fms/web add @vendor/fms-plugin
```

2. 在 `apps/web/src/plugins/installedPlugins.ts` 静态导入并加入 `installedPlugins`。

3. Tailwind 插件需要发布预编译 CSS，或在宿主的 Tailwind 入口通过 `@source` 显式扫描插件包的 ESM 文件。本仓库使用 `@source '../../../plugins'` 扫描 workspace 示例插件。

4. 重新启动或构建宿主。管理员可在插件中心启用、停用已打包插件。

最小插件入口：

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

插件包应将 `react`、`antd` 和 `@fms/plugin-sdk` 声明为 peer dependencies，输出 ESM 与 `.d.ts`。交互组件使用 Ant Design，布局和定制样式使用 Tailwind utility。插件 ID、路由 ID、路由路径和模块 ID 必须唯一；`/login`、`/dashboard`、`/plugins` 为宿主保留路径。无效插件不会注入菜单、路由或模块，错误原因会显示在插件中心。

## 鉴权与 Mock

- Bearer token 保存在 `sessionStorage`，关闭标签页后失效。
- 菜单、路由和模块使用同一套权限码过滤；Mock API 再独立校验 token 和权限。
- 401 会清理会话并返回登录页，403 只展示无权限状态，不会退出登录。
- 插件启停状态保存在 Mock 工作区全局数据中，不随账号退出而清除。
- 设置 `VITE_ENABLE_MOCKS=false` 可关闭 MSW，连接真实后端时保持现有 API Client 接口即可。
