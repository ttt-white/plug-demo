import { readFileSync, readdirSync, statSync } from 'node:fs';
import { resolve } from 'node:path';

const buildRoot = resolve(process.argv[2] ?? 'apps/web/dist');
const forbidden = ['mock-admin-token', 'admin123', 'viewer123', 'setupWorker', 'mockServiceWorker.js'];
const externalPluginStyle = resolve('external/three/dist/styles.css');

function filesUnder(path) {
  return readdirSync(path).flatMap((entry) => {
    const target = resolve(path, entry);
    return statSync(target).isDirectory() ? filesUnder(target) : [target];
  });
}

const failures = [];
for (const file of filesUnder(buildRoot)) {
  const content = readFileSync(file, 'utf8');
  for (const marker of forbidden) {
    if (content.includes(marker)) failures.push(`${file}: ${marker}`);
  }
}

const externalPluginCss = readFileSync(externalPluginStyle, 'utf8');
if (!externalPluginCss.includes('.three\\:grid{')) {
  failures.push(`${externalPluginStyle}: 缺少 three 命名空间工具类`);
}
if (/(?:^|[,{])\.grid-cols-1\{/.test(externalPluginCss)) {
  failures.push(`${externalPluginStyle}: 包含可能覆盖宿主响应式样式的未命名空间工具类`);
}

if (failures.length > 0) {
  throw new Error(`生产产物包含 Mock 或演示凭证：\n${failures.join('\n')}`);
}

console.log(`生产产物检查通过：${buildRoot}`);
