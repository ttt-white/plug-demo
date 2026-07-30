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

const forwardedArgs = process.argv.slice(2).filter((argument) => argument !== '--');
const externalRoot = resolve(process.env.FMS_EXTERNAL_PLUGIN_ROOT ?? 'external-repos/fms-plugin-carrier-ratings');
const env = { ...readEnvFile(resolve(externalRoot, '.env')), ...process.env };
const configPath = resolve(externalRoot, env.FMS_DEV_CONFIG ?? 'fms.dev.json');
const config = JSON.parse(readFileSync(configPath, 'utf8'));
const hostUrl = new URL(env.FMS_HOST_URL ?? config.host?.url ?? 'http://localhost:3000');
if (!['http:', 'https:'].includes(hostUrl.protocol)) {
  throw new Error(`FMS_HOST_URL 必须使用 http 或 https：${hostUrl.href}`);
}
const startHost = env.FMS_START_HOST === undefined ? (config.host?.start ?? true) : env.FMS_START_HOST === 'true';
if (startHost && !hostUrl.port) throw new Error(`启动本机宿主时，host.url 必须包含端口：${hostUrl.href}`);
if (forwardedArgs.some((argument) => argument === '--port' || argument.startsWith('--port='))) {
  throw new Error('宿主端口由外部插件的 fms.dev.json 或 FMS_HOST_URL 管理，请不要额外传入 --port。');
}
const configuredPort = hostUrl.port;
const hostArgs = [...forwardedArgs, ...(configuredPort ? ['--port', configuredPort] : []), '--strictPort'];
const children = [];
if (startHost) {
  children.push(
    spawn('pnpm', ['--filter', '@fms/web', 'dev', ...hostArgs], {
      stdio: 'inherit',
    }),
  );
}
children.push(
  spawn('pnpm', ['--dir', externalRoot, 'dev'], {
    stdio: 'inherit',
    env: { ...env, FMS_HOST_URL: hostUrl.origin },
  }),
);
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
