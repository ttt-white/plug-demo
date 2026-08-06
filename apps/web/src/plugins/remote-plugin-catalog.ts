import { loadRemote, registerRemotes } from '@module-federation/runtime';
import type { RemotePluginManifest, WorkspacePlugin } from '@tt-plug/plugin-sdk';

export interface RemotePluginConfiguration {
  origin: string;
  manifest: RemotePluginManifest;
}

export interface RemotePluginDefinition {
  configuration: RemotePluginConfiguration;
  id: string;
  origin: string;
  manifestUrl: string;
  remoteName: string;
  entryUrl: string;
  exposedModule: string;
  invalidate(): void;
  load(): Promise<WorkspacePlugin>;
}

function parseHealthInterval(value: string | undefined) {
  const milliseconds = Number(value ?? 5_000);
  if (!Number.isInteger(milliseconds) || milliseconds < 1_000 || milliseconds > 60_000) {
    throw new Error(`远程插件健康检查间隔必须是 1000-60000 毫秒：${value}`);
  }
  return milliseconds;
}

export function normalizeRemotePluginOrigin(value: string) {
  const input = value.trim();
  if (!input) throw new Error('请输入远程插件服务地址');
  const url = new URL(input);
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error(`远程插件地址必须使用 http 或 https：${url.href}`);
  url.hash = '';
  url.search = '';
  url.pathname = url.pathname.replace(/\/fms-plugin\.json\/?$/, '').replace(/\/$/, '');
  return url.href.replace(/\/$/, '');
}

export function createRemotePluginConfiguration(origin: string, manifest: RemotePluginManifest): RemotePluginConfiguration {
  return { origin: normalizeRemotePluginOrigin(origin), manifest };
}

export function remotePluginManifestUrl(origin: string) {
  return `${normalizeRemotePluginOrigin(origin)}/fms-plugin.json`;
}

function remoteEntryUrl(configuration: RemotePluginConfiguration) {
  const entry = new URL(configuration.manifest.remote.entry, `${configuration.origin}/`);
  if (!['http:', 'https:'].includes(entry.protocol)) {
    throw new Error(`远程插件入口必须使用 http 或 https：${entry.href}`);
  }
  return entry.href;
}

const registeredRemoteNames = new Set<string>();

export function createRemotePluginDefinition(configuration: RemotePluginConfiguration): RemotePluginDefinition {
  const { manifest, origin } = configuration;
  const entryUrl = remoteEntryUrl(configuration);
  const exposedModule = manifest.remote.module;
  let loadPromise: Promise<WorkspacePlugin> | null = null;
  let revision = 0;

  function invalidate() {
    if (!loadPromise) return;
    loadPromise = null;
    revision += 1;
  }

  function load() {
    if (loadPromise) return loadPromise;
    const entry = new URL(entryUrl);
    entry.searchParams.set('fms-revision', String(revision));
    const force = revision > 0 || registeredRemoteNames.has(manifest.remote.name);
    registerRemotes(
      [
        {
          name: manifest.remote.name,
          entry: entry.href,
          type: 'module',
          entryGlobalName: manifest.remote.name,
          shareScope: 'default',
        },
      ],
      { force },
    );
    registeredRemoteNames.add(manifest.remote.name);
    const requestId = `${manifest.remote.name}/${exposedModule.replace(/^\.\//, '')}`;
    loadPromise = loadRemote<{ plugin: WorkspacePlugin }>(requestId)
      .then((remote) => {
        if (!remote?.plugin) throw new Error('远程模块没有导出 plugin');
        return remote.plugin;
      })
      .catch((reason: unknown) => {
        loadPromise = null;
        revision += 1;
        throw reason;
      });
    return loadPromise;
  }

  return {
    configuration,
    id: manifest.id,
    origin,
    manifestUrl: remotePluginManifestUrl(origin),
    remoteName: manifest.remote.name,
    entryUrl,
    exposedModule,
    invalidate,
    load,
  };
}

export const remotePluginHealthInterval = parseHealthInterval(import.meta.env['VITE_FMS_PLUGIN_HEALTH_INTERVAL_MS']);
