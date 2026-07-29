# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概述

这是一个基于 React 19 + Vite 的现代前端模板项目，使用 TypeScript 开发，采用 Tailwind CSS v4 进行样式管理。

### 技术栈亮点

- **构建工具**: Vite (使用 rolldown-vite 替代默认打包器以获得更快的构建速度)
- **框架**: React 19 + TypeScript
- **样式**: Tailwind CSS v4
- **工具链**:
  - `oxlint`: 超快速的 Rust linter (替代 ESLint 的部分功能)
  - `oxfmt`: Rust 格式化工具
  - `lefthook`: Git hooks 管理
  - `czg`: 交互式 commit 工具 (commitlint 支持)

## 开发命令

```bash
# 开发服务器 (端口 3000)
pnpm dev

# 构建 (TypeScript 编译 + Vite 打包)
pnpm build

# 代码检查
pnpm lint

# 预览生产构建
pnpm preview

# 提交代码 (自动运行 pre-commit hooks + 交互式 commit)
pnpm commit
```

## 代码质量工具链

### Linting 和格式化

项目采用分层工具链，按优先级执行:

1. **oxlint** (.oxlintrc.json): 首选 linter，基于 Rust，速度快
2. **eslint** (eslint.config.js): 补充 oxlint，专注于 React Hooks 和 React Refresh
3. **prettier** (prettier.config.mjs): 代码格式化
   - 单引号
   - 分号
   - 打印宽度 130
   - 尾随逗号 all
   - 自动组织导入 (prettier-plugin-organize-imports)
   - Tailwind CSS 类排序 (prettier-plugin-tailwindcss)
4. **stylelint** (stylelint.config.mjs): CSS/SCSS 样式检查
5. **oxfmt**: 统一格式化工具 (无配置，使用默认设置)

### Git Hooks (lefthook.yml)

Pre-commit hooks 会自动运行:

- Markdown: prettier
- JS/TS/TSX: prettier → oxlint (fix) → eslint (fix)
- CSS/SCSS: prettier → stylelint (fix)
- JSON: prettier
- Package.json: prettier

Commit-msg hook 会通过 commitlint 验证提交信息格式。

### Commit 规范

使用 `pnpm commit` (不是 `git commit`) 会触发 czg 交互式 commit 工具:

支持的提交类型:

- `feat`: 新增功能
- `fix`: 修复缺陷
- `docs`: 文档更新
- `style`: 不影响代码含义的更改 (格式、空格等)
- `refactor`: 既不修复错误也不添加功能的代码更改
- `perf`: 提高性能的代码更改
- `test`: 测试相关
- `build`: 构建系统或外部依赖项更改
- `ci`: CI 配置文件和脚本更改
- `chore`: 不修改 src 或测试文件的其他更改
- `revert`: 还原上一个提交

## 项目结构

```
src/
├── App.tsx          # 根组件
├── main.tsx         # 应用入口
└── styles/          # 样式文件
```

## 路径别名

- `@/*` 映射到 `src/*` (在 vite.config.ts 和 tsconfig.app.json 中配置)

## 编辑器配置

VS Code 用户会自动获得:

- CSS 文件关联为 Tailwind CSS 语法
- 文件嵌套展示 (组件、配置文件自动折叠)
- 保存时自动修复 oxlint 和 stylelint 问题

## 重要注意事项

1. **始终使用 `pnpm commit` 而不是 `git commit`**，以确保代码通过所有检查并遵循 commit 规范
2. **开发时使用 rolldown-vite** 而非标准 Vite，已在 package.json 的 pnpm overrides 中配置
3. **TypeScript 严格模式已启用**，包括 noUnusedLocals、noUnusedParameters 等
4. **使用 es-toolkit 而不是 lodash** 作为工具库
5. **所有样式使用 Tailwind CSS v4**，通过 Vite 插件集成
