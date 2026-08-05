import { copyFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

const workspaceRoot = process.cwd();
const externalRoot = resolve(process.env.FMS_EXTERNAL_PLUGIN_ROOT ?? '../扩展插件/three');
const snapshots = [
  ['packages/plugin-sdk/dist/index.js', 'vendor/plugin-sdk/index.js'],
  ['packages/plugin-sdk/dist/index.d.ts', 'vendor/plugin-sdk/index.d.ts'],
  ['packages/plugin-contracts/dist/index.js', 'vendor/plugin-contracts/index.js'],
  ['packages/plugin-contracts/dist/index.d.ts', 'vendor/plugin-contracts/index.d.ts'],
];

for (const [source, destination] of snapshots) {
  const target = resolve(externalRoot, destination);
  await mkdir(dirname(target), { recursive: true });
  await copyFile(resolve(workspaceRoot, source), target);
}

console.log(`已同步外部插件 SDK 与 contracts 快照：${externalRoot}`);
