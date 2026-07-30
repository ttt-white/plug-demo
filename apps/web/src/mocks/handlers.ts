import { delay, http, HttpResponse } from 'msw';
import { installedPlugins } from 'virtual:fms-installed-plugins';
import { carrierRatingsData, dashboardData, mockAccounts, readPluginStates, reportsData, writePluginState } from './data';

const installedPluginIds = installedPlugins.map((plugin) => plugin.manifest.id);

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
    await delay(350);
    const body = (await request.json()) as { username?: string; password?: string };
    const account = body.username ? mockAccounts[body.username] : undefined;
    if (!account || account.password !== body.password) {
      return HttpResponse.json({ message: '用户名或密码错误' }, { status: 401 });
    }
    return HttpResponse.json({ token: account.token, user: account.user });
  }),

  http.get('/api/auth/me', async ({ request }) => {
    await delay(120);
    const auth = authenticate(request);
    return auth.error ?? HttpResponse.json({ user: auth.user });
  }),

  http.get('/api/dashboard', async ({ request }) => {
    await delay(500);
    const auth = authenticate(request, 'dashboard:view');
    return auth.error ?? HttpResponse.json(dashboardData);
  }),

  http.get('/api/reports', async ({ request }) => {
    await delay(550);
    const auth = authenticate(request, 'reports:view');
    return auth.error ?? HttpResponse.json(reportsData);
  }),

  http.get('/api/carrier-ratings', async ({ request }) => {
    await delay(420);
    const auth = authenticate(request, 'carrier-ratings:view');
    return auth.error ?? HttpResponse.json(carrierRatingsData);
  }),

  http.get('/api/plugins', async ({ request }) => {
    await delay(180);
    const auth = authenticate(request);
    return auth.error ?? HttpResponse.json({ plugins: readPluginStates(installedPluginIds) });
  }),

  http.patch('/api/plugins/:id', async ({ request, params }) => {
    await delay(260);
    const auth = authenticate(request, 'plugins:manage');
    if (auth.error) return auth.error;
    const id = String(params['id']);
    const body = (await request.json()) as { enabled?: boolean };
    if (!readPluginStates(installedPluginIds).some((state) => state.id === id)) {
      return HttpResponse.json({ message: '插件不存在' }, { status: 404 });
    }
    if (typeof body.enabled !== 'boolean') {
      return HttpResponse.json({ message: 'enabled 必须是布尔值' }, { status: 400 });
    }
    return HttpResponse.json({ plugins: writePluginState(id, body.enabled, installedPluginIds) });
  }),
];
