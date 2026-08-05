import { PLUGIN_API_VERSION, type RemotePluginManifest, type WorkspacePlugin } from '@fms/plugin-sdk';
import { describe, expect, it, vi } from 'vitest';
import type { RemotePluginDefinition } from './remote-plugin-catalog';
import { discoverRemotePluginConfiguration, inspectRemotePlugin } from './remote-plugin-loader';

const plugin = {
  manifest: { id: 'three', name: 'three', version: '1.0.0', apiVersion: PLUGIN_API_VERSION },
} satisfies WorkspacePlugin;

const manifest = {
  schemaVersion: 1,
  id: 'three',
  name: 'three',
  version: '1.0.0',
  apiVersion: PLUGIN_API_VERSION,
  remote: { name: 'plugin_three', entry: '/remoteEntry.js', module: './plugin' },
} as const satisfies RemotePluginManifest;

const definition: RemotePluginDefinition = {
  configuration: { origin: 'http://localhost:3100', manifest },
  id: 'three',
  origin: 'http://localhost:3100',
  manifestUrl: 'http://localhost:3100/fms-plugin.json',
  remoteName: 'plugin_three',
  entryUrl: 'http://localhost:3100/remoteEntry.js',
  exposedModule: './plugin',
  invalidate: vi.fn(),
  load: async () => plugin,
};

describe('remote plugin inspection', () => {
  it('discovers a configuration from a service address with a path prefix', async () => {
    const fetcher = vi.fn(async () => Response.json(manifest));

    await expect(discoverRemotePluginConfiguration('https://example.test/plugins/three/', fetcher)).resolves.toEqual({
      origin: 'https://example.test/plugins/three',
      manifest,
    });
    expect(fetcher).toHaveBeenCalledWith(
      'https://example.test/plugins/three/fms-plugin.json',
      expect.objectContaining({ cache: 'no-store' }),
    );
  });

  it('rejects an unavailable service during discovery', async () => {
    const fetcher = vi.fn(async () => {
      throw new TypeError('fetch failed');
    });

    await expect(discoverRemotePluginConfiguration('http://localhost:3999', fetcher)).rejects.toThrow('fetch failed');
  });

  it('creates a loadable descriptor after a healthy manifest response', async () => {
    const fetcher = vi.fn(async () => Response.json(manifest));
    const descriptor = await inspectRemotePlugin(definition, fetcher);

    expect(descriptor.metadata).toMatchObject({
      packageName: 'remote:three',
      packageVersion: '1.0.0',
      declaredPluginId: 'three',
      sourceType: 'remote',
      remoteUrl: 'http://localhost:3100',
    });
    expect(descriptor.diagnostics).toEqual([]);
    await expect(descriptor.load()).resolves.toBe(plugin);
  });

  it('keeps an unavailable remote visible as a health diagnostic', async () => {
    const fetcher = vi.fn(async () => {
      throw new TypeError('fetch failed');
    });
    const descriptor = await inspectRemotePlugin(definition, fetcher);

    expect(descriptor.metadata).toMatchObject({ declaredPluginId: 'three', packageVersion: '1.0.0' });
    expect(descriptor.diagnostics).toEqual([
      expect.objectContaining({ code: 'REMOTE_PLUGIN_UNAVAILABLE', stage: 'health', severity: 'error' }),
    ]);
    expect(definition.invalidate).toHaveBeenCalled();
  });

  it('rejects a healthy endpoint that advertises another federation container', async () => {
    const fetcher = vi.fn(async () => Response.json({ ...manifest, remote: { ...manifest.remote, name: 'other' } }));
    const descriptor = await inspectRemotePlugin(definition, fetcher);

    expect(descriptor.diagnostics).toEqual([
      expect.objectContaining({ code: 'REMOTE_PLUGIN_NAME_MISMATCH', stage: 'compatibility' }),
    ]);
    expect(definition.invalidate).toHaveBeenCalled();
  });

  it('rejects a healthy endpoint that advertises another plugin id', async () => {
    const fetcher = vi.fn(async () => Response.json({ ...manifest, id: 'other' }));
    const descriptor = await inspectRemotePlugin(definition, fetcher);

    expect(descriptor.diagnostics).toEqual([
      expect.objectContaining({ code: 'REMOTE_PLUGIN_ID_MISMATCH', stage: 'compatibility' }),
    ]);
    expect(definition.invalidate).toHaveBeenCalled();
  });
});
