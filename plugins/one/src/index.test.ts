import { PLUGIN_API_VERSION, validatePlugins, type WorkspacePlugin } from '@tt-plug/plugin-sdk';
import { describe, expect, it } from 'vitest';
import { oneContract, twoTarget } from './contract';
import { plugin } from './index';

// 复刻宿主 apps/web/src/app/route-catalog.ts 的边界。
const HOST_VALIDATION_OPTIONS = {
  reservedPaths: ['/login', '/dashboard', '/plugins', '/forbidden'],
  knownSlots: { dashboard: ['dashboard.demo'] },
} as const;

// two 的替身：本地声明，避免 one → two 的包级循环依赖。
const twoStub = {
  manifest: { id: twoTarget.pluginId, name: 'two', version: '1.0.0', apiVersion: PLUGIN_API_VERSION },
  routes: [
    {
      id: twoTarget.routeId,
      path: '/plugin-two',
      permission: 'demo:two:view',
      menu: { label: 'two', order: 30 },
      load: () => Promise.resolve({ default: () => null }),
    },
  ],
  extensionSlots: [{ id: twoTarget.slotId, routeId: twoTarget.routeId }],
} satisfies WorkspacePlugin;

describe('plugin one', () => {
  it('keeps the host dashboard module', async () => {
    const dashboardModule = plugin.modules?.find((module) => module.id === 'one.module');
    expect(dashboardModule).toMatchObject({
      routeId: oneContract.targets.dashboard.routeId,
      slotId: oneContract.targets.dashboard.slotId,
      permission: 'dashboard:view',
      priority: 100,
    });
    // 宿主插槽的模块必须不带 targetPluginId，否则会走跨插件分支并找不到目标插件。
    expect(dashboardModule).not.toHaveProperty('targetPluginId');
    await expect(dashboardModule?.load()).resolves.toHaveProperty('default');
  });

  it('injects a module into the two.demo slot', async () => {
    const twoModule = plugin.modules?.find((module) => module.id === 'one.two-demo');
    expect(twoModule).toMatchObject({
      targetPluginId: twoTarget.pluginId,
      routeId: twoTarget.routeId,
      slotId: twoTarget.slotId,
      permission: 'demo:two:view',
    });
    await expect(twoModule?.load()).resolves.toHaveProperty('default');
  });

  it('opens a nested slot inside that module, on a route it does not own', () => {
    expect(plugin.extensionSlots).toHaveLength(1);
    expect(plugin.extensionSlots?.[0]).toMatchObject({
      id: oneContract.slots.nested.slotId,
      // routeId 是 two 的路由，靠 ownerModuleId 才被校验器放行。
      routeId: oneContract.slots.nested.routeId,
      ownerModuleId: 'one.two-demo',
    });
    expect(oneContract.slots.nested.routeId).not.toBe(oneContract.pluginId);
  });

  it('passes host validation together with two', () => {
    const registrations = validatePlugins([plugin, twoStub], HOST_VALIDATION_OPTIONS);
    expect(registrations[0]?.diagnostics.filter((diagnostic) => diagnostic.severity === 'error')).toEqual([]);
    expect(registrations.map((registration) => registration.status)).toEqual(['ready', 'ready']);
  });

  it('fails registration when two is absent, since the nested slot rides on two route', () => {
    const [registration] = validatePlugins([plugin], HOST_VALIDATION_OPTIONS);
    expect(registration?.status).toBe('error');
    expect(registration?.diagnostics.map((diagnostic) => diagnostic.code)).toEqual(
      expect.arrayContaining(['MODULE_TARGET_PLUGIN_INVALID']),
    );
  });
});
