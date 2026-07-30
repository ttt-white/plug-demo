import type { ComponentType } from 'react';
import { describe, expect, it } from 'vitest';
import {
  PLUGIN_API_VERSION,
  sortModuleContributions,
  validatePlugins,
  type PluginComponentProps,
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
