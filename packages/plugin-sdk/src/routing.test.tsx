import { isValidElement, type ComponentType, type FunctionComponent } from 'react';
import { describe, expect, it } from 'vitest';
import type { PluginComponentProps, PluginRuntime } from './index';
import { createPluginContributions, ExtensionSlot, ModuleRouter, PageRouter, PluginRuntimeContext } from './routing';

const runtime = { pluginId: 'demo' } as unknown as PluginRuntime;

function Content() {
  return <p>内容</p>;
}

/** five 没装 jsdom，这里不做真实渲染，只调用函数组件拿到它返回的元素结构。 */
function callComponent(component: ComponentType<PluginComponentProps> | undefined) {
  return (component as FunctionComponent<PluginComponentProps> | undefined)?.({ runtime });
}

describe('createPluginContributions', () => {
  it('把 PageRouter 收集成路由，带 target 时额外产出入口链接', () => {
    const { routes, routeLinks } = createPluginContributions(
      <PageRouter
        menu={{ label: '演示', icon: 'blocks', order: 40 }}
        path="/demo"
        permission="demo:view"
        routeId="demo"
        target={{ pluginId: 'two', routeId: 'two' }}
      >
        <Content />
      </PageRouter>,
      { pluginId: 'demo' },
    );

    expect(routes).toHaveLength(1);
    expect(routes[0]).toMatchObject({
      id: 'demo',
      path: '/demo',
      permission: 'demo:view',
      menu: { label: '演示', icon: 'blocks', order: 40 },
    });
    expect(routeLinks).toHaveLength(1);
    expect(routeLinks[0]).toMatchObject({
      id: 'demo.link.two',
      parentRoute: { pluginId: 'two', routeId: 'two' },
      targetRoute: { pluginId: 'demo', routeId: 'demo' },
      permission: 'demo:view',
      menu: { label: '演示', order: 40 },
    });
  });

  it('没有 target 时不产出入口链接，可选字段被省略而不是写成 undefined', () => {
    const { routes, routeLinks } = createPluginContributions(
      <PageRouter menu={{ label: '演示', order: 40 }} path="/demo" permission="demo:view" routeId="demo">
        <Content />
      </PageRouter>,
      { pluginId: 'demo' },
    );

    expect(routeLinks).toEqual([]);
    expect(routes[0]?.menu).not.toHaveProperty('icon');
  });

  it('把 ModuleRouter 收集成模块，插件插槽带 targetPluginId', () => {
    const { modules } = createPluginContributions(
      <ModuleRouter
        moduleId="demo.two"
        permission="demo:view"
        priority={10}
        target={{ pluginId: 'two', routeId: 'two', slotId: 'two.demo' }}
      >
        <Content />
      </ModuleRouter>,
      { pluginId: 'demo' },
    );

    expect(modules).toHaveLength(1);
    expect(modules[0]).toMatchObject({
      id: 'demo.two',
      routeId: 'two',
      slotId: 'two.demo',
      targetPluginId: 'two',
      permission: 'demo:view',
      priority: 10,
    });
  });

  it('宿主插槽目标不带 pluginId，因此省略 targetPluginId', () => {
    const { modules } = createPluginContributions(
      <ModuleRouter moduleId="demo.host" target={{ routeId: 'dashboard', slotId: 'dashboard.demo' }}>
        <Content />
      </ModuleRouter>,
      { pluginId: 'demo' },
    );

    expect(modules[0]).toMatchObject({ routeId: 'dashboard', slotId: 'dashboard.demo' });
    expect(modules[0]).not.toHaveProperty('targetPluginId');
    expect(modules[0]).not.toHaveProperty('permission');
    expect(modules[0]).not.toHaveProperty('priority');
  });

  it('children 写法产出的组件把内容包进 runtime Provider', async () => {
    const { modules } = createPluginContributions(
      <ModuleRouter moduleId="demo.children" target={{ routeId: 'dashboard', slotId: 'dashboard.demo' }}>
        <Content />
      </ModuleRouter>,
      { pluginId: 'demo' },
    );

    const loaded = await modules[0]?.load();
    expect(loaded?.default).toBeTypeOf('function');

    const element = callComponent(loaded?.default);
    expect(isValidElement(element)).toBe(true);
    expect((element as { type: unknown }).type).toBe(PluginRuntimeContext.Provider);
    expect((element as { props: { value: unknown } }).props.value).toBe(runtime);
  });

  it('load 写法保留懒加载，同样被包进 Provider，且重复调用返回同一个组件', async () => {
    const { modules } = createPluginContributions(
      <ModuleRouter
        load={() => Promise.resolve({ default: Content })}
        moduleId="demo.load"
        target={{ routeId: 'dashboard', slotId: 'dashboard.demo' }}
      />,
      { pluginId: 'demo' },
    );

    const first = await modules[0]?.load();
    const second = await modules[0]?.load();
    expect(first?.default).toBe(second?.default);

    const element = callComponent(first?.default);
    expect((element as { type: unknown }).type).toBe(PluginRuntimeContext.Provider);
    expect((element as { props: { value: unknown } }).props.value).toBe(runtime);
  });

  it('load 加载出来的组件同时收到 runtime prop（用 props 而非 hook 写的插件依赖这点）', async () => {
    // one / two 的组件签名是 ({ runtime }: PluginComponentProps)，只给 Provider 不够。
    function PropsBased({ runtime: injected }: PluginComponentProps) {
      return <p>{injected.pluginId}</p>;
    }
    const { routes } = createPluginContributions(
      <PageRouter
        load={() => Promise.resolve({ default: PropsBased })}
        menu={{ label: '演示', order: 40 }}
        path="/demo"
        permission="demo:view"
        routeId="demo"
      />,
      { pluginId: 'demo' },
    );

    const loaded = await routes[0]?.load();
    const provider = callComponent(loaded?.default) as { props: { children: unknown } };
    const inner = provider.props.children as { type: unknown; props: { runtime: unknown } };
    expect(inner.type).toBe(PropsBased);
    expect(inner.props.runtime).toBe(runtime);
  });

  it('Fragment 与数组透明穿过', () => {
    const { routes, modules } = createPluginContributions(
      <>
        <PageRouter menu={{ label: '演示', order: 40 }} path="/demo" permission="demo:view" routeId="demo">
          <Content />
        </PageRouter>
        <ModuleRouter moduleId="demo.host" target={{ routeId: 'dashboard', slotId: 'dashboard.demo' }}>
          <Content />
        </ModuleRouter>
      </>,
      { pluginId: 'demo' },
    );

    expect(routes).toHaveLength(1);
    expect(modules).toHaveLength(1);
  });

  it('声明树里出现非声明元素时直接抛错', () => {
    expect(() => createPluginContributions(<Content />, { pluginId: 'demo' })).toThrow(/PageRouter \/ ModuleRouter/);
    expect(() => createPluginContributions('文本', { pluginId: 'demo' })).toThrow(/PageRouter \/ ModuleRouter/);
  });

  it('把 ExtensionSlot 收集成开放插槽', () => {
    const { extensionSlots } = createPluginContributions(
      <ExtensionSlot
        description="允许其他插件注入"
        ownerModuleId="demo.module"
        target={{ pluginId: 'demo', routeId: 'demo', slotId: 'demo.extra' }}
      />,
      { pluginId: 'demo' },
    );

    expect(extensionSlots).toHaveLength(1);
    expect(extensionSlots[0]).toEqual({
      id: 'demo.extra',
      routeId: 'demo',
      ownerModuleId: 'demo.module',
      description: '允许其他插件注入',
    });
  });

  it('ExtensionSlot 可以开在宿主路由上，可选字段省略而不是写成 undefined', () => {
    const { extensionSlots } = createPluginContributions(
      <ExtensionSlot target={{ routeId: 'dashboard', slotId: 'dashboard.extra' }} />,
      { pluginId: 'demo' },
    );

    expect(extensionSlots[0]).toEqual({ id: 'dashboard.extra', routeId: 'dashboard' });
  });

  it('ExtensionSlot 声明别人的插槽时直接抛错', () => {
    expect(() =>
      createPluginContributions(<ExtensionSlot target={{ pluginId: 'two', routeId: 'two', slotId: 'two.demo' }} />, {
        pluginId: 'demo',
      }),
    ).toThrow(/只能声明本插件的插槽/);
  });
});
