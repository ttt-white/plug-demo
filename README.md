# React Web Template

> 基于 React 19 + TypeScript 5 + Vite + TailwindCSS 4 的现代化前端模板

## 特性

- ⚡️ **Vite 7** - 极速的开发服务器和构建工具 (使用 rolldown-vite)
- ⚛️ **React 19** - 最新的 React 版本
- 📘 **TypeScript 5** - 类型安全
- 🎨 **TailwindCSS 4** - 原子化 CSS 框架
- 📦 **es-toolkit** - 现代化的 JavaScript 工具库
- 🔍 **oxlint + oxfmt** - 基于 Rust 的超快代码检查和格式化工具
- 🎯 **Lefthook** - Git hooks 自动化管理
- 💅 **Prettier + Stylelint** - 代码格式化和样式检查

## 快速开始

### 环境要求

- Node.js >= 24.0.0
- pnpm >= 10.0.0

### 安装依赖

```bash
pnpm install
```

### 开发

```bash
pnpm dev
```

访问 http://localhost:3000

### 构建

```bash
pnpm build
```

### 预览生产构建

```bash
pnpm preview
```

### 代码检查

```bash
# 运行所有检查
pnpm lint

# 类型检查
pnpm tsc --noEmit
```

## 项目结构

```
web/
├── .vscode/          # VS Code 配置
├── public/           # 静态资源
├── src/
│   ├── styles/       # 全局样式
│   ├── App.tsx       # 应用入口组件
│   └── main.tsx      # 应用入口
├── index.html        # HTML 模板
├── vite.config.ts    # Vite 配置
└── package.json      # 项目配置
```

## 可用脚本

| 命令           | 说明           |
| -------------- | -------------- |
| `pnpm dev`     | 启动开发服务器 |
| `pnpm build`   | 构建生产版本   |
| `pnpm preview` | 预览生产构建   |
| `pnpm commit`  | 交互式提交     |

## 环境变量

创建 `.env.local` 文件 (参考 `.env.example`):

```bash
VITE_APP_TITLE=My App
VITE_API_BASE_URL=http://localhost:8080
```

## Git Hooks

项目使用 Lefthook 管理 Git hooks:

- **pre-commit**: 代码格式化、lint、类型检查
- **commit-msg**: 提交信息规范检查
- **post-merge**: 自动运行 pnpm install

## 工具链配置

### TypeScript

- 严格模式已启用
- 额外的安全检查: `noUncheckedIndexedAccess`, `noImplicitReturns` 等

### ESLint + oxlint

- oxlint: 快速的基础检查
- ESLint: React Hooks 和高级规则

### Prettier

- 单引号
- 尾部逗号
- 130 字符行宽

### TailwindCSS

- 原子化 CSS
- 任意值支持
- 自定义主题

## 浏览器支持

- Chrome (最新)
- Firefox (最新)
- Safari (最新)
- Edge (最新)
