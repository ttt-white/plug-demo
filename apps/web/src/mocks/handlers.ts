import { createRemotePluginConfiguration, type RemotePluginConfiguration } from '@/plugins/remote-plugin-catalog';
import { parseRemotePluginManifest } from '@tt-plug/plugin-sdk';
import { delay, http, HttpResponse } from 'msw';
import { installedPluginDescriptors } from 'virtual:fms-installed-plugins';
import {
  demoStatus,
  mockAccounts,
  readPluginStates,
  readRemotePluginConfigurations,
  removePluginState,
  writePluginState,
  writeRemotePluginConfigurations,
} from './data';

const mockDelay = import.meta.env.MODE === 'test' ? async (_milliseconds: number) => undefined : delay;
const discoveredPluginIds = installedPluginDescriptors.flatMap(({ metadata }) =>
  typeof metadata.declaredPluginId === 'string' ? [metadata.declaredPluginId] : [],
);

function configuredPluginIds() {
  return [...discoveredPluginIds, ...readRemotePluginConfigurations().map(({ manifest }) => manifest.id)];
}

async function readRemoteConfiguration(request: Request) {
  const body = (await request.json()) as Partial<RemotePluginConfiguration>;
  if (typeof body.origin !== 'string') throw new Error('origin 必须是字符串');
  return createRemotePluginConfiguration(body.origin, parseRemotePluginManifest(body.manifest));
}

function authenticate(request: Request, permission?: string) {
  const token = request.headers.get('Authorization')?.replace(/^Bearer\s+/i, '');
  const account = Object.values(mockAccounts).find((candidate) => candidate.token === token);
  if (!account) return { error: HttpResponse.json({ message: '登录状态已失效' }, { status: 401 }) };
  if (permission && !account.user.permissions.includes('*') && !account.user.permissions.includes(permission)) {
    return { error: HttpResponse.json({ message: '没有执行此操作的权限' }, { status: 403 }) };
  }
  return { user: account.user };
}

export const handlers = [
  http.post('/api/auth/login', async ({ request }) => {
    await mockDelay(120);
    const body = (await request.json()) as { username?: string; password?: string };
    const account = body.username ? mockAccounts[body.username] : undefined;
    if (!account || account.password !== body.password) {
      return HttpResponse.json({ message: '用户名或密码错误' }, { status: 401 });
    }
    return HttpResponse.json({ token: account.token, user: account.user });
  }),
  http.get('/api/auth/me', ({ request }) => {
    const auth = authenticate(request);
    return auth.error ?? HttpResponse.json({ user: auth.user });
  }),
  http.get('/api/demo-status', ({ request }) => {
    const auth = authenticate(request, 'dashboard:view');
    return auth.error ?? HttpResponse.json(demoStatus);
  }),
  http.get('/api/plugins', ({ request }) => {
    const auth = authenticate(request);
    return auth.error ?? HttpResponse.json({ plugins: readPluginStates(configuredPluginIds()) });
  }),
  http.get('/api/remote-plugins', ({ request }) => {
    const auth = authenticate(request);
    return auth.error ?? HttpResponse.json({ plugins: readRemotePluginConfigurations() });
  }),
  http.post('/api/remote-plugins', async ({ request }) => {
    const auth = authenticate(request, 'plugins:manage');
    if (auth.error) return auth.error;
    try {
      const configuration = await readRemoteConfiguration(request);
      const current = readRemotePluginConfigurations();
      if (configuredPluginIds().includes(configuration.manifest.id)) {
        return HttpResponse.json({ message: `远程插件已存在：${configuration.manifest.id}` }, { status: 409 });
      }
      if (current.some(({ origin }) => origin === configuration.origin)) {
        return HttpResponse.json({ message: `远程插件地址已存在：${configuration.origin}` }, { status: 409 });
      }
      if (current.some(({ manifest }) => manifest.remote.name === configuration.manifest.remote.name)) {
        return HttpResponse.json(
          { message: `Federation 容器名称已存在：${configuration.manifest.remote.name}` },
          { status: 409 },
        );
      }
      return HttpResponse.json({ plugins: writeRemotePluginConfigurations([...current, configuration]) }, { status: 201 });
    } catch (reason) {
      return HttpResponse.json({ message: reason instanceof Error ? reason.message : '远程插件配置无效' }, { status: 400 });
    }
  }),
  http.put('/api/remote-plugins/:id', async ({ request, params }) => {
    const auth = authenticate(request, 'plugins:manage');
    if (auth.error) return auth.error;
    const id = String(params['id']);
    try {
      const configuration = await readRemoteConfiguration(request);
      const current = readRemotePluginConfigurations();
      if (!current.some(({ manifest }) => manifest.id === id)) {
        return HttpResponse.json({ message: '远程插件不存在' }, { status: 404 });
      }
      if (configuration.manifest.id !== id) {
        return HttpResponse.json({ message: `新地址返回了其他插件：${configuration.manifest.id}` }, { status: 409 });
      }
      if (current.some((item) => item.manifest.id !== id && item.origin === configuration.origin)) {
        return HttpResponse.json({ message: `远程插件地址已存在：${configuration.origin}` }, { status: 409 });
      }
      if (current.some((item) => item.manifest.id !== id && item.manifest.remote.name === configuration.manifest.remote.name)) {
        return HttpResponse.json(
          { message: `Federation 容器名称已存在：${configuration.manifest.remote.name}` },
          { status: 409 },
        );
      }
      return HttpResponse.json({
        plugins: writeRemotePluginConfigurations(current.map((item) => (item.manifest.id === id ? configuration : item))),
      });
    } catch (reason) {
      return HttpResponse.json({ message: reason instanceof Error ? reason.message : '远程插件配置无效' }, { status: 400 });
    }
  }),
  http.delete('/api/remote-plugins/:id', ({ request, params }) => {
    const auth = authenticate(request, 'plugins:manage');
    if (auth.error) return auth.error;
    const id = String(params['id']);
    const current = readRemotePluginConfigurations();
    if (!current.some(({ manifest }) => manifest.id === id)) {
      return HttpResponse.json({ message: '远程插件不存在' }, { status: 404 });
    }
    removePluginState(id);
    return HttpResponse.json({
      plugins: writeRemotePluginConfigurations(current.filter(({ manifest }) => manifest.id !== id)),
    });
  }),
  http.patch('/api/plugins/:id', async ({ request, params }) => {
    const auth = authenticate(request, 'plugins:manage');
    if (auth.error) return auth.error;
    const id = String(params['id']);
    const body = (await request.json()) as { enabled?: boolean };
    if (!readPluginStates(configuredPluginIds()).some((state) => state.id === id)) {
      return HttpResponse.json({ message: '插件不存在' }, { status: 404 });
    }
    if (typeof body.enabled !== 'boolean') {
      return HttpResponse.json({ message: 'enabled 必须是布尔值' }, { status: 400 });
    }
    return HttpResponse.json({ plugins: writePluginState(id, body.enabled, configuredPluginIds()) });
  }),
];
