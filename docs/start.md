# FMS 开发入门与工程规范

本文是 FMS Workspace 的标准开发入口，面向宿主应用开发者、仓库内插件开发者和独立 npm 插件开发者。按本文完成环境准备、首次启动、日常开发和交付检查后，再根据需要阅读 [插件开发与联调规范](./plugin-development.md) 了解插件协议、跨插件扩展和通信细节。

## 1. 开始前先了解

FMS 是基于 React、TypeScript、Vite 和 pnpm workspace 的前端插件基座。宿主负责登录、权限、菜单、路由、API Client、Query Service 和插件生命周期；插件通过 SDK 声明页面、模块、插槽、页面入口和通信能力。

当前插件采用**构建期静态集成**：插件作为 npm/workspace 依赖安装，由 Vite 自动发现并打进宿主产物。插件与宿主运行在同一个 React 页面中，只适合接入经过审核的可信代码；当前不支持浏览器运行时下载远程插件、Module Federation 或 iframe 沙箱。

建议按以下顺序阅读：

1. 新成员先完成本文的“环境准备”和“首次启动”。
2. 修改宿主或现有插件时，遵守本文的日常工作流和工程规范。
3. 新增插件时，先确定是仓库内 workspace 插件还是独立 npm 插件。
4. 涉及插槽、跨插件契约、通信或远程联调时，继续阅读 [插件开发与联调规范](./plugin-development.md)。

## 2. 环境准备

### 2.1 必需环境

| 工具    | 要求                   | 说明                                  |
| ------- | ---------------------- | ------------------------------------- |
| Node.js | `>= 24.0.0`            | 以根 `package.json` 的 `engines` 为准 |
| pnpm    | `>= 10.0.0`            | 仓库锁定 `pnpm@10.30.3`               |
| Git     | 团队支持版本           | Lefthook 会安装 Git hooks             |
| 浏览器  | 当前稳定版 Chrome/Edge | 用于开发和响应式验证                  |

进入仓库根目录后先确认版本：

```bash
node --version
pnpm --version
```

推荐使用仓库声明的 pnpm 版本。已安装 Corepack 时可执行：

```bash
corepack enable
corepack prepare pnpm@10.30.3 --activate
```

不要在仓库内混用 `npm install`、Yarn 和 pnpm，也不要手工编辑 `pnpm-lock.yaml`。

### 2.2 私有 Registry

使用私有 npm 包时，在本机或 CI 配置 scope 对应的 Registry。Token 通过环境变量或 CI Secret 注入，不得提交真实 Token、个人 `.npmrc` 或其他凭据。

```ini
@fms:registry=https://registry.example.com/
@vendor:registry=https://registry.example.com/
//registry.example.com/:_authToken=${NPM_TOKEN}
```

独立插件、`@fms/plugin-sdk` 和公共契约包应从团队约定的同一 Registry 获取，避免本地和 CI 解析到不同来源。

## 3. 首次安装与启动

所有根命令都在 FMS 仓库根目录执行：

```bash
pnpm install
pnpm dev
```

`pnpm install` 会执行根目录的 `preinstall` 和 `postinstall`，自动安装并构建 `external/three` 外部插件示例。不要使用 `--ignore-scripts`，否则外部插件可能没有可供宿主加载的构建产物。

`pnpm dev` 默认启动 [http://localhost:3000](http://localhost:3000)，并同时启动 `external/three` 的开发 watcher。端口由 `external/three/fms.dev.json` 或 `FMS_HOST_URL` 管理，不要额外传入 `--port`。

本地 Mock 账号：

| 身份     | 用户名   | 密码        | 可见功能                   |
| -------- | -------- | ----------- | -------------------------- |
| 管理员   | `admin`  | `admin123`  | one、two、three 和插件管理 |
| 普通用户 | `viewer` | `viewer123` | 仅 one 工作台              |

开发环境通过 `apps/web/.env.development` 开启 Mock：

```dotenv
VITE_ENABLE_MOCKS=true
```

个人配置优先放在不提交的 `.env.development.local`。连接真实后端时设置 `VITE_ENABLE_MOCKS=false`，并由同源网关或 Vite 代理处理 `/api`；插件不能自行读取 Token 或维护另一套 API Base URL。

首次启动后至少验证：

1. 管理员可以登录并访问 Dashboard、履约报表、承运商评级和插件中心。
2. 普通用户只能看到被授权功能，直接访问未授权路由会进入 403 页面。
3. 插件中心中的已安装插件均显示“校验通过”。
4. 浏览器控制台没有未处理异常、React Hook 警告或资源加载失败。

## 4. 项目结构与职责

```text
apps/web/                    Vite 宿主、路由、鉴权、Mock API 和应用级测试
packages/plugin-sdk/        插件协议、运行时类型、校验、排序和 Query Hook
packages/plugin-contracts/  跨插件共享配置、路由、插槽、通道和 DTO Schema
plugins/one/                Dashboard 插槽模块插件示例
plugins/two/                履约报表整页插件示例
external/three/             独立外部插件与跨插件扩展示例
public/                     根静态资源
apps/web/public/            Web 应用专用静态资源
docs/                       开发、评审和实施文档
```

`apps/*`、`packages/*` 和 `plugins/*` 属于根 pnpm workspace。`external/three` 有独立的 `package.json`、`pnpm-workspace.yaml` 和锁文件，不属于根 workspace；根脚本通过 `pnpm --dir external/three ...` 显式调用它。

修改代码前先确认所有权边界：

- 通用插件类型和运行时协议放在 `plugin-sdk`，不能只在某个插件中复制一份。
- 多个插件共享的路由、插槽、通道和 DTO 放在 `plugin-contracts`。
- 插件私有业务逻辑留在插件包内，不放入宿主。
- 登录、全局路由、权限、插件注册和公共运行时属于宿主。
- 新增宿主插槽需要同时更新页面中的 `PluginSlot` 和 `HOST_SLOTS` 白名单。

## 5. 日常开发工作流

### 5.1 开始开发

1. 拉取目标分支，确认 Node.js 和 pnpm 版本正确。
2. `package.json`、`pnpm-workspace.yaml` 或锁文件有变化时运行 `pnpm install`。
3. 使用 `pnpm dev` 启动完整环境。
4. 优先运行受影响包的检查和测试，提交前再执行全仓门禁。
5. 不提交 `.env*.local`、Registry Token、tgz 绝对路径、调试日志和本地缓存。

### 5.2 常用命令

| 目的                       | 命令                                      |
| -------------------------- | ----------------------------------------- |
| 安装全部依赖               | `pnpm install`                            |
| 启动宿主和外部插件 watcher | `pnpm dev`                                |
| 全仓类型检查               | `pnpm typecheck`                          |
| 全仓 lint                  | `pnpm lint`                               |
| 全仓单测                   | `pnpm test`                               |
| 全仓生产构建               | `pnpm build`                              |
| 仅运行宿主测试             | `pnpm --filter @fms/web test`             |
| 检查指定插件类型           | `pnpm --filter @fms/plugin-one typecheck` |
| 测试指定插件               | `pnpm --filter @fms/plugin-two test`      |
| 单独准备外部插件           | `pnpm external:setup`                     |
| 单独构建外部插件           | `pnpm --dir external/three build`         |
| 检查外部插件发布文件       | `pnpm --dir external/three pack:check`    |

Vitest 测试文件与源码就近放置，使用 `*.test.ts` 或 `*.test.tsx`。调试单个测试时可以向对应包传递 Vitest 参数，例如：

```bash
pnpm --filter @fms/web exec vitest run src/pages/PluginCenterPage.test.tsx
```

### 5.3 提交前门禁

行为变更必须增加聚焦的回归测试。提交或发起 PR 前依次执行：

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm build
```

生产构建不仅编译包和应用，还会运行 `verify:production` 检查产物。不能用局部检查代替最终全仓门禁。

## 6. 仓库内 workspace 插件开发

### 6.1 选择插件贡献类型

| 类型         | 适用场景                     | 主要声明                     |
| ------------ | ---------------------------- | ---------------------------- |
| 整页插件     | 提供完整业务页面和菜单       | `routes`                     |
| 宿主路由模块 | 向宿主公开位置增加模块       | `modules`                    |
| 插件扩展模块 | 向另一插件公开的插槽增加模块 | `extensionSlots` + `modules` |
| 插件页面入口 | 在另一插件页面增加跳转入口   | `routeLinks`                 |
| 插件通信     | 进程内定向消息或工作区广播   | `runtime.channel`            |

不要通过 DOM 查询、Portal、全局事件或硬编码 URL 绕过插件协议。详细贡献格式见 [插件开发与联调规范](./plugin-development.md#2-选择贡献类型)。

### 6.2 创建包

仓库内插件放在 `plugins/<name>`，根 workspace 已包含 `plugins/*`。推荐结构：

```text
plugins/vendor-reports/
├── package.json
├── tsconfig.json
├── tsconfig.build.json
└── src/
    ├── index.ts
    ├── contract.ts
    ├── VendorReportsPage.tsx
    └── VendorReportsPage.test.tsx
```

仓库内包的关键规则：

- 第三方依赖使用 `catalog:`，版本统一维护在根 `pnpm-workspace.yaml`。
- SDK、契约和其他内部包使用 `workspace:*`。
- 可发布包的 `peerDependencies` 必须写明确 SemVer 范围，不能写 `catalog:` 或 `workspace:*`。
- `react`、`react-dom`、`antd`、SDK 和使用到的公共契约必须 externalize，不能重复打入插件 bundle。

可参考 `plugins/one` 或 `plugins/two` 创建 `package.json`。宿主只会扫描 `apps/web/package.json` 的直接依赖，所以创建包后还必须添加宿主依赖：

```json
{
  "dependencies": {
    "@vendor/fms-plugin-vendor-reports": "workspace:*"
  }
}
```

然后执行：

```bash
pnpm install
```

### 6.3 声明包元数据和插件入口

插件包必须包含发现元数据：

```json
{
  "name": "@vendor/fms-plugin-vendor-reports",
  "version": "1.0.0",
  "type": "module",
  "fmsPlugin": {
    "id": "vendor-reports",
    "apiVersion": 1
  }
}
```

入口必须提供名为 `plugin` 的导出。`default` 导出可以保留给人工使用，但不能替代命名导出：

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

必须保持以下字段一致：

| 包元数据               | 插件 manifest         | 约束                        |
| ---------------------- | --------------------- | --------------------------- |
| `fmsPlugin.id`         | `manifest.id`         | 全局唯一 kebab-case         |
| `package.json.version` | `manifest.version`    | 完全一致                    |
| `fmsPlugin.apiVersion` | `manifest.apiVersion` | 当前为 `PLUGIN_API_VERSION` |

插件 ID、路由 ID、模块 ID、路由路径和权限码必须唯一。`/login`、`/dashboard` 和 `/plugins` 是宿主保留路径。

### 6.4 接入宿主和 Mock

1. 在 `apps/web/package.json` 添加插件依赖并运行 `pnpm install`。
2. 页面、模块和操作分别声明权限码，命名使用 `领域:动作`。
3. Mock 账号需要具备对应权限；专属 API 才需要新增 Mock handler 和数据。
4. Mock handler 和真实后端必须再次校验权限，前端隐藏按钮不是安全边界。
5. 启动宿主，在插件中心确认发现、加载、校验和启停状态。
6. 分别验证管理员、普通用户、直接 URL 和直接 API 请求。

## 7. 独立 npm 插件包开发

独立插件适用于单独仓库、独立版本和独立发布的业务模块。`external/three` 是仓库内可直接运行的完整示例。

### 7.1 推荐目录

```text
fms-plugin-vendor-reports/
├── package.json
├── pnpm-lock.yaml
├── pnpm-workspace.yaml
├── tsconfig.json
├── src/
│   ├── index.ts
│   ├── contract.ts
│   ├── styles.css
│   ├── VendorReportsPage.tsx
│   └── VendorReportsPage.test.tsx
└── README.md
```

独立仓库不能依赖 FMS 根 workspace 的 `catalog:` 或 `workspace:*`，所有开发依赖必须写可从 Registry 获取的真实版本。只有本机联调阶段可以临时使用 `link:`。

### 7.2 标准 package.json 模板

以下模板提供 ESM、动态 chunk、类型声明、预编译 CSS 和开发源码入口。版本应按团队 Registry 中的实际版本调整：

```json
{
  "name": "@vendor/fms-plugin-vendor-reports",
  "version": "1.0.0",
  "description": "FMS 供应商报表插件",
  "license": "UNLICENSED",
  "type": "module",
  "files": ["dist", "src", "README.md"],
  "exports": {
    ".": {
      "development": "./src/index.ts",
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js"
    },
    "./styles.css": "./dist/styles.css"
  },
  "scripts": {
    "build": "pnpm build:js && pnpm build:css",
    "build:js": "tsup src/index.ts --format esm --splitting --clean --dts --external react --external react/jsx-runtime --external antd --external @fms/plugin-sdk",
    "build:css": "tailwindcss -i ./src/styles.css -o ./dist/styles.css --minify",
    "typecheck": "tsc --noEmit",
    "lint": "oxlint -D react-hooks/rules-of-hooks -D react-hooks/exhaustive-deps -D react-hooks/set-state-in-effect src",
    "test": "vitest run",
    "pack:check": "pnpm pack --dry-run"
  },
  "devDependencies": {
    "@fms/plugin-sdk": "1.0.0",
    "@tailwindcss/cli": "^4.3.3",
    "@types/react": "^19.0.0",
    "antd": "^6.0.0",
    "oxlint": "^1.76.0",
    "react": "^19.0.0",
    "tailwindcss": "^4.3.3",
    "tsup": "^8.5.0",
    "typescript": "~6.0.0",
    "vitest": "^4.0.0"
  },
  "peerDependencies": {
    "@fms/plugin-sdk": "^1.0.0",
    "antd": "^6.0.0",
    "react": "^19.0.0"
  },
  "engines": {
    "node": ">=24.0.0",
    "pnpm": ">=10.0.0"
  },
  "packageManager": "pnpm@10.30.3",
  "fmsPlugin": {
    "id": "vendor-reports",
    "apiVersion": 1,
    "style": "./styles.css"
  }
}
```

使用了 `react-dom`、`react-router-dom`、`lucide-react`、`@fms/plugin-contracts` 或其他宿主共享包时，应同时加入 `peerDependencies`、开发依赖和 `tsup --external`。不要声明一个未实际使用的 peer dependency。

`development` export 指向源码，因此发布文件必须包含 `src`。不准备发布源码时，删除 `development` 条件和 `files` 中的 `src`，本地开发改为运行构建 watcher 后加载 `dist`。

最小 `tsconfig.json`：

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "jsx": "react-jsx",
    "strict": true,
    "skipLibCheck": true,
    "noEmit": true
  },
  "include": ["src"]
}
```

### 7.3 构建产物要求

发布前的 npm 包至少应包含：

- ESM 主入口 `dist/index.js`。
- 路由和模块懒加载产生的动态 chunk。
- 与导出 API 对应的 `.d.ts`。
- `fmsPlugin.style` 指向的预编译 CSS（使用样式时）。
- 包 README、许可信息和必要的公共契约说明。

包入口顶层不能读取宿主 DOM、发起请求、注册全局监听或访问登录态。实际业务副作用放在 React 生命周期内，并在卸载时清理。单个插件加载失败应只影响该插件，不能阻止宿主启动。

### 7.4 样式交付

外部 npm 插件推荐发布预编译 CSS，并使用插件专属 Tailwind 前缀：

```css
@import 'tailwindcss/theme.css' layer(theme) prefix(vendor);
@import 'tailwindcss/utilities.css' layer(utilities) prefix(vendor);

@source './';
```

JSX 中同步使用前缀，例如 `vendor:grid vendor:gap-4 vendor:md:grid-cols-2`。禁止输出 preflight、`body`、通用标签、`.ant-*` 或无前缀的全局 utility，避免污染宿主和其他插件。

### 7.5 公共契约与版本

跨插件路由、插槽、通道和 DTO Schema 属于公共 API，应发布在独立契约包中。消费方只能引用契约对象，不复制插件 ID、路由、插槽或 topic 字符串。

- 新增兼容字段或能力：升级 minor 版本。
- 修复且不改变契约：升级 patch 版本。
- 删除字段、修改载荷、路由 ID 或行为语义：升级 major 版本。
- 插件 `requires` 和 `peerDependencies` 使用能够真实表达兼容性的 SemVer 范围。
- 不要把宿主当前安装版本直接当成插件的最低兼容版本。

## 8. 本地和远程联调

### 8.1 源码 link 联调

持续开发独立插件时，可让宿主通过 override 使用本机源码。宿主 catalog 仍维护目标发布版本：

```yaml
catalog:
  '@vendor/fms-plugin-vendor-reports': 1.0.0
```

`apps/web/package.json` 使用 catalog：

```json
{
  "dependencies": {
    "@vendor/fms-plugin-vendor-reports": "catalog:"
  }
}
```

宿主根 `package.json` 临时增加本机替换：

```json
{
  "pnpm": {
    "overrides": {
      "@vendor/fms-plugin-vendor-reports": "link:../fms-plugin-vendor-reports"
    }
  }
}
```

运行 `pnpm install` 后重启宿主。除仓库维护的固定示例外，不提交个人绝对路径或临时 override。链接包的 export 若提供 `development: ./src/index.ts`，宿主 Vite 可直接编译源码；插件 CSS 仍需 watcher 更新 `dist/styles.css`。

Vite/Vitest 的 `resolve.dedupe` 应包含 React、React DOM、Ant Design、SDK 和公共契约，避免出现多份 React 或不一致的运行时单例。优先参考 [`external/three`](../external/three/README.md) 的 `fms.dev.json` 与 `dev:host` 实现。

### 8.2 tgz 产物联调

tgz 最接近真实发布结果，适合在发布前验证 `files`、exports、动态 chunk、类型声明和 CSS：

```bash
# 在插件仓库
pnpm install
pnpm typecheck
pnpm lint
pnpm test
pnpm build
pnpm pack

# 在 FMS 仓库，使用 pack 输出的实际绝对路径
pnpm --filter @fms/web add /absolute/path/vendor-fms-plugin-vendor-reports-1.0.0.tgz
pnpm --filter @fms/web list @vendor/fms-plugin-vendor-reports
```

tgz 绝对路径只用于本机验证，不提交到共享分支。每次插件变更后重新 `build + pack + add`，并确认锁文件中的 integrity 已变化。

### 8.3 私有 Registry 联调

多人或远程环境优先使用唯一的预发布版本：

```bash
# 在插件仓库
pnpm typecheck
pnpm lint
pnpm test
pnpm build
pnpm pack --dry-run
pnpm publish --tag dev --no-git-checks
```

建议使用不可变版本，例如 `1.1.0-dev.20260804.3`。宿主在 catalog 中登记明确版本，不只依赖可移动的 `dev` tag：

```yaml
catalog:
  '@vendor/fms-plugin-vendor-reports': 1.1.0-dev.20260804.3
```

更新 `apps/web/package.json` 后执行 `pnpm install` 并提交对应锁文件。生产集成必须删除本地 override，使用 Registry 中可追溯、不可覆盖的正式版本。

## 9. 编码与架构规范

### 9.1 TypeScript 与文件命名

- 使用 2 空格缩进、单引号、分号、尾随逗号和 130 字符行宽。
- React 组件、页面和 Provider 使用 PascalCase，例如 `PluginCenterPage.tsx`。
- 函数和变量使用 camelCase；普通文件使用 kebab-case，例如 `api-client.ts`。
- 保持严格类型，禁止用大范围 `any`、双重断言或非空断言掩盖协议问题。
- 导出类型和公共契约写 TSDoc，说明业务含义、权限、真实路径和兼容约束。
- 有意未使用的参数以 `_` 开头。

### 9.2 React 与数据请求

- Hook 只在组件或自定义 Hook 顶层调用，不在条件、循环或普通函数中调用。
- 组件统一接收 `PluginComponentProps`，通过 `runtime.can` 判断细粒度权限。
- 请求统一使用 `runtime.api`，不得读取 `sessionStorage` 中的 Token 或另建鉴权 Client。
- 服务端状态使用 `runtime.query` 和 `usePluginQuery`，筛选、排序、分页进入 query key 并同步到 URL。
- API 响应必须使用运行时 Schema 校验，不能只声明 TypeScript interface 后直接断言。
- 订阅、计时器和全局监听必须在 effect 清理；异步请求支持 `AbortSignal`。
- 页面覆盖 loading、empty、error、forbidden、offline、ready 和 retry 状态。

Query、Schema 和类型化导航示例见 [插件开发与联调规范](./plugin-development.md#6-组件与数据查询规范)。

### 9.3 UI、CSS 与可访问性

- 表单、按钮、表格、弹窗和反馈优先使用 Ant Design。
- 图标使用 Lucide；布局、响应式和少量定制样式使用 Tailwind utility。
- Tailwind 尺寸优先使用项目间距刻度，避免 `h-[70px]` 等任意 px 值；应使用对应 token，例如 `h-17.5!`。
- 不覆盖宿主 `body`、`.ant-*`、通用标签或全局 CSS 变量。
- 表格等宽内容在自身容器滚动，不能造成页面级横向溢出。
- 在 375、768、1024 和 1440 像素宽度下验证无重叠、截断和不可操作控件。
- 交互控件支持键盘和可见焦点；图标按钮提供可访问名称或 Tooltip。

### 9.4 权限与安全

- 权限码使用 `领域:动作`，页面、菜单、模块、按钮和 API 使用同一语义。
- 前端权限只控制体验，后端或 Mock handler 必须独立校验 Token 与权限。
- 401 清理会话并回登录页；403 保留会话并展示无权限状态。
- 禁止在代码、配置、Mock 数据或测试快照中提交 Token、账号密钥和生产数据。
- 插件是宿主同进程可信代码，新增依赖和发布产物必须经过代码审查及依赖安全检查。

## 10. 依赖管理规范

| 场景                        | 写法              | 示例                               |
| --------------------------- | ----------------- | ---------------------------------- |
| 根 workspace 公共第三方依赖 | `catalog:`        | `"react": "catalog:"`              |
| 根 workspace 内部包         | `workspace:*`     | `"@fms/plugin-sdk": "workspace:*"` |
| 可发布包兼容约束            | 显式 SemVer peer  | `"react": "^19.0.0"`               |
| 独立插件开发依赖            | Registry 真实版本 | `"@fms/plugin-sdk": "1.0.0"`       |
| 本机临时联调                | `link:` 或 tgz    | `link:../plugin`                   |

新增或升级公共依赖时：

1. 只在 `pnpm-workspace.yaml` catalog 更新版本。
2. 子包继续使用 `catalog:`，不要重复写版本。
3. 运行 `pnpm install` 并提交 `pnpm-lock.yaml`。
4. 检查 peer dependency 范围是否仍真实兼容。
5. 执行类型检查、测试和生产构建。

依赖只放在实际使用它的包中。运行时需要但由宿主提供的依赖放在 `peerDependencies`；本包构建和测试需要的对应版本放在 `devDependencies`。不要仅为消除 peer warning 添加未使用依赖。

## 11. 测试规范

测试使用 Vitest、Testing Library、`jest-dom` 和 jsdom，重点覆盖用户可观察行为：

- 页面、菜单和模块的权限过滤。
- 登录失效、401、403、API 异常、超时、取消和重试。
- 插件 manifest、包元数据、依赖、路由和插槽校验。
- 插件加载或渲染失败时的隔离和恢复。
- Query 的缓存、去重、旧数据保留和 Schema 失败。
- 插件启停、直接路由、跨插件入口和通信清理。

测试应就近放置，Mock 必须可重置、无随机时间依赖且结果稳定。优先通过角色、文本和可访问名称查询 DOM，避免测试内部实现或脆弱的 CSS 结构。

行为变更至少包含一个能在修复前失败、修复后通过的回归测试。纯文档和无行为格式调整可不增加测试，但仍需运行与改动范围匹配的检查。

## 12. Git、提交与 PR 规范

提交遵循 Conventional Commits：

```text
feat(plugin): add vendor report page
fix(auth): preserve requested route
docs: add npm plugin release guide
test(query): cover schema parse failure
```

允许的类型包括 `feat`、`fix`、`docs`、`style`、`refactor`、`perf`、`test`、`build`、`ci`、`chore` 和 `revert`。可使用以下命令进入提交引导：

```bash
pnpm commit
```

Lefthook 会格式化暂存文件并执行相关 lint，commit-msg hook 会运行 Commitlint。Hook 通过不代表全仓门禁已通过。

PR 描述至少包含：

1. 问题背景和目标。
2. 解决方案以及未选择方案的关键取舍。
3. 受影响的 app、package 和 plugin。
4. 权限码、插件 manifest、配置或数据契约变化。
5. 实际执行的验证命令和结果。
6. UI 变化的桌面、移动端截图。
7. 关联 issue、兼容性影响和回滚方式。

避免在同一 PR 混入无关重构、全仓格式化或依赖升级。

## 13. npm 插件发布流程

### 13.1 发布前检查

```bash
pnpm install --frozen-lockfile
pnpm typecheck
pnpm lint
pnpm test
pnpm build
pnpm pack --dry-run
```

确认 `pnpm pack --dry-run` 的文件清单只包含预期产物，不含 `.env`、测试缓存、覆盖率、源码映射中的私有路径或凭据。必要时实际执行 `pnpm pack`，在一个干净目录中安装 tgz 做最终验证。

### 13.2 发布检查表

- npm 包名、插件 ID、贡献 ID、路径和权限码正确且唯一。
- `package.json.version`、`manifest.version` 和发布 Tag 对应一致。
- `fmsPlugin.id/apiVersion/style` 与 manifest 和 exports 一致。
- 必选/可选插件依赖、能力依赖和 peer 范围使用有效 SemVer。
- ESM、动态 chunk、`.d.ts` 和 CSS 均已进入 npm 包。
- React、Ant Design、SDK 和公共契约未重复打入 bundle。
- README 写明安装、权限、API、配置、兼容版本和升级注意事项。
- 管理员、普通用户、直接 URL、直接 API 和插件禁用流程已验证。
- 移动端和桌面端无溢出，浏览器控制台无 warning/error。
- 预发布版本唯一且不可覆盖；正式版本只能发布一次。

预发布建议使用 `dev` 或 `next` tag，验证通过后再发布正式版本：

```bash
pnpm publish --tag next
```

具体 Registry、审批、签名和 CI 发布步骤以团队发布平台为准。不要从包含未提交源码改动的工作目录手工发布正式包。

## 14. 常见问题

### 安装阶段外部插件失败

确认 `external/three` 可访问、Node/pnpm 版本正确，并单独执行：

```bash
pnpm external:setup
```

### 端口 3000 被占用

`pnpm dev` 使用 `external/three/fms.dev.json` 中的宿主 URL。优先临时设置 `FMS_HOST_URL=http://localhost:<port>`，需要团队统一变更默认端口时再修改配置；不要额外传入 `--port`。

### 插件已安装但未被发现

确认插件是 `apps/web/package.json` 的直接依赖，已运行 `pnpm install`，且包的 `package.json` 包含有效 `fmsPlugin` 对象。修改依赖或包元数据后重启 Vite。

### 插件中心显示注册失败

根据诊断阶段定位：`discovery` 检查包元数据，`load` 检查命名导出和顶层异常，`schema` 检查协议结构，`compatibility` 检查版本，`contribution` 检查路由/插槽，`dependency` 检查依赖版本和循环。

### 插件没有菜单或模块

确认插件已启用、当前用户具备权限。页面插件需要 `routes`；模块必须匹配真实存在的 `routeId + slotId`，目标页面还必须渲染对应 `PluginSlot`。

### 页面或 API 返回 403

检查页面、模块、操作、Mock 用户和 API handler 是否使用同一权限码。403 不应退出登录；401 才会清理会话。

### Tailwind 样式缺失

确认 `fmsPlugin.style` 指向已导出的 CSS，或宿主 `@source` 覆盖实际 ESM 目录；检查 class 是否为静态完整字符串。外部插件还要确认前缀和 CSS watcher 是否生效。

### Invalid hook call 或组件上下文异常

通常是链接包带来了第二份 React，或插件把 React/Ant Design/SDK 打入了 bundle。检查 `peerDependencies`、`tsup --external` 和 Vite `resolve.dedupe`。

### tgz 或 Registry 更新后仍是旧代码

确认安装的精确版本和 lockfile integrity 已变化，删除临时 override，重新安装并重启宿主。必要时给 Vite 传递 `--force` 重新进行依赖预构建。

### 类型通过但运行时接口报错

TypeScript 类型不会校验网络响应。为 DTO 提供 Zod 等运行时 Schema，并通过 `runtime.query` 解析未知数据，不要断言为目标 interface。

## 15. 新成员完成标准

完成以下事项后，视为已具备独立开发条件：

- 使用正确 Node.js/pnpm 版本完成安装和启动。
- 分别使用管理员和普通用户验证权限行为。
- 能定位宿主、SDK、公共契约、workspace 插件和外部插件代码。
- 能运行单包测试及全仓四项门禁。
- 能创建一个最小插件并在插件中心确认校验结果。
- 理解 `catalog:`、`workspace:*`、peer dependency、link 和 tgz 的适用边界。
- 理解插件是构建期可信代码，不具备运行时沙箱隔离。
- 能按 Conventional Commits 提交，并写出包含验证结果的 PR 描述。

## 16. 相关文档

- [项目概览与快速开始](../README.md)
- [插件开发与联调规范](./plugin-development.md)
- [全局代码评审报告](./code-review.md)
- [代码评审实施计划](./code-review-implementation-plan.md)
- [three 外部插件示例](../external/three/README.md)
