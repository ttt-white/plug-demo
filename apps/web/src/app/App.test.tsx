import { AuthProvider } from '@/auth/AuthProvider';
import { demoStatus } from '@/mocks/data';
import { server } from '@/mocks/server';
import { PluginRegistryProvider } from '@/plugins/PluginRegistryProvider';
import { TOKEN_STORAGE_KEY } from '@/services/api-client';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent, { PointerEventsCheckLevel } from '@testing-library/user-event';
import { ConfigProvider } from 'antd';
import axe from 'axe-core';
import { http, HttpResponse } from 'msw';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { App } from './App';

function LocationProbe() {
  const location = useLocation();
  return <output data-testid="current-path">{`${location.pathname}${location.search}${location.hash}`}</output>;
}

function renderApp(path = '/login') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <LocationProbe />
      <ConfigProvider theme={{ token: { motion: false } }}>
        <AuthProvider>
          <PluginRegistryProvider>
            <App />
          </PluginRegistryProvider>
        </AuthProvider>
      </ConfigProvider>
    </MemoryRouter>,
  );
}

const setupUser = () => userEvent.setup({ pointerEventsCheck: PointerEventsCheckLevel.Never });

async function loginAsAdmin() {
  const user = setupUser();
  await user.click(screen.getByRole('button', { name: '登录工作区' }));
  return user;
}

async function expectNoAxeViolations(container: HTMLElement) {
  const result = await axe.run(container, { rules: { 'color-contrast': { enabled: false } } });
  expect(result.violations.map(({ id }) => id)).toEqual([]);
}

describe('workspace flows', () => {
  it('keeps the login and authenticated shell accessible', async () => {
    const login = renderApp();
    expect(await screen.findByRole('heading', { name: 'FMS Workspace 登录' })).toBeInTheDocument();
    await expectNoAxeViolations(login.container);
    login.unmount();

    sessionStorage.setItem(TOKEN_STORAGE_KEY, 'mock-admin-token');
    const authenticated = renderApp('/dashboard');
    expect(await screen.findByRole('heading', { name: '工作台' })).toBeInTheDocument();
    await expectNoAxeViolations(authenticated.container);
  });

  it('loads the host slot module and deduplicates its shared query', async () => {
    let statusRequests = 0;
    server.use(
      http.get('/api/demo-status', () => {
        statusRequests += 1;
        return HttpResponse.json(demoStatus);
      }),
    );
    renderApp();
    await loginAsAdmin();

    expect(await screen.findByRole('heading', { name: '插槽模块 one' }, { timeout: 3000 })).toBeInTheDocument();
    expect(screen.getAllByText('共享 API 已就绪')).toHaveLength(2);
    expect(statusRequests).toBe(1);
  });

  it('demonstrates extension slots, typed messages and route parameters', async () => {
    renderApp('/plugin-two');
    const user = await loginAsAdmin();

    expect(await screen.findByRole('heading', { name: '页面插件 two' }, { timeout: 3000 })).toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: 'three 注入的扩展模块' }, { timeout: 3000 })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '发送给 two' }));
    expect(screen.getByText('定向消息：来自 three 扩展模块')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '公共广播' }));
    expect(screen.getByText('公共消息：three: three 模块广播')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '打开外部插件 three' }));
    expect(await screen.findByRole('heading', { name: '外部插件 three' }, { timeout: 3000 })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '携带参数打开 two' }));
    expect(await screen.findByText('路由参数：three: 来自 three 的路由参数', {}, { timeout: 3000 })).toBeInTheDocument();
    expect(screen.getByTestId('current-path')).toHaveTextContent('/plugin-two?from=three&message=');
  });

  it('loads the external plugin page from a healthy remote', async () => {
    renderApp('/plugin-three');
    await loginAsAdmin();
    expect(await screen.findByRole('heading', { name: '外部插件 three' }, { timeout: 3000 })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '外部插件 three' })).toBeInTheDocument();
  });

  it('marks an unavailable remote offline and removes its route and extension module', async () => {
    server.use(http.get('http://localhost:3100/fms-plugin.json', () => HttpResponse.error()));
    renderApp('/plugin-two');
    const user = await loginAsAdmin();

    expect(await screen.findByRole('heading', { name: '页面插件 two' }, { timeout: 3000 })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'three 注入的扩展模块' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: '外部插件 three' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('link', { name: '插件中心' }));
    expect(await screen.findByText('离线')).toBeInTheDocument();
    expect(screen.getByRole('switch', { name: '停用three' })).toBeDisabled();
  });

  it('disables a plugin and removes its route entry', async () => {
    renderApp();
    const user = await loginAsAdmin();
    await user.click(await screen.findByRole('link', { name: '插件中心' }));

    const toggle = await screen.findByRole('switch', { name: '停用two' });
    await user.click(toggle);
    await waitFor(() => expect(screen.queryByRole('link', { name: '页面插件 two' })).not.toBeInTheDocument());
    expect(toggle).not.toBeChecked();
  });

  it('preserves a requested plugin URL through login', async () => {
    renderApp('/plugin-two?from=test&message=hello#demo');
    await loginAsAdmin();
    expect(await screen.findByText('路由参数：test: hello', {}, { timeout: 3000 })).toBeInTheDocument();
    expect(screen.getByTestId('current-path')).toHaveTextContent('/plugin-two?from=test&message=hello#demo');
  });

  it('protects plugin routes from a viewer while keeping the host module visible', async () => {
    sessionStorage.setItem(TOKEN_STORAGE_KEY, 'mock-viewer-token');
    const restricted = renderApp('/plugin-two');
    expect(await screen.findByRole('heading', { name: '没有访问权限' })).toBeInTheDocument();
    restricted.unmount();

    renderApp('/dashboard');
    expect(await screen.findByRole('heading', { name: '插槽模块 one' }, { timeout: 3000 })).toBeInTheDocument();
  });

  it('logs out from the account menu', async () => {
    renderApp();
    const user = await loginAsAdmin();
    await user.click(await screen.findByRole('button', { name: '账户菜单' }, { timeout: 3000 }));
    await user.click(await screen.findByText('退出登录'));
    expect(await screen.findByRole('button', { name: '登录工作区' })).toBeInTheDocument();
  });
});
