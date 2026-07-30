import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Plugin } from 'vite';

const VIRTUAL_MODULE_ID = 'virtual:fms-installed-plugins';
const RESOLVED_VIRTUAL_MODULE_ID = `\0${VIRTUAL_MODULE_ID}`;

interface PackageJson {
  dependencies?: Record<string, string>;
  fmsPlugin?: {
    apiVersion?: number;
    style?: string;
  };
}

export interface DiscoveredFmsPlugin {
  packageName: string;
  packageJsonPath: string;
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
      const metadata = readPackageJson(packageJsonPath).fmsPlugin;
      if (metadata?.apiVersion !== 1) return [];
      const style = metadata.style?.startsWith('./') ? `${packageName}/${metadata.style.slice(2)}` : metadata.style;
      return [{ packageName, packageJsonPath, ...(style ? { style } : {}) }];
    })
    .sort((left, right) => left.packageName.localeCompare(right.packageName));
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

      const imports = plugins.flatMap((plugin, index) => [
        ...(plugin.style ? [`import ${JSON.stringify(plugin.style)};`] : []),
        `import { plugin as plugin${index} } from ${JSON.stringify(plugin.packageName)};`,
      ]);
      const identifiers = plugins.map((_, index) => `plugin${index}`).join(', ');
      return `${imports.join('\n')}\nexport const installedPlugins = [${identifiers}];\n`;
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
