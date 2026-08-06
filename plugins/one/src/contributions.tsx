import { ExtensionSlot, ModuleRouter } from '@tt-plug/plugin-sdk';
import { oneContract, twoTarget } from './contract';

/**
 * one 的全部贡献声明。
 *
 * 这棵树在 src/index.ts 求值时被 createPluginContributions 收集成静态清单，
 * 不会被渲染——宿主在注册阶段就要拿到 modules / extensionSlots，那时页面还没挂载。
 * 树里只能出现 PageRouter / ModuleRouter / ExtensionSlot，包一层 <div> 会直接抛错。
 * JSX 的嵌套不产生插槽嵌套：嵌套是运行时靠 renderSlot 发生的。
 *
 * 内容用 load 而不是 children：插件入口在注册时就被加载，写成 children 会让
 * 组件代码进入入口 chunk，对所有用户生效；load 保留 tsup --splitting 的分包。
 */
export const contributions = (
  <>
    <ModuleRouter
      load={() => import('./OneModule')}
      moduleId="one.module"
      permission="dashboard:view"
      priority={100}
      target={oneContract.targets.dashboard}
    />

    <ModuleRouter
      load={() => import('./OneTwoModule')}
      moduleId="one.two-demo"
      permission="demo:two:view"
      priority={5}
      target={twoTarget}
    />

    {/* 开在 one.two-demo 模块内部的插槽：routeId 归 two，靠 ownerModuleId 认证。 */}
    <ExtensionSlot
      description="one 注入 two 页面的模块内部再开放的插槽，用于演示跨插件多层嵌套。"
      ownerModuleId="one.two-demo"
      target={oneContract.slots.nested}
    />
  </>
);
