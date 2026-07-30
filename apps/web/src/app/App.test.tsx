import { AuthProvider } from '@/auth/AuthProvider';
import { PluginRegistryProvider } from '@/plugins/PluginRegistryProvider';
import { TOKEN_STORAGE_KEY } from '@/services/api-client';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { App } from './App';

function renderApp(path = '/login') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <LocationProbe />
      <AuthProvider>
        <PluginRegistryProvider>
          <App />
        </PluginRegistryProvider>
      </AuthProvider>
    </MemoryRouter>,
  );
}

function LocationProbe() {
  return <output data-testid="current-path">{useLocation().pathname}</output>;
}

describe('workspace flows', () => {
  it('logs in as admin, renders contributions and disables a page plugin', async () => {
    const user = userEvent.setup();
    renderApp();
    await user.click(screen.getByRole('button', { name: '登录工作区' }));

    expect(await screen.findByText('这是宿主的工作台页面，对应菜单 one')).toBeInTheDocument();
    expect(await screen.findByText('这是 one 插件开发在工作台的指标模块')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /two/ })).toBeInTheDocument();

    await user.click(screen.getByRole('link', { name: /插件中心/ }));
    const toggle = await screen.findByRole('switch', { name: '停用two' });
    await user.click(toggle);

    await waitFor(() => expect(screen.queryByRole('link', { name: /two/ })).not.toBeInTheDocument());
    expect(toggle).not.toBeChecked();
  });

  it('returns to the requested plugin page after admin login', async () => {
    const user = userEvent.setup();
    renderApp('/reports');
    await user.click(await screen.findByRole('button', { name: '登录工作区' }));
    expect(await screen.findByText('这是 two 插件的履约报表页面', {}, { timeout: 3000 })).toBeInTheDocument();
  });

  it('logs out from the account menu', async () => {
    const user = userEvent.setup();
    renderApp();
    await user.click(screen.getByRole('button', { name: '登录工作区' }));

    await user.click(await screen.findByRole('button', { name: '账户菜单' }));
    await user.click(await screen.findByText('退出登录'));

    expect(await screen.findByRole('button', { name: '登录工作区' })).toBeInTheDocument();
  });

  it('loads the locally linked external page plugin for an admin', async () => {
    const user = userEvent.setup();
    renderApp('/carrier-ratings');
    await user.click(await screen.findByRole('button', { name: '登录工作区' }));

    expect(await screen.findByText('这是 three 插件的外部页面1112', {}, { timeout: 3000 })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /three/ })).toBeInTheDocument();
  });

  it('connects an external module to another plugin and opens its configured canonical route', async () => {
    const user = userEvent.setup();
    renderApp('/reports');
    await user.click(await screen.findByRole('button', { name: '登录工作区' }));

    expect(await screen.findByText('这是 three 插件开发在 two 页面中的模块', {}, { timeout: 3000 })).toBeInTheDocument();
    await user.click(await screen.findByRole('button', { name: '发送到 two' }, { timeout: 3000 }));
    expect(screen.getByText('收到承运商筛选消息：东驰物流')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'three11112' }));
    expect(await screen.findByText('这是 three 插件的外部页面1112', {}, { timeout: 3000 })).toBeInTheDocument();
    expect(screen.getByTestId('current-path')).toHaveTextContent('/carrier-ratings');
  });

  it('does not register the removed duplicate child path', async () => {
    sessionStorage.setItem(TOKEN_STORAGE_KEY, 'mock-admin-token');
    renderApp('/reports/carrier-ratings');
    expect(await screen.findByRole('heading', { name: '页面不存在' })).toBeInTheDocument();
  });

  it('shows 403 when a viewer opens an enabled restricted plugin route', async () => {
    sessionStorage.setItem(TOKEN_STORAGE_KEY, 'mock-viewer-token');
    renderApp('/reports');
    expect(await screen.findByRole('heading', { name: '没有访问权限' })).toBeInTheDocument();
  });

  it('keeps the external plugin route protected from viewers', async () => {
    sessionStorage.setItem(TOKEN_STORAGE_KEY, 'mock-viewer-token');
    renderApp('/carrier-ratings');
    expect(await screen.findByRole('heading', { name: '没有访问权限' })).toBeInTheDocument();
  });
});
