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

const pluginRoot = process.cwd();
const env = { ...readEnvFile(resolve(pluginRoot, '.env')), ...process.env };
const configPath = resolve(pluginRoot, env.FMS_DEV_CONFIG ?? 'fms.dev.json');
const config = JSON.parse(readFileSync(configPath, 'utf8'));
const workspaceRoot = resolve(pluginRoot, env.FMS_HOST_WORKSPACE_ROOT ?? config.host?.workspaceRoot ?? '../..');

if (!existsSync(resolve(workspaceRoot, 'pnpm-workspace.yaml'))) {
  throw new Error(`未找到 FMS 宿主 workspace：${workspaceRoot}`);
}

const host = spawn('pnpm', ['dev'], {
  cwd: workspaceRoot,
  stdio: 'inherit',
  env: {
    ...env,
    FMS_DEV_CONFIG: configPath,
    FMS_EXTERNAL_PLUGIN_ROOT: pluginRoot,
  },
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.once(signal, () => host.kill(signal));
}
host.once('exit', (code) => {
  process.exitCode = code ?? 1;
});
