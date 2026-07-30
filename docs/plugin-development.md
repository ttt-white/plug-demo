# FMS 插件开发与联调规范

本文面向 FMS Workspace 插件开发者和宿主集成人员，说明插件如何设计、开发、注册、测试及联调。

## 1. 能力边界

当前插件机制是构建期静态集成：

```text
npm/workspace 安装
  -> installedPlugins 静态导入
  -> 宿主启动时校验贡献
  -> /api/plugins 返回启停状态
  -> 生成菜单、受保护路由或宿主插槽模块
```

插件与宿主运行在同一个 React 页面中，适用于经过审核的可信代码。当前不支持：

- 浏览器运行时输入 URL 后加载远程 JavaScript。
- Module Federation、远程 ESM 或 iframe 沙箱。
- 插件覆盖 `/login`、`/dashboard`、`/plugins` 等宿主路由。
- 插件向未公开的 DOM 节点任意注入内容。

“远程联调”指插件构建物通过私有 npm、预发布版本或 tgz 交付给远程宿主，宿主安装并重新启动。它不是运行时远程模块加载。

## 2. 选择贡献类型

| 类型     | 使用场景                               | 注册内容  | 当前示例           |
| -------- | -------------------------------------- | --------- | ------------------ |
| 路由模块 | 在宿主已有页面的明确位置增加一个小模块 | `modules` | Dashboard 经营指标 |
| 整页插件 | 提供完整业务页面及顶部菜单入口         | `routes`  | 履约报表           |

模块必须同时匹配 `routeId + slotId`。宿主当前公开：

| routeId     | slotId              | 用途                   |
| ----------- | ------------------- | ---------------------- |
| `dashboard` | `dashboard.metrics` | Dashboard 经营指标区域 |

新增宿主插槽时，宿主开发者必须同时：

1. 在目标页面渲染 `PluginSlot`。
2. 在 `PluginRegistryProvider.tsx` 的 `HOST_SLOTS` 中声明白名单。
3. 约定插槽尺寸、数据语义和权限码。

## 3. 命名与权限规范

- npm 包名：`@组织/fms-plugin-业务名`。
- 插件 ID：全局唯一 kebab-case，例如 `vendor-reports`。
- 路由 ID、模块 ID：使用插件 ID 作为前缀，例如 `vendor-reports.page`。
- 路由：使用绝对路径并包含业务语义，例如 `/vendor-reports`。
- 权限码：使用 `领域:动作`，例如 `vendor-reports:view`、`vendor-reports:export`。
- `manifest.version` 必须与 npm 包版本一致。
- `manifest.apiVersion` 必须使用 `PLUGIN_API_VERSION`，禁止直接写魔法数字。

菜单 `order` 越小越靠前。模块 `priority` 越大越靠前；相同优先级由宿主按插件 ID 稳定排序。

## 4. 标准包结构

```text
fms-plugin-vendor-reports/
├── package.json
├── tsconfig.json
├── tsconfig.build.json
└── src/
    ├── index.ts
    └── VendorReportsPage.tsx
```

仓库内插件使用 catalog 和 workspace 协议：

```json
{
  "name": "@vendor/fms-plugin-vendor-reports",
  "version": "1.0.0",
  "private": false,
  "type": "module",
  "files": ["dist"],
  "exports": {
    ".": {
      "development": "./src/index.ts",
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js"
    }
  },
  "scripts": {
    "build": "tsup src/index.ts --format esm --splitting --clean --external react --external antd --external @fms/plugin-sdk && tsc -p tsconfig.build.json",
    "typecheck": "tsc --noEmit",
    "test": "vitest run"
  },
  "devDependencies": {
    "@fms/plugin-sdk": "workspace:*",
    "@types/react": "catalog:",
    "antd": "catalog:",
    "react": "catalog:"
  },
  "peerDependencies": {
    "@fms/plugin-sdk": "^1.0.0",
    "antd": "^6.0.0",
    "react": "^19.0.0"
  }
}
```

外部独立仓库不能使用 FMS workspace 的 `catalog:` 或 `workspace:*`，需要在 `devDependencies` 写实际开发版本；`peerDependencies` 仍声明兼容范围。

React、Ant Design 和 SDK 必须 externalize 并声明为 peer dependency，禁止打包进插件产物，否则可能出现多份 React、Hook 运行错误或 Ant Design 上下文不一致。

## 5. 定义插件入口

### 5.1 整页插件

```ts
import { PLUGIN_API_VERSION, type WorkspacePlugin } from '@fms/plugin-sdk';

export const plugin: WorkspacePlugin = {
  manifest: {
    id: 'vendor-reports',
    name: '供应商报表',
    version: '1.0.0',
    apiVersion: PLUGIN_API_VERSION,
    description: '供应商履约与结算报表。',
  },
  routes: [
    {
      id: 'vendor-reports.page',
      path: '/vendor-reports',
      permission: 'vendor-reports:view',
      menu: { label: '供应商报表', icon: 'chart-no-axes-column', order: 40 },
      load: () => import('./VendorReportsPage'),
    },
  ],
};

export default plugin;
```

插件页面只能注册到登录后的 Layout。当前宿主识别 `chart-no-axes-column`，未知图标会回退为通用插件图标。

### 5.2 路由模块插件

```ts
import { PLUGIN_API_VERSION, type WorkspacePlugin } from '@fms/plugin-sdk';

export const plugin: WorkspacePlugin = {
  manifest: {
    id: 'vendor-risk',
    name: '供应商风险模块',
    version: '1.0.0',
    apiVersion: PLUGIN_API_VERSION,
  },
  modules: [
    {
      id: 'vendor-risk.dashboard-summary',
      routeId: 'dashboard',
      slotId: 'dashboard.metrics',
      permission: 'vendor-risk:view',
      priority: 80,
      load: () => import('./VendorRiskModule'),
    },
  ],
};
```

不要通过 `document.querySelector`、Portal 或全局事件把模块挂到任意 DOM。新增位置应先扩展宿主插槽协议。

## 6. 组件开发规范

插件组件统一接收 `runtime`：

```tsx
import type { PluginComponentProps } from '@fms/plugin-sdk';
import { PluginContainer, type PluginContentState } from '@fms/plugin-shared';
import { Button } from 'antd';
import { useEffect, useState } from 'react';

interface ResponseData {
  rows: Array<{ id: string; name: string }>;
}

export default function VendorReportsPage({ runtime }: PluginComponentProps) {
  const [state, setState] = useState<PluginContentState<ResponseData>>({ status: 'loading' });

  useEffect(() => {
    let active = true;
    void runtime.api
      .get<ResponseData>('/api/vendor-reports')
      .then((data) => {
        if (active) setState(data.rows.length ? { status: 'ready', data } : { status: 'empty' });
      })
      .catch((error: unknown) => {
        if (active) setState({ status: 'error', error });
      });
    return () => {
      active = false;
    };
  }, [runtime.api]);

  return (
    <PluginContainer state={state}>
      {(data) => (
        <div className="grid gap-4">
          <Button disabled={!runtime.can('vendor-reports:export')} type="primary">
            导出
          </Button>
          <span>{data.rows.length} 条记录</span>
        </div>
      )}
    </PluginContainer>
  );
}
```

必须遵守：

- 请求统一使用 `runtime.api`，不得自行读取 token 或绕过统一 401/403 行为。
- 当前 SDK 提供 `get`、`post`、`patch`；新增方法应先升级 SDK 协议。
- 使用 `runtime.can(permission)` 控制按钮等细粒度能力。
- API 后端仍需独立校验权限，前端隐藏按钮不是安全边界。
- 数据区域优先使用 `PluginContainer` 处理 loading、empty、error、forbidden、offline、ready 和重试。
- effect 首次加载只在 Promise 回调中更新状态，不在 effect 主体同步切换 loading。
- 不以 `use` 开头命名普通事件函数，所有 Hook 只在组件或自定义 Hook 顶层调用。

## 7. UI 与样式规范

- 表单、按钮、表格、弹窗、反馈、菜单等交互组件使用 Ant Design。
- 页面布局、响应式、间距和少量定制外观使用 Tailwind utility。
- 图标使用 Lucide，避免插件自带一套重复图标系统。
- 不覆盖宿主全局 `body`、`.ant-*` 或通用标签样式。
- 插件必须在 390px 移动视口和桌面视口下无页面级横向溢出。
- 表格等宽内容应在自身容器内滚动。

仓库内示例源码已由宿主 Tailwind 入口扫描：

```css
@source '../../../plugins';
```

外部 npm 插件有两种样式交付方式：

1. 推荐由插件发布预编译 CSS，并通过 package exports 暴露，由宿主显式导入。
2. 由宿主扫描插件 ESM，例如在 `apps/web/src/styles.css` 添加：

```css
@source '../node_modules/@vendor/fms-plugin-vendor-reports/dist';
```

第二种方式要求宿主重新构建，且插件只能使用静态、完整的 Tailwind class 字符串，禁止运行时拼接 `bg-${color}-500`。

## 8. 仓库内联调

1. 在 `plugins/<plugin-name>` 创建插件包；`pnpm-workspace.yaml` 已包含 `plugins/*`。
2. 在插件 `package.json` 使用 `catalog:` 管理外部依赖，使用 `workspace:*` 引用 SDK 和公共包。
3. 运行 `pnpm install`。
4. 在 `apps/web/src/plugins/installedPlugins.ts` 静态导入并加入 `installedPlugins`。
5. 在 `apps/web/src/mocks/data.ts` 的默认插件状态中加入插件 ID，否则 Mock 插件中心无法启用它。
6. 给 Mock 账号增加页面、模块或操作需要的权限码。
7. 按需新增 Mock handler 和数据；handler 必须再次校验 token 与权限。
8. 如果增加模块位置，先扩展宿主 `HOST_SLOTS` 和页面中的 `PluginSlot`。
9. 运行 `pnpm dev`，管理员登录后在插件中心确认“校验通过”并启用插件。

联调完成前运行：

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm build
```

## 9. 外部仓库本机联调

推荐使用 tgz 验证真实发布产物，避免 `pnpm link` 引入不同的 React 解析路径。

在插件仓库执行：

```bash
pnpm install
pnpm typecheck
pnpm test
pnpm build
pnpm pack
```

在 FMS 仓库安装生成的包：

```bash
pnpm --filter @fms/web add /绝对路径/vendor-fms-plugin-vendor-reports-1.0.0.tgz
```

然后完成以下宿主改动：

1. 在 `installedPlugins.ts` 静态导入插件。
2. 配置插件启停初始数据和权限。
3. 导入插件预编译 CSS，或在 Tailwind 入口添加 `@source`。
4. 重新启动宿主开发服务器。

每次插件变更后重新 `build + pack + add`。需要确认宿主使用了新包时，可运行：

```bash
pnpm --filter @fms/web list @vendor/fms-plugin-vendor-reports
```

`pnpm link` 只适合短周期开发。使用 link 时，插件必须持续构建 `dist`、保持 React/Ant Design/SDK external，并在依赖缓存未刷新时用 `pnpm --filter @fms/web dev --force` 重启宿主。

## 10. 远程联调

### 10.1 私有 npm 预发布版本（推荐）

插件开发方发布唯一的预发布版本，避免多人覆盖同一个版本：

```bash
pnpm build
pnpm test
pnpm publish --tag dev --no-git-checks
```

建议版本包含流水线编号或 commit，例如 `1.1.0-dev.20260730.3`。宿主方安装明确版本：

```bash
pnpm --filter @fms/web add @vendor/fms-plugin-vendor-reports@1.1.0-dev.20260730.3
```

宿主提交 lockfile 后部署联调环境。不要只依赖可移动的 `dev` tag 判断当前运行版本。

私有 registry 的 token 只放在本机或 CI Secret 中，不提交到仓库。插件包、SDK 和宿主使用同一个 registry scope 配置。

### 10.2 远程 tgz 构建物

CI 可以把 `pnpm pack` 生成的 tgz 上传到带权限和 HTTPS 的制品库。宿主使用固定 URL 安装：

```bash
pnpm --filter @fms/web add https://artifacts.example.com/fms/vendor-plugin-1.1.0-dev.3.tgz
```

每个构建使用不可变 URL；不要覆盖同名 tgz，否则 lockfile integrity 和实际内容会不一致。

### 10.3 共享远程宿主页面

宿主机器安装插件版本后启动：

```bash
pnpm --filter @fms/web dev --host 0.0.0.0 --port 3000
```

通过公司 VPN、受控反向代理或支持 WebSocket 的临时隧道访问。不要把带 Mock 管理员账号的开发服务器直接暴露到公网。

使用真实后端联调时设置 `VITE_ENABLE_MOCKS=false`，并由同源网关或 Vite 代理把 `/api` 转发到测试后端。当前 SDK 使用相对 `/api` 路径，不支持插件自行切换 API Base URL。

## 11. 注册与运行排查

### 插件中心显示“注册失败”

检查 API version、重复插件 ID、重复路由 ID/路径、宿主保留路由、重复模块 ID和未知插槽。错误原因会直接显示在插件中心。

### 插件已安装但没有菜单

确认插件校验通过、启停 API 返回 `enabled: true`、当前用户具备路由权限，并确认页面插件已注册到 `routes`。

### 模块没有出现

确认 `routeId + slotId` 与 `HOST_SLOTS` 完全一致，插件处于启用状态，当前用户具备模块权限，目标宿主页确实渲染了 `PluginSlot`。

### 页面或接口返回 403

页面权限、Mock 用户权限和 API handler 权限必须使用同一个权限码。403 不会退出登录；401 才会清理会话。

### Tailwind 样式缺失

确认宿主导入了插件 CSS，或 Tailwind `@source` 覆盖插件实际的 ESM 输出目录。检查 class 是否为静态完整字符串。

### 出现 Invalid hook call 或多份 React

确认插件没有把 React 打入 dist，`react` 位于 peer dependency，构建命令包含 `--external react`。Ant Design 和 SDK 使用相同策略。

### 更新插件后页面仍是旧版本

确认 lockfile 中版本或 tgz integrity 已变化，重启宿主并按需添加 `--force` 清理 Vite 依赖预构建缓存。

## 12. 提交与发布检查表

- manifest ID、贡献 ID、路径和版本正确且唯一。
- 页面、模块、操作和 API 使用一致的权限码。
- React、Ant Design、SDK 未被打入插件 bundle。
- ESM、动态 chunk 和 `.d.ts` 均包含在 npm 包中。
- `pnpm pack` 后检查 files 清单，不发布源码缓存、测试产物或凭据。
- loading、empty、error、forbidden、offline、ready 和重试行为已覆盖。
- 单个插件加载或渲染失败不会影响 Layout 和其他插件。
- 管理员与普通用户流程均验证，直接路由和直接 API 调用均验证。
- 桌面与移动视口无布局溢出，浏览器控制台无 warning/error。
- 类型检查、lint、测试和生产构建全部通过。
