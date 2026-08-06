# Repository Guidelines

## 项目结构与模块组织

本仓库是基于 React、TypeScript 和 pnpm workspace 的插件物料管理系统。

- `apps/web/`：Vite 宿主应用，包含路由、鉴权、Mock Service Worker 和应用级测试。
- `packages/plugin-sdk/`：插件协议、类型、校验与排序逻辑。
- `packages/plugin-contracts/`：one、two、three 的共享配置与工作区公共通道契约。
- `plugins/one/`：工作台插槽模块插件示例。
- `plugins/two/`：履约报表整页插件与公共契约示例。
- `apps/web/public/`：宿主开发环境所需的静态资源。

测试文件与被测代码就近放置，命名为 `*.test.ts` 或 `*.test.tsx`。第三方依赖版本统一维护在 `pnpm-workspace.yaml` 的 `catalog` 中，内部包使用 `workspace:*`。

## 构建、测试与本地开发

使用 Node.js 24+、pnpm 10+，并在仓库根目录执行命令。

- `pnpm install`：安装所有 workspace 依赖。
- `pnpm dev`：启动本地宿主，默认地址为 `http://localhost:3000`。
- `pnpm build`：构建所有包、插件和 Web 应用。
- `pnpm typecheck`：执行全仓 TypeScript 类型检查。
- `pnpm lint`：通过 ESLint 和 Oxlint 检查代码。
- `pnpm test`：单次运行全部 Vitest 测试。
- `pnpm --dir apps/web test`：仅运行宿主应用测试。

提交前应执行 `pnpm typecheck`、`pnpm lint`、`pnpm test` 和 `pnpm build`。

## 编码风格与命名约定

使用 2 空格缩进、单引号、分号、尾随逗号和 130 字符行宽。Oxfmt/Prettier 负责格式化，Lefthook 会处理已暂存文件。遵守 TypeScript、React Hooks 和 React Refresh 的 ESLint 规则；有意未使用的参数以 `_` 开头。

React 组件、页面和 Provider 使用 PascalCase，如 `PluginCenterPage.tsx`；函数和变量使用 camelCase，普通文件使用 kebab-case，如 `api-client.ts`。

Tailwind 尺寸必须优先使用间距刻度，不得写 `h-[70px]` 这类任意具体 px 值；应写为 `h-17.5!`。其他宽高、间距和位置值也遵循同样规则，优先复用 Tailwind token。

## 测试规范

测试使用 Vitest、Testing Library、`jest-dom` 和 jsdom。重点覆盖用户流程、权限行为、API 异常处理和插件协议校验。项目未设定覆盖率门槛，但每次行为变更都应增加聚焦的回归测试，Mock 必须可重置且结果稳定。

## 提交与 Pull Request 规范

Commitlint 强制 Conventional Commits，例如 `feat: add report export` 或 `fix(auth): preserve requested route`。允许的类型包括 `feat`、`fix`、`docs`、`refactor`、`test`、`build`、`ci` 和 `chore`；可使用 `pnpm commit` 进入引导流程。

PR 需说明问题、解决方案、受影响的 workspace 和验证命令，并关联相关 issue。UI 变更应附截图；权限、插件 manifest 或配置变更必须显式标注。
