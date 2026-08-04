# FMS three 外部插件

`three` 是一个独立于 FMS pnpm workspace 的外部插件仓库示例，对应“承运商评级”业务。它只注册一个真实页面 URL `/carrier-ratings`，并通过 `@fms/plugin-contracts` 读取 one、two、three 的共享配置：

- 向 two 的 `two.summary` 插槽贡献一个模块。
- 向 two 页面贡献一个指向 three 页面的类型化入口。
- 通过 two 的类型化 channel 发送承运商筛选条件。
- 通过工作区公共 channel 与当前订阅的 one、two、three 双向广播。

宿主从包内 `fmsPlugin.apiVersion` 自动发现插件，不需要在宿主源码中维护静态 import 清单。

## 环境与命令

- Node.js 24+
- pnpm 10+

```bash
pnpm install
pnpm typecheck
pnpm lint
pnpm test
pnpm build
pnpm pack:check
```

本仓库位于 FMS 根目录的 `external/three`，但有自己的 `pnpm-workspace.yaml` 和 `pnpm-lock.yaml`，不属于根 workspace。开发期的 `devDependencies` 使用 `link:` 连接本机 SDK、公共契约和 two 插件；发布前应替换为团队 Registry 版本。`peerDependencies` 保留 `@fms/plugin-contracts` 与 `@fms/plugin-two` 的兼容范围。

## Contract 规范

`src/contract.ts` 只导出一个运行时对象 `threeContract`，并用 `ThreePluginContract` 显式注解。字段的 TSDoc 会说明插件 ID、路由 ID 和真实 URL，跨插件代码直接引用对象：

```ts
import { twoContract, workspaceContract } from '@fms/plugin-contracts';
import { threeContract } from './contract';

const routeLink = {
  parentRoute: twoContract.routes.two,
  targetRoute: threeContract.routes.three,
};

runtime.channel.publish(twoContract.channels.filterCarrier, { carrier: '东驰物流' });
runtime.channel.publishPublic(workspaceContract.channels.publicMessage, { message: 'three 广播' });
runtime.extensions.navigateTo(threeContract.routes.three);
```

禁止复制 two 的插件 ID、路由 ID、插槽 ID 和 topic 字符串，也不要额外导出零散字符串常量。

## 本机热更新联调

宿主地址配置在 `fms.dev.json`：

```json
{
  "host": {
    "url": "http://localhost:3000",
    "workspaceRoot": "../..",
    "start": true,
    "waitForReady": true
  }
}
```

- `host.url`：目标 FMS 宿主地址；本机启动时也决定 Vite 端口。
- `host.workspaceRoot`：宿主仓库路径，相对于 `external/three`。
- `host.start`：设为 `false` 时只连接已运行的宿主。
- `host.waitForReady`：启动 watcher 前检查宿主的 `/@vite/client`。

在 FMS 根目录完成首次安装：

```bash
pnpm external:setup
pnpm install
```

随后可从外部插件目录启动完整联调环境：

```bash
cd external/three
pnpm dev:host
```

宿主在 Vite 的 `development` condition 下直接解析本包 `src/index.ts`，修改 TSX 后会触发 React Fast Refresh。使用 `admin / admin123` 登录后，顶部菜单的 `three` 打开 `/carrier-ratings`；`two` 页面会显示 three 贡献的模块和入口。

宿主已经运行时执行：

```bash
FMS_START_HOST=false pnpm dev:host
```

符号链接联调时，宿主 Vite/Vitest 的 `resolve.dedupe` 应包含 `react`、`react-dom`、`antd`、`@fms/plugin-contracts` 和 `@fms/plugin-sdk`，保证 React、契约与 SDK 运行时唯一。

## 发布与远程验证

```bash
pnpm build
pnpm pack:check
pnpm publish --tag next
```

本机由根 `package.json` 的 `pnpm.overrides` 将 `@fms-external/plugin-three` 替换为 `link:./external/three`。远程宿主验证时删除该 override，把 catalog 更新为 Registry 中的不可变版本，再执行 `pnpm install` 和构建。该方式仍是构建期静态集成，不是浏览器运行时下载远程代码。
