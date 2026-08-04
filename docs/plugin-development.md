# FMS 插件开发与联调规范

本文面向 FMS Workspace 插件开发者和宿主集成人员，说明插件如何设计、开发、注册、测试及联调。

## 1. 能力边界

当前插件机制是构建期静态集成：

```text
npm/workspace 安装
  -> Vite 从 apps/web/package.json 自动发现 fmsPlugin 包
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

| 类型         | 使用场景                               | 注册内容                   | 当前示例                 |
| ------------ | -------------------------------------- | -------------------------- | ------------------------ |
| 宿主路由模块 | 在宿主已有页面的明确位置增加一个小模块 | `modules`                  | Dashboard 经营指标       |
| 整页插件     | 提供完整业务页面及顶部菜单入口         | `routes`                   | 履约报表                 |
| 插件扩展模块 | A 向 B 明确开放的插槽增加功能          | `extensionSlots + modules` | 报表中的承运商评级摘要   |
| 插件页面入口 | A 在 B 页面增加指向唯一业务页面的入口  | `routeLinks`               | 报表中的承运商评级入口   |
| 插件定向通信 | A 向 B 发布有类型约束的内存消息        | `runtime.channel`          | 评级摘要驱动报表筛选条件 |
| 插件公共通信 | 多个插件订阅同一类型化工作区广播       | `publishPublic`            | one、two、three 公共消息 |

模块必须同时匹配 `routeId + slotId`。宿主当前公开：

| routeId     | slotId              | 用途                   |
| ----------- | ------------------- | ---------------------- |
| `dashboard` | `dashboard.metrics` | Dashboard 经营指标区域 |

新增宿主插槽时，宿主开发者必须同时：

1. 在目标页面渲染 `PluginSlot`。
2. 在 `apps/web/src/app/route-catalog.ts` 的 `HOST_SLOTS` 中声明白名单。
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
  "files": ["dist", "src"],
  "fmsPlugin": { "id": "vendor-reports", "apiVersion": 1, "style": "./styles.css" },
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

`development` export 指向源码，因此 `files` 必须包含 `src`；如果不发布源码，则删除 `development` 条件，只保留 `dist` 的 `types` 和 `import`。不要发布一个指向包内不存在文件的 export。

`fmsPlugin.id`、`package.json.version` 和 `fmsPlugin.apiVersion` 是宿主不执行插件代码即可读取的发现元数据，必须分别与 `manifest.id`、`manifest.version` 和 `manifest.apiVersion` 一致。插件入口必须提供名为 `plugin` 的导出；宿主会逐包动态加载，缺少导出或顶层执行失败只会让当前包注册失败，并在插件中心显示 package、阶段和错误码。

最小 TypeScript 配置：

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

`tsconfig.build.json` 在此基础上设置 `noEmit: false`、`declaration: true`、`emitDeclarationOnly: true`、`rootDir: src` 和 `outDir: dist`。

外部独立仓库不能使用 FMS workspace 的 `catalog:` 或 `workspace:*`，需要在 `dependencies`、`devDependencies` 写实际开发版本；`peerDependencies` 仍声明兼容范围。

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

### 5.3 声明插件依赖与能力

跨插件调用应在 manifest 中声明 SemVer 依赖。直接依赖已知插件时使用 `requires.plugins`；调用可由多个插件实现的抽象能力时，提供方使用 `provides.capabilities`，消费方使用 `requires.capabilities`：

```ts
export const plugin: WorkspacePlugin = {
  manifest: {
    id: 'vendor-risk',
    name: '供应商风险模块',
    version: '1.0.0',
    apiVersion: PLUGIN_API_VERSION,
    requires: {
      plugins: [{ id: 'vendor-reports', range: '^1.0.0' }],
      capabilities: [{ id: 'reports.filter-carrier', range: '^1.0.0', optional: true }],
    },
    provides: {
      capabilities: [{ id: 'vendor-risk.summary', version: '1.0.0' }],
    },
  },
};
```

- 必选依赖缺失、版本不匹配、注册失败或形成循环时，当前插件不能注册。
- `optional: true` 的依赖不可用时只产生 warning，插件本身仍可注册；对应代码必须具备降级路径。
- 能力和插件版本必须使用有效 SemVer；依赖范围使用标准 SemVer range。
- 静态贡献仍必须引用真实存在的路由或插槽。把目标声明为 optional 不会让无效贡献变得可用。

### 5.4 跨插件扩展、页面入口与通信

跨插件配置集中发布在独立的 `@fms/plugin-contracts` 包中，避免 one、two、three 彼此形成 npm 循环依赖。各插件自己的 `contract.ts` 只 re-export 对应对象，插件内部仍从本地入口引用。A 不得复制 B 的插件 ID、路由 ID、插槽 ID、URL 或 topic 字符串。

- 唯一运行时导出使用 `<插件名>Contract` camelCase 对象，例如 `twoContract`。
- 必须使用显式的 `<业务名>PluginContract` interface 注解，禁止只写 `as const` 或散落字符串常量。
- 对象固定按 `pluginId / routes / slots / channels` 分组；没有某类能力时可省略该分组。
- 路由、插槽、定向通道和公共通道分别使用 SDK 的 `PluginRouteReference`、`PluginSlotReference`、`PluginChannelReference<TPayload>`、`PluginPublicChannelReference<TPayload>`。
- 每个导出类型、字段和载荷属性必须写 TSDoc，明确业务、真实 URL、插槽位置或消息语义。
- 消费方直接 import 契约对象；不得复制插件 ID、路由 ID、插槽 ID 或 topic。

```ts
// packages/plugin-contracts/src/index.ts
import type {
  PluginChannelReference,
  PluginPublicChannelReference,
  PluginRouteReference,
  PluginSlotReference,
} from '@fms/plugin-sdk';

/** three 向 two 发送承运商筛选条件时使用的消息载荷。 */
export interface TwoFilterCarrierPayload {
  /** 需要在履约报表中筛选的承运商名称。 */
  carrier: string;
}

/** two 插件公开给宿主和其他插件使用的类型化契约。 */
export interface TwoPluginContract {
  /** two 插件的唯一 ID。 */
  readonly pluginId: 'two';
  readonly routes: {
    /** 履约报表页面，对应唯一 URL `/reports`。 */
    readonly two: PluginRouteReference<'two', 'two'> & { readonly path: '/reports' };
  };
  readonly slots: {
    /** two 履约报表页面中的摘要模块插槽。 */
    readonly summary: PluginSlotReference<'two', 'two', 'two.summary'>;
  };
  readonly channels: {
    /** 接收承运商筛选条件。 */
    readonly filterCarrier: PluginChannelReference<TwoFilterCarrierPayload, 'two', 'two:filter-carrier'>;
  };
}

/** two 插件唯一的运行时契约对象。 */
export const twoContract: TwoPluginContract = {
  pluginId: 'two',
  routes: {
    two: { pluginId: 'two', routeId: 'two', path: '/reports' },
  },
  slots: {
    summary: { pluginId: 'two', routeId: 'two', slotId: 'two.summary' },
  },
  channels: {
    filterCarrier: { pluginId: 'two', topic: 'two:filter-carrier' },
  },
};

export interface WorkspacePublicMessagePayload {
  /** 所有订阅插件都能读取的公共消息正文。 */
  message: string;
}

export const workspaceContract: {
  plugins: { one: OnePluginContract; two: TwoPluginContract; three: ThreePluginContract };
  channels: {
    publicMessage: PluginPublicChannelReference<WorkspacePublicMessagePayload, 'workspace:public-message'>;
  };
} = {
  plugins: { one: oneContract, two: twoContract, three: threeContract },
  channels: {
    publicMessage: { topic: 'workspace:public-message' },
  },
};

// plugins/two/src/contract.ts
export { twoContract, type TwoPluginContract } from '@fms/plugin-contracts';
```

B 在插件入口开放插槽，并在页面中直接渲染入口和插槽：

```tsx
// B: index.ts
import { twoContract } from './contract';

export const plugin: WorkspacePlugin = {
  manifest: { id: twoContract.pluginId, name: 'two', version: '1.0.0', apiVersion: PLUGIN_API_VERSION },
  routes: [
    {
      id: twoContract.routes.two.routeId,
      path: twoContract.routes.two.path,
      permission: 'reports:view',
      menu: { label: 'two', order: 30 },
      load: () => import('./TwoPage'),
    },
  ],
  extensionSlots: [
    {
      id: twoContract.slots.summary.slotId,
      routeId: twoContract.slots.summary.routeId,
    },
  ],
};

// B: TwoPage.tsx
export default function TwoPage({ runtime }: PluginComponentProps) {
  useEffect(
    () =>
      runtime.channel.subscribe(twoContract.channels.filterCarrier, ({ carrier }) => {
        setQuery(carrier);
      }),
    [runtime.channel],
  );

  return (
    <div>
      {runtime.extensions.routesFor(twoContract.routes.two).map((route) => (
        <Button key={route.id} onClick={() => runtime.extensions.navigateTo(route.targetRoute)}>
          {route.label}
        </Button>
      ))}
      {runtime.extensions.renderSlot(twoContract.slots.summary)}
    </div>
  );
}
```

A 将 B 包声明为 peer dependency，并使用 B 导出的契约注册模块和页面入口。A 的页面只注册一个真实地址：

```ts
// packages/plugin-contracts/src/index.ts
import type { PluginRouteReference } from '@fms/plugin-sdk';

/** three 插件公开给宿主和其他插件使用的类型化契约。 */
export interface ThreePluginContract {
  /** three 插件的唯一 ID。 */
  readonly pluginId: 'three';
  readonly routes: {
    /** 承运商评级页面，对应唯一 URL `/carrier-ratings`。 */
    readonly three: PluginRouteReference<'three', 'three'> & { readonly path: '/carrier-ratings' };
  };
}

export const threeContract: ThreePluginContract = {
  pluginId: 'three',
  routes: {
    three: { pluginId: 'three', routeId: 'three', path: '/carrier-ratings' },
  },
};

// A: index.ts
import { threeContract, twoContract } from '@fms/plugin-contracts';

export const plugin: WorkspacePlugin = {
  manifest: { id: threeContract.pluginId, name: 'three', version: '1.0.0', apiVersion: PLUGIN_API_VERSION },
  routes: [
    {
      id: threeContract.routes.three.routeId,
      path: threeContract.routes.three.path,
      permission: 'carrier-ratings:view',
      menu: { label: 'three', order: 35 },
      load: () => import('./ThreePage'),
    },
  ],
  routeLinks: [
    {
      id: 'two.three',
      parentRoute: twoContract.routes.two,
      targetRoute: threeContract.routes.three,
      permission: 'carrier-ratings:view',
      menu: { label: 'three', order: 10 },
    },
  ],
  modules: [
    {
      id: 'three.two-summary',
      targetPluginId: twoContract.slots.summary.pluginId,
      routeId: twoContract.slots.summary.routeId,
      slotId: twoContract.slots.summary.slotId,
      permission: 'carrier-ratings:view',
      load: () => import('./ThreeTwoModule'),
    },
  ],
};
```

页面或模块通过同一个类型化引用跳转，不写路径字符串：

```ts
runtime.extensions.navigateTo(threeContract.routes.three);
```

需要把筛选等可分享状态带到目标页时，通过 `PluginNavigationOptions.search` 附加查询参数，不手工拼接 URL：

```ts
runtime.extensions.navigateTo(twoContract.routes.two, {
  search: { carrier: row.carrier, status: null },
});
```

`string | number | boolean` 会序列化为查询参数，`null | undefined` 会删除同名参数；设置 `replace: true` 可替换当前历史记录。目标页应从 URL 读取筛选条件，使刷新、复制链接和前进后退保持一致。

A 组件通过定向 channel 调用 B 的功能：

```ts
runtime.channel.publish(twoContract.channels.filterCarrier, {
  carrier: '东驰物流',
});
```

任意插件都可以读取其他插件配置，并通过公共 contract 通道广播。公共订阅必须放在 effect 中并返回取消订阅函数：

```tsx
import { workspaceContract } from '@fms/plugin-contracts';

const twoConfig = workspaceContract.plugins.two;
const threeConfig = workspaceContract.plugins.three;

useEffect(
  () =>
    runtime.channel.subscribePublic(workspaceContract.channels.publicMessage, (payload, context) => {
      console.log(context.fromPluginId, payload.message);
    }),
  [runtime.channel],
);

runtime.channel.publishPublic(workspaceContract.channels.publicMessage, {
  message: `已读取 ${twoConfig.routes.two.path} 和 ${threeConfig.routes.three.path}`,
});
```

约束：

- A 和 B 必须同时安装、注册成功、启用且通过权限过滤，扩展模块和页面入口才会出现。
- B 未声明的 `routeId + slotId` 不能被 A 注入；目标插件缺失或插槽未开放会让 A 注册失败。
- `routeLinks` 的 `parentRoute` 和 `targetRoute` 都使用 `pluginId + routeId`，宿主会校验引用并解析目标真实路径。
- 一个页面只在 `routes` 中声明一个真实地址。`routeLinks` 只贡献入口，不注册别名，因此 `/carrier-ratings` 不会再同时出现 `/reports/carrier-ratings`。
- 页面入口会同时经过入口权限与目标路由权限过滤，不会生成重复的顶部一级菜单。
- `runtime.channel` 是当前页面进程内的内存消息通道，不持久化、不跨标签页，也不替代后端 API。
- `publish` 只发送给目标插件；`publishPublic` 发送给该公共 topic 的所有当前订阅者，包括发送插件自身。
- `subscribe` 和 `subscribePublic` 监听器可以返回 `void | Promise<void>`，必须在 effect 中订阅并返回取消订阅函数；同步抛错和异步 rejection 都会被宿主隔离，不影响其他插件。
- topic 和 payload 类型属于 B 的公共 API。破坏性变更必须升级 B 的主版本，并同步调整 A 的 peer dependency 范围。
- 禁止从 `contract.ts` 导出 `TWO_PLUGIN_ID`、`TWO_ROUTE_ID` 这类运行时散常量；统一从 contract 对象读取。

## 6. 组件与数据查询规范

### 6.1 DTO Schema 与查询契约

插件公开 API 的响应类型必须由能力提供方拥有，并同时提供运行时 Schema。宿主和多个插件共享的数据放在契约包；插件私有接口可放在插件自己的 `contract.ts`。

```ts
import { z } from 'zod';

export const vendorReportsResponseSchema = z.object({
  updatedAt: z.string().min(1),
  rows: z.array(
    z.object({
      id: z.string().min(1),
      carrier: z.string().min(1),
      amount: z.number().nonnegative(),
    }),
  ),
});

export type VendorReportsResponse = z.infer<typeof vendorReportsResponseSchema>;

export const vendorReportsQuery = {
  path: '/api/vendor-reports',
  queryKey: ['vendor', 'reports'] as const,
  schema: vendorReportsResponseSchema,
};
```

不要只声明 TypeScript interface 后直接断言接口结果。`runtime.query` 会把 Schema 解析失败统一转换为查询错误，避免畸形数据进入组件。

### 6.2 使用宿主共享 Query Service

插件组件统一接收 `runtime`，并通过 `usePluginQuery` 订阅宿主 Query Service：

```tsx
import { usePluginQuery, type PluginComponentProps } from '@fms/plugin-sdk';
import { Empty, Result, Spin, Typography } from 'antd';
import { vendorReportsQuery } from './contract';

export default function VendorReportsPage({ runtime }: PluginComponentProps) {
  const reportsQuery = usePluginQuery(runtime.query, {
    queryKey: vendorReportsQuery.queryKey,
    schema: vendorReportsQuery.schema,
    queryFn: ({ signal }) => runtime.api.get<unknown>(vendorReportsQuery.path, { signal }),
  });
  const reports = reportsQuery.data;

  if ((reportsQuery.status === 'idle' || reportsQuery.status === 'loading') && !reports) {
    return <Spin description="正在加载" />;
  }
  if (reportsQuery.status === 'error' && !reports) {
    return <Result status="error" title="加载失败" subTitle={reportsQuery.error?.message} />;
  }
  if (!reports || reports.rows.length === 0) return <Empty description="暂无数据" />;

  return <Typography.Text>共 {reports.rows.length} 条</Typography.Text>;
}
```

Query Service 默认提供跨宿主/插件请求去重、缓存、超时、重试、取消、手动刷新和旧数据保留。相同 query key 必须对应相同 `queryFn` 与 Schema；筛选、排序和分页条件必须进入 query key，并同步到 URL。宿主会按登录用户创建和清理缓存，插件不得在模块顶层建立跨用户缓存。

必须遵守：

- 请求统一使用 `runtime.api`，服务端状态优先通过 `runtime.query` 管理，不得自行读取 token 或绕过统一 401/403 行为。
- 当前 SDK 提供 `get`、`post`、`patch`；新增方法应先升级 SDK 协议。
- 刷新时如果已有成功数据，应继续展示旧数据并给出局部错误提示；首次失败才使用整页 `Result`。
- 使用 `runtime.can(permission)` 控制按钮等细粒度能力。
- API 后端仍需独立校验权限，前端隐藏按钮不是安全边界。
- 插件按业务需要直接使用 Ant Design 的 `Spin`、`Empty`、`Result` 等状态组件，不依赖公共 UI 插件。
- 正常状态保持最小 DOM；页面只为真实布局创建容器，不增加无语义的 Card 包裹。
- 插件组件的懒加载与渲染异常由宿主统一隔离，单个插件失败不会导致 Layout 或其他插件崩溃。
- 订阅 channel、浏览器事件或其他副作用时必须返回清理函数；普通 GET 查询不再手写 effect。
- 不以 `use` 开头命名普通事件函数，所有 Hook 只在组件或自定义 Hook 顶层调用。

## 7. UI 与样式规范

- 表单、按钮、表格、弹窗、反馈、菜单等交互组件使用 Ant Design。
- 页面布局、响应式、间距和少量定制外观使用 Tailwind utility。
- 图标使用 Lucide，避免插件自带一套重复图标系统。
- 不覆盖宿主全局 `body`、`.ant-*` 或通用标签样式。
- 插件必须在 375px、768px、1024px 和 1440px 视口下无页面级横向溢出或内容重叠。
- 表格等宽内容应在自身容器内滚动。

仓库内示例源码已由宿主 Tailwind 入口扫描：

```css
@source '../../../plugins';
```

外部 npm 插件有两种样式交付方式：

1. 推荐由插件发布预编译 CSS，在 `fmsPlugin.style` 声明并通过 package exports 暴露；宿主会自动导入。Tailwind 工具类必须使用插件专属前缀，避免动态样式覆盖宿主或其他插件。
2. 由宿主扫描插件 ESM，例如在 `apps/web/src/styles.css` 添加：

```css
@source '../node_modules/@vendor/fms-plugin-vendor-reports/dist';
```

第二种方式要求宿主重新构建，且插件只能使用静态、完整的 Tailwind class 字符串，禁止运行时拼接 `bg-${color}-500`。

外部插件的 Tailwind 入口示例：

```css
@import 'tailwindcss/theme.css' layer(theme) prefix(vendor);
@import 'tailwindcss/utilities.css' layer(utilities) prefix(vendor);

@source './';
```

JSX 中所有 utility 同步使用前缀，前缀位于响应式或状态 variant 之前：

```tsx
<section className="vendor:grid vendor:grid-cols-1 vendor:gap-3 vendor:lg:grid-cols-2" />
```

即使多个样式文件都写入 `utilities` layer，后加载插件的裸 `.grid-cols-1` 仍可能覆盖宿主较早声明的响应式类，因此不能只依赖 layer 顺序。插件 CSS 还必须避免 preflight、通用标签、`.ant-*` 和 `body` 等全局选择器。

## 8. 仓库内联调

1. 在 `plugins/<plugin-name>` 创建插件包；`pnpm-workspace.yaml` 已包含 `plugins/*`。
2. 在插件 `package.json` 使用 `catalog:` 管理外部依赖，使用 `workspace:*` 引用 SDK 和其他内部插件契约。
3. 运行 `pnpm install`。
4. 在插件包 `package.json` 增加 `fmsPlugin: { "id": "<manifest.id>", "apiVersion": 1 }`。宿主会从应用依赖自动发现插件，不需要修改宿主源码。
5. Mock 插件状态会根据自动发现的插件 ID 生成；只有插件有专属 API 时，才需要新增 handler 和数据。
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

### 9.1 仓库内的独立外部插件示例

`external/three` 是可单独迁出和初始化 Git 的完整插件仓库。它有自己的 `package.json`、`pnpm-workspace.yaml`、`pnpm-lock.yaml`、构建、类型检查、lint、测试和打包检查，不属于根 workspace 的 `apps/*`、`packages/*` 或 `plugins/*`。

宿主 catalog 维护目标发布版本：

```yaml
catalog:
  '@fms-external/plugin-three': 1.0.0
```

由于 pnpm 10 的 catalog 不接受 `link:`，根 `package.json` 使用仅面向本机的 override：

```json
{
  "pnpm": {
    "overrides": {
      "@fms-external/plugin-three": "link:./external/three"
    }
  }
}
```

首次准备：

```bash
pnpm external:setup
pnpm install
```

持续联调可以直接从外部插件仓库启动：

```bash
pnpm dev:host
```

外部仓库的 `fms.dev.json` 配置宿主代码路径、宿主 URL、是否启动宿主以及是否等待 Vite 就绪。`dev:host` 按该配置调用宿主根命令并传递给插件 watcher；插件在开发条件下直接由 Vite 解析 `src/index.ts`，修改页面源码即可在该宿主触发 React Fast Refresh。准备连接远程 Registry 时，删除根 `pnpm.overrides` 中的本地替换并更新 catalog 版本。

Vite 和 Vitest 的 `resolve.dedupe` 应包含 `react`、`react-dom`、`antd`、`@fms/plugin-contracts` 与 `@fms/plugin-sdk`，确保本地链接包和宿主使用同一份运行时依赖。

### 9.2 tgz 联调

推荐使用 tgz 验证真实发布产物，避免 `pnpm link` 引入不同的 React 解析路径。

在插件仓库执行：

```bash
pnpm install
pnpm typecheck
pnpm test
pnpm build
pnpm pack
```

在 FMS 仓库临时安装生成的包：

```bash
pnpm --filter @fms/web add /绝对路径/vendor-fms-plugin-vendor-reports-1.0.0.tgz
```

绝对路径 tgz 只用于本机联调，不提交到共享分支。正式集成时改用 registry 中的不可变版本，并把版本放入 catalog。

然后完成以下宿主改动：

1. 在宿主依赖中安装插件，并确认插件包声明与 manifest 一致的 `fmsPlugin.id` 和 `fmsPlugin.apiVersion: 1`；无需修改源码注册表。
2. 配置插件启停初始数据和权限。
3. 确认插件通过 `fmsPlugin.style` 暴露预编译 CSS，或在 Tailwind 入口添加 `@source`。
4. 重新启动宿主开发服务器。

每次插件变更后重新 `build + pack + add`。需要确认宿主使用了新包时，可运行：

```bash
pnpm --filter @fms/web list @vendor/fms-plugin-vendor-reports
```

本地 link 开发时，插件 package exports 应提供 `development: ./src/index.ts` 并发布 `src`；宿主 Vite 会直接编译源码并触发 Fast Refresh。只有 CSS class 变化需要插件的 Tailwind watcher 更新预编译 CSS。

## 10. 远程联调

### 10.1 私有 npm 预发布版本（推荐）

插件开发方发布唯一的预发布版本，避免多人覆盖同一个版本：

```bash
pnpm build
pnpm test
pnpm publish --tag dev --no-git-checks
```

建议版本包含流水线编号或 commit，例如 `1.1.0-dev.20260730.3`。宿主方在 `pnpm-workspace.yaml` 的 catalog 中登记明确版本：

```yaml
catalog:
  '@vendor/fms-plugin-vendor-reports': 1.1.0-dev.20260730.3
```

在 `apps/web/package.json` 添加 `"@vendor/fms-plugin-vendor-reports": "catalog:"`，然后运行 `pnpm install`。

宿主提交 lockfile 后部署联调环境。不要只依赖可移动的 `dev` tag 判断当前运行版本。

私有 registry 的 token 只放在本机或 CI Secret 中，不提交到仓库。插件包、SDK 和宿主使用同一个 registry scope 配置。

### 10.2 远程 tgz 构建物

CI 可以把 `pnpm pack` 生成的 tgz 上传到带权限和 HTTPS 的制品库。宿主把固定 URL 放入 catalog：

```yaml
catalog:
  '@vendor/fms-plugin-vendor-reports': https://artifacts.example.com/fms/vendor-plugin-1.1.0-dev.3.tgz
```

应用包仍使用 `catalog:` 引用，然后运行 `pnpm install`。每个构建使用不可变 URL；不要覆盖同名 tgz，否则 lockfile integrity 和实际内容会不一致。

### 10.3 共享远程宿主页面

宿主机器安装插件版本后启动：

```bash
pnpm --filter @fms/web dev --host 0.0.0.0 --port 3000
```

通过公司 VPN、受控反向代理或支持 WebSocket 的临时隧道访问。不要把带 Mock 管理员账号的开发服务器直接暴露到公网。

使用真实后端联调时设置 `VITE_ENABLE_MOCKS=false`，并由同源网关或 Vite 代理把 `/api` 转发到测试后端。当前 SDK 使用相对 `/api` 路径，不支持插件自行切换 API Base URL。

## 11. 注册与运行排查

### 插件中心显示“注册失败”

先按插件中心显示的阶段和错误码定位：`discovery` 检查 package 元数据，`load` 检查入口导出或顶层异常，`schema` 检查运行时结构，`compatibility` 检查包/manifest/API 版本，`contribution` 检查路由和插槽，`dependency` 检查必选插件、能力、版本范围和循环。错误插件不会阻止其他插件或宿主启动。

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
- React、Ant Design、SDK 和公共契约包未被打入插件 bundle。
- ESM、动态 chunk 和 `.d.ts` 均包含在 npm 包中。
- `pnpm pack` 后检查 files 清单，不发布源码缓存、测试产物或凭据。
- loading、empty、error、forbidden、offline、ready 和重试行为已覆盖。
- 单个插件加载或渲染失败不会影响 Layout 和其他插件。
- 管理员与普通用户流程均验证，直接路由和直接 API 调用均验证。
- 桌面与移动视口无布局溢出，浏览器控制台无 warning/error。
- 类型检查、lint、测试和生产构建全部通过。
