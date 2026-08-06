import { loadRemote, registerRemotes } from '@module-federation/runtime';
import { PLUGIN_API_VERSION, REMOTE_PLUGIN_MANIFEST_VERSION, type RemotePluginManifest } from '@tt-plug/plugin-sdk';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createRemotePluginConfiguration,
  createRemotePluginDefinition,
  normalizeRemotePluginOrigin,
  remotePluginManifestUrl,
} from './remote-plugin-catalog';

const sampleManifest = {
  schemaVersion: REMOTE_PLUGIN_MANIFEST_VERSION,
  id: 'sample',
  name: 'sample',
  version: '1.0.0',
  apiVersion: PLUGIN_API_VERSION,
  remote: { name: 'plugin_sample', entry: '/remoteEntry.js', module: './plugin' },
} as const satisfies RemotePluginManifest;

describe('remote plugin federation loading', () => {
  beforeEach(() => vi.clearAllMocks());

  it('reuses a healthy module and forces a new entry after invalidation', async () => {
    const definition = createRemotePluginDefinition(createRemotePluginConfiguration('http://localhost:3100', sampleManifest));

    const first = await definition.load();
    const cached = await definition.load();
    expect(cached).toBe(first);
    expect(loadRemote).toHaveBeenCalledTimes(1);
    expect(registerRemotes).toHaveBeenCalledTimes(1);

    const firstRemote = vi.mocked(registerRemotes).mock.calls[0]?.[0][0];
    if (!firstRemote || !('entry' in firstRemote)) throw new Error('第一次注册缺少远程入口');
    const firstEntry = firstRemote.entry;
    definition.invalidate();
    await definition.load();

    expect(loadRemote).toHaveBeenCalledTimes(2);
    expect(registerRemotes).toHaveBeenLastCalledWith(expect.any(Array), { force: true });
    const secondRemote = vi.mocked(registerRemotes).mock.calls[1]?.[0][0];
    if (!secondRemote || !('entry' in secondRemote)) throw new Error('第二次注册缺少远程入口');
    const secondEntry = secondRemote.entry;
    expect(secondEntry).not.toBe(firstEntry);
  });

  it('loads multiple plugins from their own dynamic Federation definitions', async () => {
    const alphaManifest = {
      schemaVersion: REMOTE_PLUGIN_MANIFEST_VERSION,
      id: 'alpha',
      name: 'Alpha',
      version: '1.2.0',
      apiVersion: PLUGIN_API_VERSION,
      remote: { name: 'alpha_remote', entry: './assets/entry.js', module: './bootstrap' },
    } as const satisfies RemotePluginManifest;
    const betaManifest = {
      schemaVersion: REMOTE_PLUGIN_MANIFEST_VERSION,
      id: 'beta',
      name: 'Beta',
      version: '2.0.0',
      apiVersion: PLUGIN_API_VERSION,
      remote: { name: 'beta_remote', entry: '/remoteEntry.mjs', module: './mount' },
    } as const satisfies RemotePluginManifest;
    vi.mocked(loadRemote)
      .mockResolvedValueOnce({ plugin: { manifest: alphaManifest } })
      .mockResolvedValueOnce({ plugin: { manifest: betaManifest } });

    const alpha = createRemotePluginDefinition(
      createRemotePluginConfiguration('https://plugins.example.test/catalog/alpha', alphaManifest),
    );
    const beta = createRemotePluginDefinition(createRemotePluginConfiguration('https://cdn.example.test/beta', betaManifest));
    await Promise.all([alpha.load(), beta.load()]);

    expect(registerRemotes).toHaveBeenCalledWith(
      [
        expect.objectContaining({
          name: 'alpha_remote',
          entry: expect.stringMatching(/^https:\/\/plugins\.example\.test\/catalog\/alpha\/assets\/entry\.js\?/),
          entryGlobalName: 'alpha_remote',
        }),
      ],
      expect.any(Object),
    );
    expect(registerRemotes).toHaveBeenCalledWith(
      [
        expect.objectContaining({
          name: 'beta_remote',
          entry: expect.stringMatching(/^https:\/\/cdn\.example\.test\/remoteEntry\.mjs\?/),
          entryGlobalName: 'beta_remote',
        }),
      ],
      expect.any(Object),
    );
    expect(loadRemote).toHaveBeenCalledWith('alpha_remote/bootstrap');
    expect(loadRemote).toHaveBeenCalledWith('beta_remote/mount');
  });

  it('normalizes a service root or manifest URL while preserving a path prefix', () => {
    expect(normalizeRemotePluginOrigin('https://example.test/plugins/sample/')).toBe('https://example.test/plugins/sample');
    expect(normalizeRemotePluginOrigin('https://example.test/plugins/five/plugin.json')).toBe(
      'https://example.test/plugins/five/plugin.json',
    );
    expect(remotePluginManifestUrl('https://example.test/plugins/five/plugin.json')).toBe(
      'https://example.test/plugins/five/plugin.json',
    );
    expect(remotePluginManifestUrl('https://example.test/plugins/five')).toBe('https://example.test/plugins/five/plugin.json');
  });

  it('resolves a relative remote entry beside a custom manifest URL', () => {
    const definition = createRemotePluginDefinition(
      createRemotePluginConfiguration('https://example.test/plugins/five/plugin.json', {
        ...sampleManifest,
        id: 'five',
        name: 'five',
        remote: { name: 'plugin_five', entry: './remoteEntry.js', module: './plugin' },
      }),
    );

    expect(definition.manifestUrl).toBe('https://example.test/plugins/five/plugin.json');
    expect(definition.entryUrl).toBe('https://example.test/plugins/five/remoteEntry.js');
  });

  it('rejects an empty, malformed or non-http service address', () => {
    expect(() => normalizeRemotePluginOrigin('  ')).toThrow('请输入远程插件服务地址');
    expect(() => normalizeRemotePluginOrigin('not-a-url')).toThrow();
    expect(() => normalizeRemotePluginOrigin('file:///tmp/plugin')).toThrow('远程插件地址必须使用 http 或 https');
  });
});
