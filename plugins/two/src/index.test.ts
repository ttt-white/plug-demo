import { PLUGIN_API_VERSION, validatePlugins, type WorkspacePlugin } from '@tt-plug/plugin-sdk';
import { describe, expect, it } from 'vitest';
import { oneNestedTarget, twoContract } from './contract';
import { plugin } from './index';

// 复刻宿主 apps/web/src/app/route-catalog.ts 的边界。
const HOST_VALIDATION_OPTIONS = {
  reservedPaths: ['/login', '/dashboard', '/plugins', '/forbidden'],
  knownSlots: { dashboard: ['dashboard.demo'] },
} as const;

// one 的替身：本地声明，避免 two → one 的包级循环依赖。
// 它把嵌套插槽开在 two 的路由上，靠 ownerModuleId 认证。
const oneStub = {
  manifest: { id: oneNestedTarget.pluginId, name: 'one', version: '1.0.0', apiVersion: PLUGIN_API_VERSION },
  modules: [
    {
      id: 'one.two-demo',
      targetPluginId: twoContract.pluginId,
      routeId: twoContract.slots.demo.routeId,
      slotId: twoContract.slots.demo.slotId,
      load: () => Promise.resolve({ default: () => null }),
    },
  ],
  extensionSlots: [{ id: oneNestedTarget.slotId, routeId: oneNestedTarget.routeId, ownerModuleId: 'one.two-demo' }],
} satisfies WorkspacePlugin;

describe('plugin two', () => {
  it('collects the page route', async () => {
    expect(plugin.routes).toHaveLength(1);
    expect(plugin.routes?.[0]).toMatchObject({
      id: twoContract.routes.page.routeId,
      path: twoContract.routes.page.path,
      permission: 'demo:two:view',
      menu: { label: '页面插件 two', icon: 'blocks', order: 30 },
    });
    await expect(plugin.routes?.[0]?.load()).resolves.toHaveProperty('default');
  });

  it('opens the demo extension slot on its own page', () => {
    expect(plugin.extensionSlots).toHaveLength(1);
    expect(plugin.extensionSlots?.[0]).toEqual({
      id: twoContract.slots.demo.slotId,
      routeId: twoContract.slots.demo.routeId,
      description: '允许其他插件向 two 页面注入演示模块。',
    });
  });

  it('injects a module back into its own page through the slot one opened', async () => {
    expect(plugin.routeLinks).toEqual([]);
    expect(plugin.modules).toHaveLength(1);
    expect(plugin.modules?.[0]).toMatchObject({
      id: 'two.one-nested',
      targetPluginId: oneNestedTarget.pluginId,
      routeId: oneNestedTarget.routeId,
      slotId: oneNestedTarget.slotId,
      permission: 'demo:two:view',
    });
    await expect(plugin.modules?.[0]?.load()).resolves.toHaveProperty('default');
  });

  it('passes host validation together with one, despite the mutual injection', () => {
    // one → two.demo 与 two → one.nested 构成环；两边健康时校验收敛且无诊断。
    const registrations = validatePlugins([plugin, oneStub], HOST_VALIDATION_OPTIONS);
    expect(registrations[0]?.diagnostics.filter((diagnostic) => diagnostic.severity === 'error')).toEqual([]);
    expect(registrations.map((registration) => registration.status)).toEqual(['ready', 'ready']);
  });

  it('fails registration when one is absent, because the cycle breaks both ways', () => {
    const [registration] = validatePlugins([plugin], HOST_VALIDATION_OPTIONS);
    expect(registration?.status).toBe('error');
    expect(registration?.diagnostics.map((diagnostic) => diagnostic.code)).toEqual(
      expect.arrayContaining(['MODULE_TARGET_PLUGIN_INVALID']),
    );
  });
});
