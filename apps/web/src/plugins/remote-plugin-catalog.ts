import { loadRemote, registerRemotes } from '@module-federation/runtime';
import { PLUGIN_API_VERSION, type WorkspacePlugin } from '@fms/plugin-sdk';

export interface RemotePluginDefinition {
  id: string;
  origin: string;
  manifestUrl: string;
  remoteName: string;
  entryUrl: string;
  exposedModule: string;
  invalidate(): void;
  load(): Promise<WorkspacePlugin>;
}

function parseRemoteOrigin(value: string | undefined) {
  const url = new URL(value?.trim() || 'http://localhost:3100');
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error(`远程插件地址必须使用 http 或 https：${url.href}`);
  return url.origin;
}

function parseHealthInterval(value: string | undefined) {
  const milliseconds = Number(value ?? 5_000);
  if (!Number.isInteger(milliseconds) || milliseconds < 1_000 || milliseconds > 60_000) {
    throw new Error(`远程插件健康检查间隔必须是 1000-60000 毫秒：${value}`);
  }
  return milliseconds;
}

export const remotePluginHealthInterval = parseHealthInterval(import.meta.env['VITE_FMS_PLUGIN_HEALTH_INTERVAL_MS']);

const threeOrigin = parseRemoteOrigin(import.meta.env['VITE_FMS_PLUGIN_THREE_ORIGIN']);
const threeEntryUrl = `${threeOrigin}/remoteEntry.js`;
let threeLoadPromise: Promise<WorkspacePlugin> | null = null;
let threeRemoteRevision = 0;

function invalidateThree() {
  if (!threeLoadPromise) return;
  threeLoadPromise = null;
  threeRemoteRevision += 1;
}

function loadThree() {
  if (threeLoadPromise) return threeLoadPromise;
  const entry = new URL(threeEntryUrl);
  entry.searchParams.set('fms-revision', String(threeRemoteRevision));
  registerRemotes(
    [
      {
        name: 'plugin_three',
        entry: entry.href,
        type: 'module',
        entryGlobalName: 'plugin_three',
        shareScope: 'default',
      },
    ],
    { force: threeRemoteRevision > 0 },
  );
  threeLoadPromise = loadRemote<{ plugin: WorkspacePlugin }>('plugin_three/plugin')
    .then((remote) => {
      if (!remote?.plugin) throw new Error('远程模块没有导出 plugin');
      return remote.plugin;
    })
    .catch((reason: unknown) => {
      threeLoadPromise = null;
      threeRemoteRevision += 1;
      throw reason;
    });
  return threeLoadPromise;
}

export const remotePluginDefinitions: readonly RemotePluginDefinition[] = [
  {
    id: 'three',
    origin: threeOrigin,
    manifestUrl: `${threeOrigin}/fms-plugin.json`,
    remoteName: 'plugin_three',
    entryUrl: threeEntryUrl,
    exposedModule: './plugin',
    invalidate: invalidateThree,
    load: loadThree,
  },
];

export const configuredPluginIds = ['one', 'two', ...remotePluginDefinitions.map(({ id }) => id)] satisfies readonly string[];

export const remotePluginManifestFixture = {
  schemaVersion: 1,
  id: 'three',
  name: 'three',
  version: '1.0.0',
  apiVersion: PLUGIN_API_VERSION,
  remote: { name: 'plugin_three', entry: '/remoteEntry.js', module: './plugin' },
} as const;
