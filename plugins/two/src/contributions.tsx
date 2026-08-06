import { ExtensionSlot, ModuleRouter, PageRouter } from '@tt-plug/plugin-sdk';
import { oneNestedTarget, twoContract } from './contract';

/**
 * two 的全部贡献声明。
 *
 * 这棵树在 src/index.ts 求值时被 createPluginContributions 收集成静态清单，
 * 不会被渲染——宿主在注册阶段就要拿到 routes / extensionSlots，那时页面还没挂载。
 *
 * 内容用 load 而不是 children：插件入口在注册时就被加载，写成 children 会让
 * TwoPage 连同 antd 一起进入入口 chunk，对所有用户生效（包括没有 demo:two:view
 * 权限的）；load 保留 tsup --splitting 的分包。
 */
export const contributions = (
  <>
    <PageRouter
      load={() => import('./TwoPage')}
      menu={{ label: '页面插件 two', icon: 'blocks', order: 30 }}
      path={twoContract.routes.page.path}
      permission="demo:two:view"
      routeId={twoContract.routes.page.routeId}
    />

    <ExtensionSlot description="允许其他插件向 two 页面注入演示模块。" target={twoContract.slots.demo} />

    {/* 注入回自己的页面，但隔着 one 的一层模块，演示多层嵌套。 */}
    <ModuleRouter
      load={() => import('./TwoNestedModule')}
      moduleId="two.one-nested"
      permission="demo:two:view"
      priority={10}
      target={oneNestedTarget}
    />
  </>
);
