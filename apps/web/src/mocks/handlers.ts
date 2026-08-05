import { configuredPluginIds, remotePluginManifestFixture } from '@/plugins/remote-plugin-catalog';
import { delay, http, HttpResponse, passthrough } from 'msw';
import { installedPluginDescriptors } from 'virtual:fms-installed-plugins';
import { demoStatus, mockAccounts, readPluginStates, writePluginState } from './data';

const mockDelay = import.meta.env.MODE === 'test' ? async (_milliseconds: number) => undefined : delay;
const discoveredPluginIds = installedPluginDescriptors.flatMap(({ metadata }) =>
  typeof metadata.declaredPluginId === 'string' ? [metadata.declaredPluginId] : [],
);
const configuredStatePluginIds = configuredPluginIds.filter((id) => discoveredPluginIds.includes(id) || id === 'three');

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
  http.get('*/fms-plugin.json', () =>
    import.meta.env.MODE === 'test' ? HttpResponse.json(remotePluginManifestFixture) : passthrough(),
  ),
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
    return auth.error ?? HttpResponse.json({ plugins: readPluginStates(configuredStatePluginIds) });
  }),
  http.patch('/api/plugins/:id', async ({ request, params }) => {
    const auth = authenticate(request, 'plugins:manage');
    if (auth.error) return auth.error;
    const id = String(params['id']);
    const body = (await request.json()) as { enabled?: boolean };
    if (!readPluginStates(configuredStatePluginIds).some((state) => state.id === id)) {
      return HttpResponse.json({ message: '插件不存在' }, { status: 404 });
    }
    if (typeof body.enabled !== 'boolean') {
      return HttpResponse.json({ message: 'enabled 必须是布尔值' }, { status: 400 });
    }
    return HttpResponse.json({ plugins: writePluginState(id, body.enabled, configuredStatePluginIds) });
  }),
];
