import { spawn } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

function readEnvFile(path) {
  if (!existsSync(path)) return {};
  return Object.fromEntries(
    readFileSync(path, 'utf8')
      .split(/\r?\n/)
      .map((line) => line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*?)\s*$/))
      .filter((match) => match)
      .map((match) => [match[1], match[2].replace(/^['"]|['"]$/g, '')]),
  );
}

const env = { ...readEnvFile(resolve(process.cwd(), '.env')), ...process.env };
const configPath = resolve(process.cwd(), env.FMS_DEV_CONFIG ?? 'fms.dev.json');
const config = JSON.parse(readFileSync(configPath, 'utf8'));
const configuredHostUrl = env.FMS_HOST_URL ?? config.host?.url ?? 'http://localhost:3000';
const hostUrl = new URL(configuredHostUrl);
if (!['http:', 'https:'].includes(hostUrl.protocol)) {
  throw new Error(`FMS_HOST_URL 必须使用 http 或 https：${configuredHostUrl}`);
}

const skipHostCheck = process.argv.includes('--skip-host-check') || env.FMS_SKIP_HOST_CHECK === 'true';
const shouldWaitForHost = !skipHostCheck && (config.host?.waitForReady ?? true);
const hostCheckUrl = new URL('/@vite/client', hostUrl);

async function waitForHost() {
  if (!shouldWaitForHost) return;
  const deadline = Date.now() + 30_000;
  let lastError = '未知错误';
  while (Date.now() < deadline) {
    try {
      const response = await fetch(hostCheckUrl);
      if (response.ok) {
        console.log(`[fms-plugin] host ready: ${hostUrl.origin}`);
        return;
      }
      lastError = `HTTP ${response.status}`;
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 250));
  }
  throw new Error(`等待宿主 Vite 超时：${hostUrl.origin}（${lastError}）。可使用 FMS_SKIP_HOST_CHECK=true 仅启动 watcher。`);
}

await waitForHost();

const children = [spawn('pnpm', ['dev:js'], { stdio: 'inherit' }), spawn('pnpm', ['dev:css'], { stdio: 'inherit' })];
let shuttingDown = false;

function stop() {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const child of children) child.kill('SIGTERM');
}

process.once('SIGINT', stop);
process.once('SIGTERM', stop);
for (const child of children) {
  child.once('exit', (code) => {
    if (shuttingDown) return;
    if (code !== 0) process.exitCode = code ?? 1;
    stop();
  });
}
