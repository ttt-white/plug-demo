import type { ComponentType } from 'react';
import { describe, expect, it, vi } from 'vitest';
import {
  PLUGIN_API_VERSION,
  createPluginChannelBus,
  sortModuleContributions,
  validatePlugins,
  type PluginComponentProps,
  type PluginChannelReference,
  type WorkspacePlugin,
} from './index';

const Component = (() => null) as ComponentType<PluginComponentProps>;
const load = async () => ({ default: Component });
const options = {
  reservedPaths: ['/login', '/dashboard', '/plugins'],
  knownSlots: { dashboard: ['dashboard.metrics'] },
};

function createPlugin(id: string): WorkspacePlugin {
  return {
    manifest: { id, name: id, version: '1.0.0', apiVersion: PLUGIN_API_VERSION },
    modules: [{ id: `${id}.module`, routeId: 'dashboard', slotId: 'dashboard.metrics', load }],
  };
}

describe('validatePlugins', () => {
  it('accepts a valid plugin', () => {
    expect(validatePlugins([createPlugin('metrics')], options)[0]?.status).toBe('ready');
  });

  it('rejects unsupported versions, reserved routes and unknown slots', () => {
    const plugin = createPlugin('invalid');
    plugin.manifest.apiVersion = 2 as 1;
    plugin.routes = [{ id: 'login', path: '/login', permission: 'login:view', menu: { label: 'Login', order: 1 }, load }];
    plugin.modules = [{ id: 'unknown', routeId: 'dashboard', slotId: 'dashboard.unknown', load }];

    const result = validatePlugins([plugin], options)[0];
    expect(result?.status).toBe('error');
    expect(result?.errors).toHaveLength(3);
  });

  it('marks every duplicate plugin as invalid', () => {
    const result = validatePlugins([createPlugin('same'), createPlugin('same')], options);
    expect(result.every((registration) => registration.status === 'error')).toBe(true);
  });

  it('rejects duplicate route paths across plugins', () => {
    const first = createPlugin('first');
    const second = createPlugin('second');
    first.routes = [{ id: 'first.route', path: '/same', permission: 'same:view', menu: { label: 'Same', order: 1 }, load }];
    second.routes = [{ id: 'second.route', path: '/same', permission: 'same:view', menu: { label: 'Same', order: 2 }, load }];
    expect(validatePlugins([first, second], options).every((registration) => registration.status === 'error')).toBe(true);
  });

  it('accepts a plugin module and typed route link targeting another plugin', () => {
    const two = createPlugin('two');
    two.routes = [{ id: 'two', path: '/reports', permission: 'reports:view', menu: { label: 'two', order: 1 }, load }];
    two.extensionSlots = [{ id: 'two.summary', routeId: 'two' }];

    const three = createPlugin('three');
    three.modules = [
      {
        id: 'three.summary',
        targetPluginId: 'two',
        routeId: 'two',
        slotId: 'two.summary',
        load,
      },
    ];
    three.routes = [
      {
        id: 'three',
        path: '/carrier-ratings',
        permission: 'carrier-ratings:view',
        menu: { label: 'three', order: 1 },
        load,
      },
    ];
    three.routeLinks = [
      {
        id: 'two.three',
        parentRoute: { pluginId: 'two', routeId: 'two' },
        targetRoute: { pluginId: 'three', routeId: 'three' },
        menu: { label: 'three', order: 1 },
      },
    ];

    expect(validatePlugins([two, three], options).every((registration) => registration.status === 'ready')).toBe(true);
  });

  it('rejects unknown plugin slots and route-link references', () => {
    const two = createPlugin('two');
    two.routes = [{ id: 'two', path: '/reports', permission: 'reports:view', menu: { label: 'two', order: 1 }, load }];
    two.extensionSlots = [{ id: 'two.summary', routeId: 'two' }];

    const three = createPlugin('three');
    three.modules = [
      {
        id: 'three.summary',
        targetPluginId: 'two',
        routeId: 'two',
        slotId: 'two.unknown',
        load,
      },
    ];
    three.routes = [
      {
        id: 'three',
        path: '/carrier-ratings',
        permission: 'carrier-ratings:view',
        menu: { label: 'three', order: 1 },
        load,
      },
    ];
    three.routeLinks = [
      {
        id: 'two.three',
        parentRoute: { pluginId: 'missing-two', routeId: 'two' },
        targetRoute: { pluginId: 'three', routeId: 'missing-route' },
        menu: { label: 'three', order: 1 },
      },
    ];

    const result = validatePlugins([two, three], options)[1];
    expect(result?.status).toBe('error');
    expect(result?.errors).toEqual([
      '父路由不存在或不唯一：missing-two/two',
      '跳转路由不存在或不唯一：three/missing-route',
      '目标插件未开放插槽：two/two/two.unknown',
    ]);
  });

  it('rejects duplicate route-link ids', () => {
    const two = createPlugin('two');
    two.routes = [{ id: 'two', path: '/reports', permission: 'reports:view', menu: { label: 'two', order: 1 }, load }];
    const three = createPlugin('three');
    three.routes = [
      {
        id: 'three',
        path: '/carrier-ratings',
        permission: 'carrier-ratings:view',
        menu: { label: 'three', order: 2 },
        load,
      },
    ];
    const routeLink = {
      id: 'two.three',
      parentRoute: { pluginId: 'two', routeId: 'two' },
      targetRoute: { pluginId: 'three', routeId: 'three' },
      menu: { label: 'three', order: 1 },
    };
    two.routeLinks = [routeLink];
    three.routeLinks = [routeLink];

    expect(validatePlugins([two, three], options).every((registration) => registration.status === 'error')).toBe(true);
  });
});

describe('createPluginChannelBus', () => {
  it('delivers messages only to the target plugin and supports unsubscribe', () => {
    const bus = createPluginChannelBus();
    const twoListener = vi.fn();
    const otherListener = vi.fn();
    const filterCarrier: PluginChannelReference<{ carrier: string }> = {
      pluginId: 'two',
      topic: 'two:filter-carrier',
    };
    const unsubscribe = bus.forPlugin('two').subscribe(filterCarrier, twoListener);
    bus.forPlugin('other-plugin').subscribe('two:filter-carrier', otherListener);

    bus.forPlugin('three').publish(filterCarrier, { carrier: '东驰物流' });
    expect(twoListener).toHaveBeenCalledWith({ carrier: '东驰物流' }, { fromPluginId: 'three' });
    expect(otherListener).not.toHaveBeenCalled();

    unsubscribe();
    bus.forPlugin('three').publish(filterCarrier, { carrier: '北辰货运' });
    expect(twoListener).toHaveBeenCalledOnce();
  });

  it('isolates a failing channel subscriber', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const bus = createPluginChannelBus();
    const healthyListener = vi.fn();
    bus.forPlugin('two').subscribe('refresh', () => {
      throw new Error('broken subscriber');
    });
    bus.forPlugin('two').subscribe('refresh', healthyListener);

    expect(() => bus.forPlugin('three').publish('two', 'refresh', undefined)).not.toThrow();
    expect(healthyListener).toHaveBeenCalledOnce();
    expect(error).toHaveBeenCalledOnce();
  });
});

describe('sortModuleContributions', () => {
  it('sorts by descending priority and then stable id', () => {
    const [base] = createPlugin('base').modules ?? [];
    if (!base) throw new Error('Fixture module is missing');
    const modules = [
      { ...base, id: 'b', priority: 10 },
      { ...base, id: 'c', priority: 20 },
      { ...base, id: 'a', priority: 10 },
    ];
    expect(sortModuleContributions(modules).map((module) => module.id)).toEqual(['c', 'a', 'b']);
  });
});
