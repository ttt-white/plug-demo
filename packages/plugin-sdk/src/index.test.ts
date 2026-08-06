import type { ComponentType } from 'react';
import { describe, expect, it, vi } from 'vitest';
import {
  PLUGIN_API_VERSION,
  REMOTE_PLUGIN_MANIFEST_VERSION,
  catalogPluginContributions,
  createPluginChannelBus,
  dataContract,
  demoStatusSchema,
  hostContract,
  loadPluginRegistrations,
  parseRemotePluginManifest,
  sortModuleContributions,
  validatePlugins,
  workspaceContract,
  type PluginChannelReference,
  type PluginComponentProps,
  type PluginPackageDescriptor,
  type PluginPublicChannelReference,
  type WorkspacePlugin,
} from './index';

const Component = (() => null) as ComponentType<PluginComponentProps>;
const load = async () => ({ default: Component });
const options = {
  reservedPaths: ['/login', '/dashboard', '/plugins'],
  knownSlots: { dashboard: ['dashboard.demo'] },
};

function createPlugin(id: string): WorkspacePlugin {
  return {
    manifest: { id, name: id, version: '1.0.0', apiVersion: PLUGIN_API_VERSION },
    modules: [{ id: `${id}.module`, routeId: 'dashboard', slotId: 'dashboard.demo', load }],
  };
}

describe('workspace contract', () => {
  it('exposes typed host routes and slots', () => {
    expect(hostContract.routes.dashboard.path).toBe('/dashboard');
    expect(hostContract.slots.dashboard).toEqual({ routeId: 'dashboard', slotId: 'dashboard.demo' });
    expect(workspaceContract.host).toBe(hostContract);
  });

  it('keeps the workspace channel free of plugin specific entries', () => {
    expect(workspaceContract.channels.publicMessage.topic).toBe('workspace:public-message');
    expect(Object.keys(workspaceContract).sort()).toEqual(['channels', 'host']);
  });

  it('validates the only shared API payload', () => {
    expect(demoStatusSchema.safeParse({ message: 'ready', updatedAt: '2026-08-04 10:00' }).success).toBe(true);
    expect(demoStatusSchema.safeParse({ message: '' }).success).toBe(false);
    expect(dataContract.status.queryKey).toEqual(['workspace', 'demo-status']);
  });
});

describe('remote plugin manifest', () => {
  it('accepts the supported remote transport contract', () => {
    expect(
      parseRemotePluginManifest({
        schemaVersion: REMOTE_PLUGIN_MANIFEST_VERSION,
        id: 'sample',
        name: 'sample',
        version: '1.0.0',
        apiVersion: PLUGIN_API_VERSION,
        remote: { name: 'plugin_sample', entry: '/remoteEntry.js', module: './plugin' },
      }),
    ).toMatchObject({ id: 'sample', remote: { name: 'plugin_sample' } });
  });

  it('rejects malformed or incompatible remote manifests', () => {
    expect(() =>
      parseRemotePluginManifest({
        schemaVersion: 2,
        id: '',
        name: 'sample',
        version: '1.0.0',
        apiVersion: PLUGIN_API_VERSION,
        remote: { name: 'plugin_sample', entry: '/remoteEntry.js', module: './plugin' },
      }),
    ).toThrow();
  });
});

describe('catalogPluginContributions', () => {
  it('resolves host and cross-plugin contribution relationships', () => {
    const one = createPlugin('one');
    const two = createPlugin('two');
    two.routes = [{ id: 'two', path: '/plugin-two', permission: 'two:view', menu: { label: 'Two', order: 20 }, load }];
    two.extensionSlots = [{ id: 'two.demo', routeId: 'two', description: 'Two demo slot' }];
    const sample = createPlugin('sample');
    sample.routes = [
      { id: 'sample', path: '/plugin-sample', permission: 'sample:view', menu: { label: 'Sample', order: 30 }, load },
    ];
    sample.routeLinks = [
      {
        id: 'two.sample',
        parentRoute: { pluginId: 'two', routeId: 'two' },
        targetRoute: { pluginId: 'sample', routeId: 'sample' },
        menu: { label: 'Open sample', order: 10 },
      },
    ];
    sample.modules = [{ id: 'sample.two-demo', targetPluginId: 'two', routeId: 'two', slotId: 'two.demo', priority: 20, load }];

    const catalog = catalogPluginContributions([one, two, sample], {
      id: 'host',
      name: 'Host',
      routes: [{ id: 'dashboard', path: '/dashboard', label: 'Dashboard' }],
      extensionSlots: [{ id: 'dashboard.demo', routeId: 'dashboard', description: 'Dashboard demo slot' }],
    });

    expect(catalog.pages).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ provider: expect.objectContaining({ id: 'host' }), routeId: 'dashboard' }),
        expect.objectContaining({ provider: expect.objectContaining({ id: 'two' }), routeId: 'two' }),
      ]),
    );
    expect(catalog.routeLinks[0]).toMatchObject({
      provider: { id: 'sample' },
      parent: { owner: { id: 'two' }, routeId: 'two', path: '/plugin-two' },
      target: { owner: { id: 'sample' }, routeId: 'sample', path: '/plugin-sample' },
    });
    expect(catalog.modules).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'one.module',
          target: expect.objectContaining({
            owner: expect.objectContaining({ id: 'host' }),
            routeId: 'dashboard',
            slotId: 'dashboard.demo',
          }),
        }),
        expect.objectContaining({
          id: 'sample.two-demo',
          target: expect.objectContaining({
            owner: expect.objectContaining({ id: 'two' }),
            routeId: 'two',
            slotId: 'two.demo',
          }),
          priority: 20,
        }),
      ]),
    );
    expect(catalog.slots).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ provider: expect.objectContaining({ id: 'host' }), slotId: 'dashboard.demo' }),
        expect.objectContaining({ provider: expect.objectContaining({ id: 'two' }), slotId: 'two.demo' }),
      ]),
    );
  });
});

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
    two.routes = [{ id: 'two', path: '/plugin-two', permission: 'demo:two:view', menu: { label: 'two', order: 1 }, load }];
    two.extensionSlots = [{ id: 'two.demo', routeId: 'two' }];

    const sample = createPlugin('sample');
    sample.modules = [
      {
        id: 'sample.demo',
        targetPluginId: 'two',
        routeId: 'two',
        slotId: 'two.demo',
        load,
      },
    ];
    sample.routes = [
      {
        id: 'sample',
        path: '/plugin-sample',
        permission: 'demo:sample:view',
        menu: { label: 'sample', order: 1 },
        load,
      },
    ];
    sample.routeLinks = [
      {
        id: 'two.sample',
        parentRoute: { pluginId: 'two', routeId: 'two' },
        targetRoute: { pluginId: 'sample', routeId: 'sample' },
        menu: { label: 'sample', order: 1 },
      },
    ];

    expect(validatePlugins([two, sample], options).every((registration) => registration.status === 'ready')).toBe(true);
  });

  it('rejects unknown plugin slots and route-link references', () => {
    const two = createPlugin('two');
    two.routes = [{ id: 'two', path: '/plugin-two', permission: 'demo:two:view', menu: { label: 'two', order: 1 }, load }];
    two.extensionSlots = [{ id: 'two.demo', routeId: 'two' }];

    const sample = createPlugin('sample');
    sample.modules = [
      {
        id: 'sample.demo',
        targetPluginId: 'two',
        routeId: 'two',
        slotId: 'two.unknown',
        load,
      },
    ];
    sample.routes = [
      {
        id: 'sample',
        path: '/plugin-sample',
        permission: 'demo:sample:view',
        menu: { label: 'sample', order: 1 },
        load,
      },
    ];
    sample.routeLinks = [
      {
        id: 'two.sample',
        parentRoute: { pluginId: 'missing-two', routeId: 'two' },
        targetRoute: { pluginId: 'sample', routeId: 'missing-route' },
        menu: { label: 'sample', order: 1 },
      },
    ];

    const result = validatePlugins([two, sample], options)[1];
    expect(result?.status).toBe('error');
    expect(result?.errors).toEqual([
      '父路由不存在或不唯一：missing-two/two',
      '跳转路由不存在或不唯一：sample/missing-route',
      '目标插件未开放插槽：two/two/two.unknown',
    ]);
  });

  it('rejects duplicate route-link ids', () => {
    const two = createPlugin('two');
    two.routes = [{ id: 'two', path: '/plugin-two', permission: 'demo:two:view', menu: { label: 'two', order: 1 }, load }];
    const sample = createPlugin('sample');
    sample.routes = [
      {
        id: 'sample',
        path: '/plugin-sample',
        permission: 'demo:sample:view',
        menu: { label: 'sample', order: 2 },
        load,
      },
    ];
    const routeLink = {
      id: 'two.sample',
      parentRoute: { pluginId: 'two', routeId: 'two' },
      targetRoute: { pluginId: 'sample', routeId: 'sample' },
      menu: { label: 'sample', order: 1 },
    };
    two.routeLinks = [routeLink];
    sample.routeLinks = [routeLink];

    expect(validatePlugins([two, sample], options).every((registration) => registration.status === 'error')).toBe(true);
  });

  it('returns schema diagnostics instead of throwing for arbitrary runtime values', () => {
    const invalidLoader = createPlugin('invalid-loader') as unknown as Record<string, unknown>;
    invalidLoader['modules'] = [
      { id: 'invalid-loader.module', routeId: 'dashboard', slotId: 'dashboard.demo', load: 'not-a-function' },
    ];

    expect(() => validatePlugins([null, {}, invalidLoader], options)).not.toThrow();
    const registrations = validatePlugins([null, {}, invalidLoader], options);
    expect(registrations).toHaveLength(3);
    expect(registrations.every((registration) => registration.status === 'error')).toBe(true);
    expect(registrations[0]?.diagnostics[0]).toMatchObject({ code: 'PLUGIN_SCHEMA_INVALID', stage: 'schema' });
    expect(registrations[2]?.diagnostics.some((diagnostic) => diagnostic.path === 'modules.0.load')).toBe(true);
  });

  it('validates package and manifest identity consistently', async () => {
    const plugin = createPlugin('identity');
    const registrations = await loadPluginRegistrations(
      [
        {
          metadata: {
            packageName: '@tt-plug/plugin-identity',
            packageVersion: '2.0.0',
            declaredPluginId: 'other-id',
            declaredApiVersion: PLUGIN_API_VERSION,
          },
          load: async () => plugin,
        },
      ],
      options,
    );

    expect(registrations[0]).toMatchObject({ status: 'error', source: { packageName: '@tt-plug/plugin-identity' } });
    expect(registrations[0]?.diagnostics.map((diagnostic) => diagnostic.code)).toEqual(
      expect.arrayContaining(['PACKAGE_PLUGIN_ID_MISMATCH', 'PACKAGE_VERSION_MISMATCH']),
    );
  });

  it('isolates loading, missing exports and incompatible package metadata', async () => {
    const compatibleLoad = vi.fn(async () => createPlugin('ready'));
    const incompatibleLoad = vi.fn(async () => createPlugin('future'));
    const descriptors: PluginPackageDescriptor[] = [
      {
        metadata: {
          packageName: '@tt-plug/plugin-ready',
          packageVersion: '1.0.0',
          declaredPluginId: 'ready',
          declaredApiVersion: PLUGIN_API_VERSION,
        },
        load: compatibleLoad,
      },
      {
        metadata: {
          packageName: '@tt-plug/plugin-broken',
          packageVersion: '1.0.0',
          declaredPluginId: 'broken',
          declaredApiVersion: PLUGIN_API_VERSION,
        },
        load: async () => {
          throw new Error('top-level failed');
        },
      },
      {
        metadata: {
          packageName: '@tt-plug/plugin-missing-export',
          packageVersion: '1.0.0',
          declaredPluginId: 'missing-export',
          declaredApiVersion: PLUGIN_API_VERSION,
        },
        load: async () => undefined,
      },
      {
        metadata: {
          packageName: '@tt-plug/plugin-future',
          packageVersion: '1.0.0',
          declaredPluginId: 'future',
          declaredApiVersion: 2,
        },
        load: incompatibleLoad,
      },
    ];

    const registrations = await loadPluginRegistrations(descriptors, options);
    expect(registrations.map((registration) => registration.source.packageName)).toEqual(
      descriptors.map((descriptor) => descriptor.metadata.packageName),
    );
    expect(registrations.map((registration) => registration.status)).toEqual(['ready', 'error', 'error', 'error']);
    expect(registrations[1]?.diagnostics).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: 'PLUGIN_LOAD_FAILED', stage: 'load' })]),
    );
    expect(registrations[2]?.diagnostics).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: 'PLUGIN_SCHEMA_INVALID', stage: 'schema' })]),
    );
    expect(registrations[3]?.diagnostics).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: 'PACKAGE_API_VERSION_UNSUPPORTED', stage: 'compatibility' })]),
    );
    expect(compatibleLoad).toHaveBeenCalledOnce();
    expect(incompatibleLoad).not.toHaveBeenCalled();
  });

  it('enforces required plugin versions while keeping missing optional plugins as warnings', () => {
    const provider = createPlugin('provider');
    const required = createPlugin('required');
    required.manifest.requires = { plugins: [{ id: 'provider', range: '^2.0.0' }] };
    const optional = createPlugin('optional');
    optional.manifest.requires = { plugins: [{ id: 'missing', range: '^1.0.0', optional: true }] };

    const registrations = validatePlugins([provider, required, optional], options);
    expect(registrations[1]).toMatchObject({ status: 'error' });
    expect(registrations[1]?.diagnostics).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: 'REQUIRED_PLUGIN_VERSION_UNSATISFIED' })]),
    );
    expect(registrations[2]).toMatchObject({ status: 'ready', errors: [] });
    expect(registrations[2]?.diagnostics).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: 'REQUIRED_PLUGIN_MISSING', severity: 'warning' })]),
    );
  });

  it('detects required dependency cycles and propagates an unavailable target', () => {
    const first = createPlugin('first');
    const second = createPlugin('second');
    first.manifest.requires = { plugins: [{ id: 'second', range: '^1.0.0' }] };
    second.manifest.requires = { plugins: [{ id: 'first', range: '^1.0.0' }] };
    const consumer = createPlugin('consumer');
    consumer.manifest.requires = { plugins: [{ id: 'first', range: '^1.0.0' }] };

    const registrations = validatePlugins([first, second, consumer], options);
    expect(registrations[0]?.diagnostics).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: 'PLUGIN_DEPENDENCY_CYCLE' })]),
    );
    expect(registrations[1]?.diagnostics).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: 'PLUGIN_DEPENDENCY_CYCLE' })]),
    );
    expect(registrations[2]?.diagnostics).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: 'REQUIRED_PLUGIN_UNAVAILABLE' })]),
    );
  });

  it('accepts a contract that matches the plugin contributions', () => {
    const two = createPlugin('two');
    two.routes = [{ id: 'two', path: '/plugin-two', permission: 'demo:two:view', menu: { label: 'two', order: 1 }, load }];
    two.extensionSlots = [{ id: 'two.demo', routeId: 'two' }];
    two.contract = {
      pluginId: 'two',
      routes: { page: { path: '/plugin-two', pluginId: 'two', routeId: 'two' } },
      slots: { demo: { pluginId: 'two', routeId: 'two', slotId: 'two.demo' } },
      channels: { message: { pluginId: 'two', topic: 'two:message' } },
    };

    expect(validatePlugins([two], options)[0]?.status).toBe('ready');
  });

  it('rejects a contract that disagrees with the manifest or the contributions', () => {
    const two = createPlugin('two');
    two.routes = [{ id: 'two', path: '/plugin-two', permission: 'demo:two:view', menu: { label: 'two', order: 1 }, load }];
    two.contract = {
      pluginId: 'other',
      routes: { page: { path: '/typo', pluginId: 'two', routeId: 'two' } },
      slots: { demo: { pluginId: 'two', routeId: 'two', slotId: 'two.demo' } },
      channels: { message: { pluginId: 'one', topic: 'one:message' } },
    };

    const result = validatePlugins([two], options)[0];
    expect(result?.status).toBe('error');
    expect(result?.diagnostics.map((diagnostic) => diagnostic.code)).toEqual(
      expect.arrayContaining([
        'PLUGIN_CONTRACT_ID_MISMATCH',
        'PLUGIN_CONTRACT_ROUTE_MISSING',
        'PLUGIN_CONTRACT_SLOT_MISSING',
        'PLUGIN_CONTRACT_CHANNEL_FOREIGN',
      ]),
    );
  });

  it('resolves versioned capabilities and rejects a capability whose provider is invalid', () => {
    const provider = createPlugin('provider');
    provider.manifest.provides = { capabilities: [{ id: 'demo.message', version: '1.1.0' }] };
    const consumer = createPlugin('consumer');
    consumer.manifest.requires = { capabilities: [{ id: 'demo.message', range: '^1.0.0' }] };
    expect(validatePlugins([provider, consumer], options).every((registration) => registration.status === 'ready')).toBe(true);

    provider.routes = [{ id: 'invalid', path: '/login', permission: 'invalid:view', menu: { label: 'Invalid', order: 1 }, load }];
    const registrations = validatePlugins([provider, consumer], options);
    expect(registrations[0]?.status).toBe('error');
    expect(registrations[1]?.diagnostics).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: 'REQUIRED_CAPABILITY_UNAVAILABLE' })]),
    );
  });
});

describe('createPluginChannelBus', () => {
  it('delivers messages only to the target plugin and supports unsubscribe', () => {
    const bus = createPluginChannelBus();
    const twoListener = vi.fn();
    const otherListener = vi.fn();
    const messageChannel: PluginChannelReference<{ message: string }> = {
      pluginId: 'two',
      topic: 'two:message',
    };
    const unsubscribe = bus.forPlugin('two').subscribe(messageChannel, twoListener);
    bus.forPlugin('other-plugin').subscribe('two:message', otherListener);

    bus.forPlugin('sample').publish(messageChannel, { message: 'hello' });
    expect(twoListener).toHaveBeenCalledWith({ message: 'hello' }, { fromPluginId: 'sample' });
    expect(otherListener).not.toHaveBeenCalled();

    unsubscribe();
    bus.forPlugin('sample').publish(messageChannel, { message: 'again' });
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

    expect(() => bus.forPlugin('sample').publish('two', 'refresh', undefined)).not.toThrow();
    expect(healthyListener).toHaveBeenCalledOnce();
    expect(error).toHaveBeenCalledOnce();
    error.mockRestore();
  });

  it('isolates a rejected async channel subscriber without interrupting healthy subscribers', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const bus = createPluginChannelBus();
    const healthyListener = vi.fn();
    bus.forPlugin('two').subscribe('refresh', async () => {
      await Promise.resolve();
      throw new Error('async subscriber failed');
    });
    bus.forPlugin('two').subscribe('refresh', healthyListener);

    bus.forPlugin('sample').publish('two', 'refresh', undefined);
    expect(healthyListener).toHaveBeenCalledOnce();
    await vi.waitFor(() => expect(error).toHaveBeenCalledOnce());
    expect(error).toHaveBeenCalledWith('插件定向通道处理失败：sample -> two/refresh', expect.any(Error));
    error.mockRestore();
  });

  it('broadcasts typed public messages to every subscribed plugin and supports unsubscribe', () => {
    const bus = createPluginChannelBus();
    const oneListener = vi.fn();
    const twoListener = vi.fn();
    const publicMessage: PluginPublicChannelReference<{ message: string }, 'workspace:public-message'> = {
      topic: 'workspace:public-message',
    };
    const unsubscribeOne = bus.forPlugin('one').subscribePublic(publicMessage, oneListener);
    bus.forPlugin('two').subscribePublic(publicMessage, twoListener);

    bus.forPlugin('sample').publishPublic(publicMessage, { message: 'sample 广播' });
    expect(oneListener).toHaveBeenCalledWith({ message: 'sample 广播' }, { fromPluginId: 'sample' });
    expect(twoListener).toHaveBeenCalledWith({ message: 'sample 广播' }, { fromPluginId: 'sample' });

    unsubscribeOne();
    bus.forPlugin('two').publishPublic(publicMessage, { message: 'two 广播' });
    expect(oneListener).toHaveBeenCalledOnce();
    expect(twoListener).toHaveBeenCalledTimes(2);
  });

  it('isolates a failing public channel subscriber', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const bus = createPluginChannelBus();
    const healthyListener = vi.fn();
    const publicMessage: PluginPublicChannelReference<void> = { topic: 'workspace:public-message' };
    bus.forPlugin('one').subscribePublic(publicMessage, () => {
      throw new Error('broken public subscriber');
    });
    bus.forPlugin('two').subscribePublic(publicMessage, healthyListener);

    expect(() => bus.forPlugin('sample').publishPublic(publicMessage, undefined)).not.toThrow();
    expect(healthyListener).toHaveBeenCalledOnce();
    expect(error).toHaveBeenCalledOnce();
    error.mockRestore();
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
