# 开发入门

## 环境

- Node.js 24+
- pnpm 10+

主体和外部插件是两个独立工程，目录相邻：

```text
插件系统/
  主体/
  扩展插件/three/
```

主体和 three 分别安装依赖，主体不 link 或安装 three。

## 首次安装

```bash
cd 主体
pnpm install
```

然后安装远程插件：

```bash
cd ../扩展插件/three
pnpm install
```

## 开发命令

```bash
pnpm dev          # 仅主体，http://localhost:3000
pnpm dev:host     # 同上
pnpm dev:all      # 主体 + three 远程服务
pnpm external:dev # 仅 three 远程服务
```

推荐分别启动，以便验证健康检查：

```bash
cd 主体
pnpm dev            # http://localhost:3000

cd ../扩展插件/three
pnpm dev             # http://localhost:3100
```

`3100` 同时提供 standalone 页面、健康 manifest 和 Federation 入口。首次启动后，使用管理员账号在插件中心导入 `http://localhost:3100`。主体默认每 5 秒探测一次已导入的远程插件；只有健康检查和注册校验都通过时，three 才参与菜单、路由和插槽解析。

## 管理远程插件

使用管理员账号打开“插件中心”，点击“导入”，输入远程插件服务地址。以下两种形式都支持，路径前缀会被保留：

```text
https://host/plugins/tool
https://host/plugins/tool/fms-plugin.json
```

宿主会读取该地址下的 `fms-plugin.json`，并从 manifest 中取得插件 ID、版本、Federation 容器名、入口文件和暴露模块。插件 ID、服务地址和 Federation 容器名不能与现有配置重复。

远程插件列表中的铅笔按钮用于修改地址；新地址必须返回同一个插件 ID。删除按钮会删除远程配置，并同步移除菜单、路由、插槽贡献和启停状态。顶部“刷新”会重新读取保存的远程配置、启停状态和当前健康状态。

主体不预置任何远程插件，也不通过环境变量注入远程地址；所有远程配置均以插件中心保存的数据为准。

## 验证顺序

使用 `admin / admin123` 登录后：

1. 在插件中心导入 `http://localhost:3100`。
2. 工作台应显示 one 模块和共享 API 状态。
3. two 页面应显示 three 注入的模块。
4. “发送给 two”应更新定向消息文本。
5. “公共广播”应更新公共消息文本。
6. three 页面应能携带参数返回 two。
7. 插件中心停用插件后，对应菜单与路由应消失。
8. 停止 `3100`，5 秒内 three 应保留在插件中心并显示离线，three 菜单、路由和 two 中的 three 模块应消失。
9. 重启 `3100`，上述贡献应自动恢复。
10. 删除 three 后记录及其贡献应消失；再次导入 `http://localhost:3100` 后应恢复。

`viewer / viewer123` 只能访问工作台，用于验证页面与模块权限。

## 质量检查

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm build
```

也可缩小范围：

```bash
pnpm --filter @fms/web test
pnpm --filter @tt-plug/plugin-sdk test
pnpm external:typecheck
pnpm external:test
```

## 常见问题

主体没有 three 菜单：

- 打开 `http://localhost:3100/fms-plugin.json`，确认服务可达。
- 打开 `http://localhost:3100/remoteEntry.js`，确认 Federation 入口可达。
- 在插件中心确认已经导入 three 且保存地址正确。
- 使用管理员账号查看插件中心的注册诊断。

关闭 `3100` 后插件中心仍显示 three：

- 这是预期行为。插件配置与服务健康状态相互独立，服务停止时保留配置并显示“离线”。
- 要彻底移除记录及其贡献，请在插件中心删除 three。

`pnpm dev:all` 找不到 three：

- 默认目录是 `../扩展插件/three`。
- 其他布局可设置 `FMS_EXTERNAL_PLUGIN_ROOT=/absolute/path/to/three`。

端口被占用：

```bash
lsof -nP -iTCP:3000 -sTCP:LISTEN
lsof -nP -iTCP:3100 -sTCP:LISTEN
```
