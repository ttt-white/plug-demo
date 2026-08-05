import { spawn } from 'node:child_process';
import { resolve } from 'node:path';

const forwardedArgs = process.argv.slice(2).filter((argument) => argument !== '--');
const externalRoot = resolve(process.env.FMS_EXTERNAL_PLUGIN_ROOT ?? '../扩展插件/three');
const children = [
  spawn('pnpm', ['--filter', '@fms/web', 'dev', ...forwardedArgs], {
    stdio: 'inherit',
  }),
];
children.push(
  spawn('pnpm', ['--dir', externalRoot, 'dev'], {
    stdio: 'inherit',
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
