# 开发入门

## 环境

- Node.js 24+
- pnpm 10+

基座和远程插件是相互独立的工程，目录相邻：

```text
插件系统/
  主体/
  five/
```

两者分别安装依赖，主体不 link 也不安装 five。

## 首次安装

```bash
cd 主体
pnpm install
```

然后安装远程插件：

```bash
cd ../five
pnpm install
```

## 开发命令

```bash
pnpm dev # 仅基座，http://localhost:3000
```

推荐分别启动，以便验证健康检查：

```bash
cd 主体
pnpm dev            # http://localhost:3000

cd ../five
pnpm dev            # http://localhost:3400
```

`3400` 同时提供 standalone 页面、健康 manifest 和 Federation 入口。首次启动后，使用管理员账号在插件中心导入 `http://localhost:3400`。主体默认每 5 秒探测一次已导入的远程插件；只有健康检查和注册校验都通过时，five 才参与菜单、路由和插槽解析。

## 管理远程插件

使用管理员账号打开"插件中心"，点击"导入"，输入远程插件服务地址。以下两种形式都支持，路径前缀会被保留：

```text
https://host/plugins/tool
https://host/plugins/tool/plugin.json
```

宿主会读取该地址下的 `plugin.json`，并取得插件 ID、版本、Federation 容器名、入口文件和暴露模块。插件 ID、服务地址和 Federation 容器名不能与现有配置重复。

远程插件列表中的铅笔按钮用于修改地址；新地址必须返回同一个插件 ID。删除按钮会删除远程配置，并同步移除菜单、路由、插槽贡献和启停状态。顶部"刷新"会重新读取保存的远程配置、启停状态和当前健康状态。

主体不预置任何远程插件，也不通过环境变量注入远程地址；所有远程配置均以插件中心保存的数据为准。

## 新增本地插件

1. 在 `plugins/<name>/` 建包，`package.json` 里声明插件元数据：

   ```json
   { "plugin": { "id": "<id>", "apiVersion": 1 } }
   ```

2. 把它加进 `apps/web/package.json` 的 `dependencies`——基座就是靠这份依赖清单发现本地插件的。
3. 建 `packages/plugin-contracts/src/plugins/<id>.ts` 声明该插件的类型化契约。
4. 执行 `pnpm generate:contracts` 重新生成契约包的导出 barrel。

第 3 步缺失时生成器会直接报错并指出要创建的文件路径。

## 验证顺序

使用 `admin / admin123` 登录后：

1. 在插件中心导入 `http://localhost:3400`。
2. 工作台应显示 one 模块和共享 API 状态。
3. `/plugin-two` 应显示 five 通过 `two.demo` 插槽注入的模块。
4. `/plugin-five` 应能正常打开。
5. 插件中心停用插件后，对应菜单与路由应消失。
6. 停止 `3400`，5 秒内 five 应保留在插件中心并显示离线，five 的菜单、路由和 two 中的 five 模块应消失。
7. 重启 `3400`，上述贡献应自动恢复。
8. 删除 five 后记录及其贡献应消失；再次导入 `http://localhost:3400` 后应恢复。

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
pnpm --dir apps/web test
pnpm --filter @tt-plug/plugin-sdk test
pnpm --dir apps/web exec vitest run src/plugins/remote-plugin-loader.test.ts
```

## 常见问题

主体没有 five 菜单：

- 打开 `http://localhost:3400/plugin.json`，确认插件 manifest 可读取。
- 打开 `http://localhost:3400/remoteEntry.js`，确认 Federation 入口可达。
- 在插件中心确认已经导入 five 且保存地址正确。
- 使用管理员账号查看插件中心的注册诊断。

关闭 `3400` 后插件中心仍显示 five：

- 这是预期行为。插件配置与服务健康状态相互独立，服务停止时保留配置并显示"离线"。
- 要彻底移除记录及其贡献，请在插件中心删除 five。

端口被占用：

```bash
lsof -nP -iTCP:3000 -sTCP:LISTEN
lsof -nP -iTCP:3400 -sTCP:LISTEN
```
