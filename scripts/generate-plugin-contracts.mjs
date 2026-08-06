import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(fileURLToPath(new URL('.', import.meta.url)), '..');
const pluginsRoot = resolve(repoRoot, 'plugins');
const contractsRoot = resolve(repoRoot, 'packages/plugin-contracts/src/plugins');
const barrelPath = resolve(contractsRoot, 'index.ts');
const checkOnly = process.argv.includes('--check');

// 插件 ID 的权威来源是 package.json 的 plugin.id，与 apps/web/plugin-discovery.ts 保持一致。
function discoverPluginIds() {
  return readdirSync(pluginsRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .flatMap((entry) => {
      const packageJsonPath = resolve(pluginsRoot, entry.name, 'package.json');
      if (!existsSync(packageJsonPath)) return [];
      const { plugin } = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
      const id = plugin?.id;
      if (typeof id !== 'string' || !id.trim()) {
        throw new Error(`插件缺少 plugin.id：${packageJsonPath}`);
      }
      return [id];
    })
    .sort((left, right) => left.localeCompare(right));
}

function renderBarrel(pluginIds) {
  const exports = pluginIds.map((id) => `export * from './${id}';`).join('\n');
  return `// 由 scripts/generate-plugin-contracts.mjs 依据 plugins/ 目录生成，请勿手改。\n// 重新生成：pnpm generate:contracts\n${exports}\n`;
}

const pluginIds = discoverPluginIds();
const missing = pluginIds.filter((id) => !existsSync(resolve(contractsRoot, `${id}.ts`)));
if (missing.length > 0) {
  throw new Error(
    `以下插件缺少契约声明文件，请先创建：\n${missing.map((id) => `  packages/plugin-contracts/src/plugins/${id}.ts`).join('\n')}`,
  );
}

const expected = renderBarrel(pluginIds);
const actual = existsSync(barrelPath) ? readFileSync(barrelPath, 'utf8') : null;

if (checkOnly) {
  if (actual !== expected) {
    throw new Error('插件契约 barrel 与 plugins/ 目录不一致，请执行 pnpm generate:contracts');
  }
  console.log(`插件契约 barrel 检查通过：${pluginIds.join('、')}`);
} else if (actual === expected) {
  console.log(`插件契约 barrel 无变化：${pluginIds.join('、')}`);
} else {
  writeFileSync(barrelPath, expected);
  console.log(`插件契约 barrel 已生成：${pluginIds.join('、')}`);
}
