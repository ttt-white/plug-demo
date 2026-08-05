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

`3100` 同时提供 standalone 页面、健康 manifest 和 Federation 入口。主体默认每 5 秒探测一次；只有健康检查和注册校验都通过时，three 才参与菜单、路由和插槽解析。

## 验证顺序

使用 `admin / admin123` 登录后：

1. 工作台应显示 one 模块和共享 API 状态。
2. two 页面应显示 three 注入的模块。
3. “发送给 two”应更新定向消息文本。
4. “公共广播”应更新公共消息文本。
5. three 页面应能携带参数返回 two。
6. 插件中心停用插件后，对应菜单与路由应消失。
7. 停止 `3100`，5 秒内 three 应显示离线，three 菜单、路由和 two 中的 three 模块应消失。
8. 重启 `3100`，上述贡献应自动恢复。

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
pnpm --filter @fms/plugin-sdk test
pnpm external:typecheck
pnpm external:test
```

## 常见问题

主体没有 three 菜单：

- 打开 `http://localhost:3100/fms-plugin.json`，确认服务可达。
- 打开 `http://localhost:3100/remoteEntry.js`，确认 Federation 入口可达。
- 确认主体 `.env.development` 的 `VITE_FMS_PLUGIN_THREE_ORIGIN` 与远程地址一致。
- 使用管理员账号查看插件中心的注册诊断。

`pnpm dev:all` 找不到 three：

- 默认目录是 `../扩展插件/three`。
- 其他布局可设置 `FMS_EXTERNAL_PLUGIN_ROOT=/absolute/path/to/three`。

端口被占用：

```bash
lsof -nP -iTCP:3000 -sTCP:LISTEN
lsof -nP -iTCP:3100 -sTCP:LISTEN
```
