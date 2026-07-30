# FMS 承运商评级插件

这是一个独立于 FMS pnpm workspace 的整页插件仓库示例。它通过 `@fms/plugin-sdk` 注册 `/carrier-ratings`，使用宿主提供的鉴权 API Client，并输出可由宿主直接引入的 ESM、类型声明和 Tailwind CSS。包内 `fmsPlugin.apiVersion` 标记会让宿主自动发现它，不需要修改宿主源码注册表。

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

本示例放在 FMS 根目录的 `external-repos/` 下，但拥有自己的 `pnpm-workspace.yaml` 和 `pnpm-lock.yaml`，不会成为宿主 workspace 包。为便于 SDK 尚未发布时联调，`devDependencies` 通过 `link:../../packages/plugin-sdk` 和 `link:../../plugins/shared` 获取开发类型；发布前应改成团队 npm Registry 中的实际版本。`peerDependencies` 中的兼容范围必须保留。

## 本机联调

宿主地址配置在仓库根目录的 `fms.dev.json`：

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

- `host.url` 是本机 FMS 宿主的服务地址，端口会用于启动宿主 Vite。
- `host.workspaceRoot` 是宿主代码仓库路径，相对于当前插件仓库；插件迁到其他目录后只需修改这里。
- `host.start` 为 `false` 时，表示宿主已经由其他终端启动，外部仓库只启动 watcher。
- `host.waitForReady` 会在 watcher 启动前检查宿主的 `/@vite/client`，确保 HMR 服务已经可用。
- 本机临时切换地址时可以复制 `.env.example` 为 `.env`，使用 `FMS_HOST_URL`、`FMS_START_HOST` 覆盖配置。

在 FMS 根目录执行一次：

```bash
pnpm external:setup
pnpm install
```

推荐直接从外部插件仓库启动完整联调环境：

```bash
cd external-repos/fms-plugin-carrier-ratings
pnpm dev:host
```

`dev:host` 会先构建插件，再根据 `workspaceRoot` 调用宿主的 `pnpm dev`。宿主读取本仓库的 `fms.dev.json`，按 `host.url` 启动 Vite，并将相同地址传给插件 watcher。插件 watcher 等待宿主 Vite 就绪后启动。使用 `admin / admin123` 登录，在顶部菜单进入“承运商评级”。接口请求通过 `runtime.api` 自动携带 Bearer token。插件在 Vite 开发条件下直接解析 `src/index.ts`，修改 `src/CarrierRatingsPage.tsx` 后由该宿主直接进行 React Fast Refresh；CSS watcher 只负责新增 Tailwind class 的编译。

如果宿主已经在配置地址运行：

```bash
FMS_START_HOST=false pnpm dev:host
```

这会保留对配置地址的 Vite 就绪检查，并只启动外部插件 watcher。

宿主 Vite/Vitest 的 `resolve.dedupe` 必须包含 `react`、`react-dom`、`antd`、`@fms/plugin-sdk` 和 `@fms/plugin-shared`。这是符号链接联调时保持 React Hook 和组件上下文唯一的必要配置。

如果从宿主中移除此本地联调包，只需删除 catalog 条目和 `apps/web/package.json` 依赖，再运行 `pnpm install`；插件注册、样式导入和默认启停状态会随依赖发现结果自动消失。

## 发布与远程宿主验证

```bash
pnpm build
pnpm pack:check
pnpm publish --tag next
```

当前 FMS 宿主的 catalog 保留发布版本，根 `package.json` 通过 `pnpm.overrides` 将其替换为本地 `link:`。远程宿主验证时删除 override，并将 catalog 更新为 Registry 版本（例如 `1.0.0-next.1`），再执行 `pnpm install` 和构建。该方式仍是构建期静态集成，不是浏览器运行时远程加载。
