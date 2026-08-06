import { PLUGIN_API_VERSION, REMOTE_PLUGIN_MANIFEST_VERSION } from '@tt-plug/plugin-sdk';
import { beforeEach, describe, expect, it } from 'vitest';
import { apiClient, TOKEN_STORAGE_KEY } from '@/services/api-client';
import type { RemotePluginConfiguration } from '@/plugins/remote-plugin-catalog';

function configuration(id: string, remoteName: string, origin = `https://plugins.example.test/${id}`) {
  return {
    origin,
    manifest: {
      schemaVersion: REMOTE_PLUGIN_MANIFEST_VERSION,
      id,
      name: id,
      version: '1.0.0',
      apiVersion: PLUGIN_API_VERSION,
      remote: { name: remoteName, entry: '/remoteEntry.js', module: './plugin' },
    },
  } as const satisfies RemotePluginConfiguration;
}

describe('remote plugin mock API', () => {
  beforeEach(() => sessionStorage.setItem(TOKEN_STORAGE_KEY, 'mock-admin-token'));

  it('starts without a preconfigured remote plugin and allows every authenticated user to read configurations', async () => {
    sessionStorage.setItem(TOKEN_STORAGE_KEY, 'mock-viewer-token');

    await expect(apiClient.get<{ plugins: RemotePluginConfiguration[] }>('/api/remote-plugins')).resolves.toEqual({
      plugins: [],
    });
  });

  it('persists multiple remote configurations through create, update and delete', async () => {
    const alpha = configuration('alpha', 'alpha_remote');
    const beta = configuration('beta', 'beta_remote');
    await apiClient.post('/api/remote-plugins', alpha);
    await apiClient.post('/api/remote-plugins', beta);

    await expect(apiClient.get<{ plugins: RemotePluginConfiguration[] }>('/api/remote-plugins')).resolves.toEqual({
      plugins: expect.arrayContaining([alpha, beta]),
    });

    const movedAlpha = configuration('alpha', 'alpha_remote', 'https://cdn.example.test/alpha');
    await apiClient.put('/api/remote-plugins/alpha', movedAlpha);
    await apiClient.delete('/api/remote-plugins/beta');

    const response = await apiClient.get<{ plugins: RemotePluginConfiguration[] }>('/api/remote-plugins');
    expect(response.plugins).toContainEqual(movedAlpha);
    expect(response.plugins).not.toContainEqual(expect.objectContaining({ manifest: expect.objectContaining({ id: 'beta' }) }));
  });

  it('requires management permission for every remote configuration mutation', async () => {
    sessionStorage.setItem(TOKEN_STORAGE_KEY, 'mock-viewer-token');

    await expect(apiClient.post('/api/remote-plugins', configuration('alpha', 'alpha_remote'))).rejects.toMatchObject({
      status: 403,
    });
    await expect(
      apiClient.put('/api/remote-plugins/three', configuration('three', 'plugin_three', 'http://127.0.0.1:3100')),
    ).rejects.toMatchObject({ status: 403 });
    await expect(apiClient.delete('/api/remote-plugins/three')).rejects.toMatchObject({ status: 403 });
  });

  it('clears a removed plugin state before the same id is imported again', async () => {
    const alpha = configuration('alpha', 'alpha_remote');
    await apiClient.post('/api/remote-plugins', alpha);
    await apiClient.patch('/api/plugins/alpha', { enabled: false });
    await apiClient.delete('/api/remote-plugins/alpha');
    await apiClient.post('/api/remote-plugins', alpha);

    await expect(apiClient.get<{ plugins: Array<{ id: string; enabled: boolean }> }>('/api/plugins')).resolves.toEqual({
      plugins: expect.arrayContaining([{ id: 'alpha', enabled: true }]),
    });
  });

  it('rejects different plugins that reuse a Federation container name', async () => {
    await apiClient.post('/api/remote-plugins', configuration('alpha', 'shared_remote'));

    await expect(apiClient.post('/api/remote-plugins', configuration('beta', 'shared_remote'))).rejects.toMatchObject({
      status: 409,
      message: 'Federation 容器名称已存在：shared_remote',
    });
  });

  it('rejects changing a plugin to another configured Federation container name', async () => {
    await apiClient.post('/api/remote-plugins', configuration('alpha', 'alpha_remote'));
    await apiClient.post('/api/remote-plugins', configuration('beta', 'beta_remote'));

    await expect(
      apiClient.put('/api/remote-plugins/beta', configuration('beta', 'alpha_remote', 'https://plugins.example.test/beta-v2')),
    ).rejects.toMatchObject({ status: 409, message: 'Federation 容器名称已存在：alpha_remote' });
  });
});
