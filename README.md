# 插件物料管理系统

一个基于 React 的插件物料管理系统。**主体**是基座，负责插件的发现、导入、校验、启停、健康检查和运行时加载；其余都是第三方插件或模块。系统同时提供页面路由、宿主插槽、插件插槽、插件间导航、定向消息、公共广播和共享查询等基础能力。

## 运行

要求 Node.js 24+、pnpm 10+。

```bash
pnpm install
pnpm dev
```

主体地址为 [http://localhost:3000](http://localhost:3000)。`pnpm dev` 只启动基座，远程插件未启动时主体仍可正常使用。

远程插件 `five` 位于主体仓库同级目录，独立安装和运行：

```bash
cd ../five
pnpm install
pnpm dev
```

five 地址为 [http://localhost:3400](http://localhost:3400)，同一服务同时提供 standalone 页面、插件 manifest 和 `remoteEntry.js`。启动后使用管理员账号在"插件中心"导入 `http://localhost:3400`。

主体不预置任何远程插件，也不通过环境变量注入远程地址；管理员可以导入任意远程服务、修改地址或删除已有配置。服务地址支持根路径或完整的 `plugin.json` 地址。

主体每 5 秒检查一次各远程插件的 manifest，仅在服务健康且注册校验通过时加载 Module Federation 模块。关闭远程服务后，配置仍保留并显示为"离线"，但菜单、路由和插槽模块会自动移除；恢复服务后会自动重新注册。只有在插件中心删除远程配置后，该插件记录才会消失。

演示账号：

| 用户     | 密码        | 权限               |
| -------- | ----------- | ------------------ |
| `admin`  | `admin123`  | 全部插件与插件中心 |
| `viewer` | `viewer123` | 工作台与 one 模块  |

## 插件形态

系统支持两类插件，走同一套协议和校验：

| 类型     | 发现方式                                            | 示例         |
| -------- | --------------------------------------------------- | ------------ |
| 本地插件 | 主体构建期从 `apps/web` 的直接依赖中读取插件元数据  | `one`、`two` |
| 远程插件 | 运行期读取远程 manifest 后经 Module Federation 加载 | `five`       |

远程插件不属于主体依赖，也不需要与主体同仓库；共享的 React、Ant Design、SDK 和 contracts 使用单例。

## 演示范围

| 位置     | 演示能力                                                        |
| -------- | --------------------------------------------------------------- |
| 工作台   | 宿主页、共享 query、`PluginSlot`                                |
| one      | 向宿主插槽贡献模块、读取 `runtime.user/can/api/query`、公共消息 |
| two      | 贡献页面路由、接收路由参数与定向消息、公共消息、开放插件插槽    |
| five     | 远程插件、贡献页面、向 two 的插槽注入模块                       |
| 插件中心 | 本地发现、远程插件导入与改址、健康检查、协议校验、插件启停      |

进入 `/plugin-two` 可以看到 five 通过 `two.demo` 插槽注入的模块。

## 目录

```text
主体/
  apps/web/                  基座应用、路由、鉴权和 Mock API
  packages/plugin-sdk/       插件协议、校验、通道和 query 接口
  packages/plugin-contracts/ 宿主与本地插件的类型化共享契约
  plugins/one/               宿主插槽模块插件
  plugins/two/               页面与开放插槽插件
five/                        可独立运行和发布的远程插件
```

## 检查

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm build
```

新增本地插件时，先建 `packages/plugin-contracts/src/plugins/<id>.ts`，再执行 `pnpm generate:contracts` 重新生成契约包的导出。

插件开发与协议示例见 [docs/plugin-development.md](docs/plugin-development.md)，环境和常用流程见 [docs/start.md](docs/start.md)。
