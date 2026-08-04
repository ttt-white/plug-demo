import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { discoverFmsPlugins, renderInstalledPluginsModule } from './fms-plugin-discovery';

const temporaryRoots: string[] = [];

function createWebRoot() {
  const root = mkdtempSync(join(tmpdir(), 'fms-discovery-'));
  temporaryRoots.push(root);
  return root;
}

function writeJson(path: string, value: unknown) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(value), 'utf8');
}

function writeDependency(webRoot: string, packageName: string, packageJson: unknown) {
  writeJson(join(webRoot, 'node_modules', packageName, 'package.json'), packageJson);
}

afterEach(() => {
  for (const root of temporaryRoots.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe('discoverFmsPlugins', () => {
  it('discovers every marked plugin without hiding incompatible metadata', () => {
    const webRoot = createWebRoot();
    writeJson(join(webRoot, 'package.json'), {
      dependencies: {
        regular: '1.0.0',
        '@fms/plugin-ready': '1.0.0',
        '@fms/plugin-future': '2.0.0',
        '@fms/plugin-malformed': '1.0.0',
      },
    });
    writeDependency(webRoot, 'regular', { name: 'regular', version: '1.0.0' });
    writeDependency(webRoot, '@fms/plugin-ready', {
      name: '@fms/plugin-ready',
      version: '1.0.0',
      fmsPlugin: { id: 'ready', apiVersion: 1, style: './styles.css' },
    });
    writeDependency(webRoot, '@fms/plugin-future', {
      name: '@fms/plugin-future',
      version: '2.0.0',
      fmsPlugin: { id: 'future', apiVersion: 2 },
    });
    writeDependency(webRoot, '@fms/plugin-malformed', {
      name: '@fms/plugin-malformed',
      version: '1.0.0',
      fmsPlugin: true,
    });

    const plugins = discoverFmsPlugins(webRoot);
    expect(plugins.map((plugin) => plugin.packageName)).toEqual([
      '@fms/plugin-future',
      '@fms/plugin-malformed',
      '@fms/plugin-ready',
    ]);
    expect(plugins[0]?.metadata).toMatchObject({ declaredPluginId: 'future', declaredApiVersion: 2 });
    expect(plugins[1]?.diagnostics).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: 'PACKAGE_PLUGIN_METADATA_INVALID', stage: 'discovery' })]),
    );
    expect(plugins[2]).toMatchObject({
      style: '@fms/plugin-ready/styles.css',
      metadata: {
        packageName: '@fms/plugin-ready',
        packageVersion: '1.0.0',
        declaredPluginId: 'ready',
        declaredApiVersion: 1,
      },
    });
  });

  it('renders isolated dynamic loaders instead of eager named imports', () => {
    const source = renderInstalledPluginsModule([
      {
        packageName: '@fms/plugin-ready',
        packageJsonPath: '/tmp/plugin-ready/package.json',
        metadata: {
          packageName: '@fms/plugin-ready',
          packageVersion: '1.0.0',
          declaredPluginId: 'ready',
          declaredApiVersion: 1,
          style: '@fms/plugin-ready/styles.css',
        },
        diagnostics: [],
        style: '@fms/plugin-ready/styles.css',
      },
    ]);

    expect(source).toContain('export const installedPluginDescriptors');
    expect(source).toContain('import("@fms/plugin-ready")');
    expect(source).toContain('import("@fms/plugin-ready/styles.css")');
    expect(source).toContain('.then(([module]) => module.plugin)');
    expect(source).not.toContain('import { plugin');
  });
});
