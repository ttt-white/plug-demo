import type { PluginDiagnostic, PluginPackageMetadata } from '@tt-plug/plugin-sdk';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Plugin } from 'vite';

const VIRTUAL_MODULE_ID = 'virtual:fms-installed-plugins';
const RESOLVED_VIRTUAL_MODULE_ID = `\0${VIRTUAL_MODULE_ID}`;

interface PackageJson {
  dependencies?: Record<string, string>;
  version?: unknown;
  fmsPlugin?: unknown;
}

interface DiscoveredFmsPlugin {
  packageName: string;
  packageJsonPath: string;
  metadata: PluginPackageMetadata;
  diagnostics: PluginDiagnostic[];
  style?: string;
}

function readPackageJson(path: string): PackageJson {
  return JSON.parse(readFileSync(path, 'utf8')) as PackageJson;
}

export function discoverFmsPlugins(webRoot: string): DiscoveredFmsPlugin[] {
  const hostPackageJsonPath = resolve(webRoot, 'package.json');
  const dependencies = readPackageJson(hostPackageJsonPath).dependencies ?? {};

  return Object.keys(dependencies)
    .flatMap((packageName) => {
      const packageJsonPath = resolve(webRoot, 'node_modules', packageName, 'package.json');
      if (!existsSync(packageJsonPath)) return [];
      const packageJson = readPackageJson(packageJsonPath);
      if (packageJson.fmsPlugin === undefined) return [];

      const diagnostics: PluginDiagnostic[] = [];
      const metadataObject =
        typeof packageJson.fmsPlugin === 'object' && packageJson.fmsPlugin !== null
          ? (packageJson.fmsPlugin as Record<string, unknown>)
          : null;
      if (!metadataObject) {
        diagnostics.push({
          code: 'PACKAGE_PLUGIN_METADATA_INVALID',
          stage: 'discovery',
          severity: 'error',
          message: 'package.json 的 fmsPlugin 必须是对象',
          path: 'fmsPlugin',
        });
      }

      const rawStyle = metadataObject?.['style'];
      if (rawStyle !== undefined && typeof rawStyle !== 'string') {
        diagnostics.push({
          code: 'PACKAGE_PLUGIN_STYLE_INVALID',
          stage: 'discovery',
          severity: 'error',
          message: 'fmsPlugin.style 必须是字符串',
          path: 'fmsPlugin.style',
        });
      }
      const style =
        typeof rawStyle === 'string' ? (rawStyle.startsWith('./') ? `${packageName}/${rawStyle.slice(2)}` : rawStyle) : undefined;
      const metadata: PluginPackageMetadata = {
        packageName,
        packageVersion: typeof packageJson.version === 'string' ? packageJson.version : 'unknown',
        declaredPluginId: metadataObject?.['id'],
        declaredApiVersion: metadataObject?.['apiVersion'],
        ...(style ? { style } : {}),
      };
      return [{ packageName, packageJsonPath, metadata, diagnostics, ...(style ? { style } : {}) }];
    })
    .sort((left, right) => left.packageName.localeCompare(right.packageName));
}

export function renderInstalledPluginsModule(plugins: readonly DiscoveredFmsPlugin[]) {
  const descriptors = plugins.map((plugin) => {
    const imports = [
      `import(${JSON.stringify(plugin.packageName)})`,
      ...(plugin.style ? [`import(${JSON.stringify(plugin.style)})`] : []),
    ];
    return `{
      metadata: ${JSON.stringify(plugin.metadata)},
      diagnostics: ${JSON.stringify(plugin.diagnostics)},
      load: () => Promise.all([${imports.join(', ')}]).then(([module]) => module.plugin),
    }`;
  });
  return `export const installedPluginDescriptors = [${descriptors.join(',\n')}];\n`;
}

export function fmsPluginDiscovery(webRoot: string): Plugin {
  const hostPackageJsonPath = resolve(webRoot, 'package.json');

  return {
    name: 'fms-plugin-discovery',
    enforce: 'pre',
    resolveId(id) {
      return id === VIRTUAL_MODULE_ID ? RESOLVED_VIRTUAL_MODULE_ID : undefined;
    },
    load(id) {
      if (id !== RESOLVED_VIRTUAL_MODULE_ID) return undefined;
      const plugins = discoverFmsPlugins(webRoot);
      this.addWatchFile(hostPackageJsonPath);
      for (const plugin of plugins) this.addWatchFile(plugin.packageJsonPath);

      return renderInstalledPluginsModule(plugins);
    },
    handleHotUpdate({ file, server }) {
      const watchedPackageJsonFiles = new Set([
        hostPackageJsonPath,
        ...discoverFmsPlugins(webRoot).map((plugin) => plugin.packageJsonPath),
      ]);
      if (!watchedPackageJsonFiles.has(file)) return;
      const virtualModule = server.moduleGraph.getModuleById(RESOLVED_VIRTUAL_MODULE_ID);
      if (virtualModule) server.moduleGraph.invalidateModule(virtualModule);
      server.ws.send({ type: 'full-reload' });
      return [];
    },
  };
}
