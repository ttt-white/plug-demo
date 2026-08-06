import {
  PLUGIN_API_VERSION,
  parseRemotePluginManifest,
  type PluginDiagnostic,
  type PluginPackageDescriptor,
  type PluginPackageMetadata,
  type RemotePluginManifest,
} from '@tt-plug/plugin-sdk';
import type { RemotePluginDefinition } from './remote-plugin-catalog';
import {
  createRemotePluginConfiguration,
  normalizeRemotePluginOrigin,
  remotePluginBaseUrl,
  remotePluginManifestUrl,
  type RemotePluginConfiguration,
} from './remote-plugin-catalog';

const HEALTH_TIMEOUT_MS = 2_000;

function sourceMetadata(definition: RemotePluginDefinition, manifest?: RemotePluginManifest): PluginPackageMetadata {
  return {
    packageName: `remote:${definition.id}`,
    packageVersion: manifest?.version ?? definition.configuration.manifest.version,
    declaredPluginId: manifest?.id ?? definition.id,
    declaredApiVersion: manifest?.apiVersion ?? PLUGIN_API_VERSION,
    sourceType: 'remote',
    remoteUrl: definition.origin,
  };
}

function diagnostic(code: string, stage: PluginDiagnostic['stage'], message: string, path?: string): PluginDiagnostic {
  return { code, stage, severity: 'error', message, ...(path ? { path } : {}) };
}

function errorMessage(reason: unknown) {
  return reason instanceof Error ? reason.message : String(reason);
}

function validateRemoteIdentity(definition: RemotePluginDefinition, manifest: RemotePluginManifest) {
  const diagnostics: PluginDiagnostic[] = [];
  if (manifest.id !== definition.id) {
    diagnostics.push(
      diagnostic(
        'REMOTE_PLUGIN_ID_MISMATCH',
        'compatibility',
        `远程 manifest 的插件 ID 与宿主配置不一致：${manifest.id} != ${definition.id}`,
        'id',
      ),
    );
  }
  if (manifest.remote.name !== definition.remoteName) {
    diagnostics.push(
      diagnostic(
        'REMOTE_PLUGIN_NAME_MISMATCH',
        'compatibility',
        `Federation 容器名称不一致：${manifest.remote.name} != ${definition.remoteName}`,
        'remote.name',
      ),
    );
  }
  if (manifest.remote.module !== definition.exposedModule) {
    diagnostics.push(
      diagnostic(
        'REMOTE_PLUGIN_MODULE_MISMATCH',
        'compatibility',
        `Federation 模块名称不一致：${manifest.remote.module} != ${definition.exposedModule}`,
        'remote.module',
      ),
    );
  }
  const entryUrl = new URL(manifest.remote.entry, `${remotePluginBaseUrl(definition.origin)}/`).href;
  if (entryUrl !== definition.entryUrl) {
    diagnostics.push(
      diagnostic(
        'REMOTE_PLUGIN_ENTRY_MISMATCH',
        'compatibility',
        `Federation 入口地址不一致：${entryUrl} != ${definition.entryUrl}`,
        'remote.entry',
      ),
    );
  }
  return diagnostics;
}

async function fetchManifest(url: string, fetcher: typeof fetch) {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), HEALTH_TIMEOUT_MS);
  try {
    const response = await fetcher(url, {
      cache: 'no-store',
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return parseRemotePluginManifest(await response.json());
  } finally {
    window.clearTimeout(timeout);
  }
}

function fetchManifestFromService(origin: string, fetcher: typeof fetch) {
  return fetchManifest(remotePluginManifestUrl(origin), fetcher);
}

export async function discoverRemotePluginConfiguration(
  serviceAddress: string,
  fetcher: typeof fetch = fetch,
): Promise<RemotePluginConfiguration> {
  const origin = normalizeRemotePluginOrigin(serviceAddress);
  const manifest = await fetchManifestFromService(origin, fetcher);
  return createRemotePluginConfiguration(origin, manifest);
}

export async function inspectRemotePlugin(
  definition: RemotePluginDefinition,
  fetcher: typeof fetch = fetch,
): Promise<PluginPackageDescriptor> {
  let manifest: RemotePluginManifest;
  try {
    manifest = await fetchManifestFromService(definition.origin, fetcher);
  } catch (reason) {
    definition.invalidate();
    return {
      metadata: sourceMetadata(definition),
      diagnostics: [
        diagnostic('REMOTE_PLUGIN_UNAVAILABLE', 'health', `远程插件不可用：${definition.origin}（${errorMessage(reason)}）`),
      ],
      load: definition.load,
    };
  }

  const diagnostics = validateRemoteIdentity(definition, manifest);
  if (diagnostics.some((item) => item.severity === 'error')) definition.invalidate();
  return {
    metadata: sourceMetadata(definition, manifest),
    diagnostics,
    load: definition.load,
  };
}

export function inspectRemotePlugins(
  definitions: readonly RemotePluginDefinition[],
  fetcher: typeof fetch = fetch,
): Promise<PluginPackageDescriptor[]> {
  return Promise.all(definitions.map((definition) => inspectRemotePlugin(definition, fetcher)));
}
