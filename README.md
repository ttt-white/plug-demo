# FMS Plugin Workspace

一个精简的 React 插件基座。仓库只保留插件系统本身需要的能力：自动发现、协议校验、鉴权、启停、页面路由、宿主插槽、插件插槽、插件间导航、定向消息、公共广播和共享查询。

## 运行

要求 Node.js 24+、pnpm 10+。

```bash
pnpm install
pnpm dev
```

主体地址为 [http://localhost:3000](http://localhost:3000)。`pnpm dev` 只启动主体，three 未启动时主体仍可正常使用。

外部 `three` 位于主体仓库同级目录，可独立运行：

```bash
cd ../扩展插件/three
pnpm install
pnpm dev
```

three 地址为 [http://localhost:3100](http://localhost:3100)，同一服务同时提供 standalone 页面、`fms-plugin.json` 和 `remoteEntry.js`。主体每 5 秒检查一次 manifest，仅在服务健康且注册校验通过时加载远程模块。关闭 `3100` 后，three 会显示为离线，其菜单、路由和插槽模块会自动移除；恢复服务后会自动重新注册。

也可以在主体目录执行 `pnpm dev:all` 同时启动两个工程。

演示账号：

| 用户     | 密码        | 权限               |
| -------- | ----------- | ------------------ |
| `admin`  | `admin123`  | 全部插件与插件中心 |
| `viewer` | `viewer123` | 工作台与 one 模块  |

## 演示范围

| 位置     | 演示能力                                                        |
| -------- | --------------------------------------------------------------- |
| 工作台   | 宿主页、共享 query、`PluginSlot`                                |
| one      | 向宿主插槽贡献模块、读取 `runtime.user/can/api/query`、公共消息 |
| two      | 贡献页面路由、接收路由参数与定向消息、公共消息、开放插件插槽    |
| three    | 远程插件、贡献页面入口、向 two 注入模块、类型化导航与消息       |
| 插件中心 | 本地发现、远程健康检查、协议校验、插件启停                      |

在 `two` 页面点击 three 注入模块中的按钮，可以直接观察定向消息和公共广播；进入 `three` 后可携带 query 参数返回 `two`。

## 目录

```text
主体/
  apps/web/                 宿主应用、路由、鉴权和 Mock API
  packages/plugin-sdk/      插件协议、校验、通道和 query 接口
  packages/plugin-contracts/one/two/three 的类型化共享契约
  plugins/one/              宿主插槽模块插件
  plugins/two/              页面与开放插槽插件
扩展插件/three/             可独立运行和发布的外部插件
```

one/two 由宿主 Vite 从 `apps/web/package.json` 的直接依赖中发现。three 不属于主体依赖，由 Module Federation 在浏览器运行时从 `3100` 加载；共享的 React、Ant Design、SDK 和 contracts 使用单例。

## 检查

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm build
```

插件开发与协议示例见 [docs/plugin-development.md](docs/plugin-development.md)，环境和常用流程见 [docs/start.md](docs/start.md)。
