import { AuthProvider } from '@/auth/AuthProvider';
import { dashboardData } from '@/mocks/data';
import { server } from '@/mocks/server';
import { PluginRegistryProvider } from '@/plugins/PluginRegistryProvider';
import { TOKEN_STORAGE_KEY } from '@/services/api-client';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent, { PointerEventsCheckLevel } from '@testing-library/user-event';
import { ConfigProvider } from 'antd';
import axe from 'axe-core';
import { http, HttpResponse } from 'msw';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { App } from './App';

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

function setupUser() {
  return userEvent.setup({ pointerEventsCheck: PointerEventsCheckLevel.Never });
}

function LocationProbe() {
  const location = useLocation();
  return (
    <output aria-hidden="true" data-testid="current-path">
      {`${location.pathname}${location.search}${location.hash}`}
    </output>
  );
}

async function expectNoAxeViolations(container: HTMLElement) {
  const result = await axe.run(container, { rules: { 'color-contrast': { enabled: false } } });
  expect(
    result.violations.map(({ id, nodes }) => ({
      id,
      targets: nodes.flatMap(({ target }) => target.map(String)),
    })),
  ).toEqual([]);
}

describe('workspace flows', () => {
  it('has no detectable accessibility violations on the login page', async () => {
    const { container } = renderApp();
    expect(await screen.findByRole('heading', { name: 'FMS Workspace 登录' })).toBeInTheDocument();
    await expectNoAxeViolations(container);
  });

  it('puts the skip link first in keyboard order and passes an authenticated axe check', async () => {
    const user = setupUser();
    sessionStorage.setItem(TOKEN_STORAGE_KEY, 'mock-admin-token');
    const { container } = renderApp('/dashboard');

    expect(await screen.findByRole('heading', { name: '工作台' })).toBeInTheDocument();
    await user.tab();
    expect(screen.getByRole('link', { name: '跳转到主内容' })).toHaveFocus();
    await expectNoAxeViolations(container);
  });

  it('logs in as admin, renders contributions and disables a page plugin', async () => {
    const user = setupUser();
    renderApp();
    await user.click(screen.getByRole('button', { name: '登录工作区' }));

    expect(await screen.findByText('在途运单', {}, { timeout: 3000 })).toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: '业务指标' }, { timeout: 3000 })).toBeInTheDocument();
    expect(screen.getByText('本月结算额')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '履约报表' })).toBeInTheDocument();

    await user.click(screen.getByRole('link', { name: /插件中心/ }));
    const toggle = await screen.findByRole('switch', { name: '停用two' });
    await user.click(toggle);

    await waitFor(() => expect(screen.queryByRole('link', { name: '履约报表' })).not.toBeInTheDocument());
    expect(toggle).not.toBeChecked();
  });

  it('deduplicates the dashboard query across the host and one plugin', async () => {
    let dashboardRequests = 0;
    server.use(
      http.get('/api/dashboard', () => {
        dashboardRequests += 1;
        return HttpResponse.json(dashboardData);
      }),
    );
    const user = setupUser();
    renderApp();
    await user.click(screen.getByRole('button', { name: '登录工作区' }));

    expect(await screen.findByRole('heading', { name: '业务指标' }, { timeout: 3000 })).toBeInTheDocument();
    expect(dashboardRequests).toBe(1);
  });

  it('keeps the last successful plugin state snapshot when a refresh fails', async () => {
    const user = setupUser();
    sessionStorage.setItem(TOKEN_STORAGE_KEY, 'mock-admin-token');
    renderApp('/plugins');

    const toggle = await screen.findByRole('switch', { name: '停用two' });
    expect(toggle).toBeChecked();
    expect(screen.getByRole('link', { name: '履约报表' })).toBeInTheDocument();

    server.use(http.get('/api/plugins', () => HttpResponse.json({ message: '插件状态服务暂不可用' }, { status: 503 })));
    await user.click(screen.getByRole('button', { name: '刷新插件状态' }));

    expect(await screen.findByText('插件状态同步失败')).toBeInTheDocument();
    expect(screen.getByText(/已保留最后一次成功状态/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '履约报表' })).toBeInTheDocument();
    expect(screen.getByRole('switch', { name: '停用two' })).toBeChecked();

    server.resetHandlers();
    await user.click(screen.getByRole('button', { name: '重试插件状态同步' }));
    await waitFor(() => expect(screen.queryByText('插件状态同步失败')).not.toBeInTheDocument());
    expect(screen.getByRole('switch', { name: '停用two' })).toBeChecked();
  });

  it('returns to the requested plugin page after admin login', async () => {
    const user = setupUser();
    renderApp('/reports');
    await user.click(await screen.findByRole('button', { name: '登录工作区' }));
    expect(await screen.findByRole('heading', { name: '履约报表' }, { timeout: 3000 })).toBeInTheDocument();
    expect(await screen.findByRole('cell', { name: 'FMS-20260729-018' }, { timeout: 3000 })).toBeInTheDocument();
  });

  it('preserves query and hash when returning to a requested plugin page', async () => {
    const user = setupUser();
    renderApp('/reports?carrier=east#summary');
    await user.click(await screen.findByRole('button', { name: '登录工作区' }));

    expect(await screen.findByRole('heading', { name: '履约报表' }, { timeout: 3000 })).toBeInTheDocument();
    expect(screen.getByTestId('current-path')).toHaveTextContent('/reports?carrier=east#summary');
  });

  it('stores report filters and sorting in the URL', async () => {
    const user = setupUser();
    sessionStorage.setItem(TOKEN_STORAGE_KEY, 'mock-admin-token');
    renderApp('/reports');

    expect(await screen.findByRole('cell', { name: 'FMS-20260729-018' }, { timeout: 3000 })).toBeInTheDocument();
    await user.click(screen.getByRole('combobox', { name: '按承运商筛选' }));
    const carrierOption = (await screen.findAllByText('东驰物流')).find((element) =>
      element.classList.contains('ant-select-item-option-content'),
    );
    if (!carrierOption) throw new Error('承运商选项未渲染');
    await user.click(carrierOption);

    await waitFor(() =>
      expect(screen.getByTestId('current-path')).toHaveTextContent('carrier=%E4%B8%9C%E9%A9%B0%E7%89%A9%E6%B5%81'),
    );
    expect(await screen.findAllByRole('cell', { name: '东驰物流' })).toHaveLength(2);
    expect(screen.queryByRole('cell', { name: '华运供应链' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('columnheader', { name: /运输费用/ }));
    await waitFor(() => expect(screen.getByTestId('current-path')).toHaveTextContent('sort=amount&order=asc'));
  });

  it('opens the first accessible plugin page for a reports-only user', async () => {
    const user = setupUser();
    renderApp();

    const username = screen.getByLabelText('用户名');
    const password = screen.getByLabelText('密码');
    await user.clear(username);
    await user.type(username, 'reporter');
    await user.clear(password);
    await user.type(password, 'reporter123');
    await user.click(screen.getByRole('button', { name: '登录工作区' }));

    expect(await screen.findByRole('heading', { name: '履约报表' }, { timeout: 3000 })).toBeInTheDocument();
    expect(screen.getByTestId('current-path')).toHaveTextContent('/reports');
    expect(screen.queryByRole('link', { name: '工作台' })).not.toBeInTheDocument();
  });

  it('logs out from the account menu', async () => {
    const user = setupUser();
    renderApp();
    await user.click(screen.getByRole('button', { name: '登录工作区' }));

    await user.click(await screen.findByRole('button', { name: '账户菜单' }, { timeout: 3000 }));
    await user.click(await screen.findByText('退出登录'));

    expect(await screen.findByRole('button', { name: '登录工作区' })).toBeInTheDocument();
  });

  it('loads the locally linked external page plugin for an admin', async () => {
    const user = setupUser();
    renderApp('/carrier-ratings');
    await user.click(await screen.findByRole('button', { name: '登录工作区' }));

    expect(await screen.findByRole('heading', { name: '承运商评级' }, { timeout: 3000 })).toBeInTheDocument();
    expect(await screen.findByRole('cell', { name: '北辰货运' }, { timeout: 3000 })).toBeInTheDocument();
    expect(screen.getAllByText('高风险').length).toBeGreaterThan(0);
    expect(screen.getByRole('link', { name: '承运商评级' })).toBeInTheDocument();
  });

  it('connects an external module to another plugin and opens its configured canonical route', async () => {
    const user = setupUser();
    renderApp('/reports');
    await user.click(await screen.findByRole('button', { name: '登录工作区' }));

    expect(await screen.findByRole('heading', { name: '承运商风险摘要' }, { timeout: 3000 })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '筛选东驰物流履约报表' }));
    await waitFor(() =>
      expect(screen.getByTestId('current-path')).toHaveTextContent('carrier=%E4%B8%9C%E9%A9%B0%E7%89%A9%E6%B5%81'),
    );
    expect(await screen.findAllByRole('cell', { name: '东驰物流' })).toHaveLength(2);
    expect(screen.queryByRole('cell', { name: '华运供应链' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '查看全部评级' }));
    expect(await screen.findByRole('heading', { name: '承运商评级' }, { timeout: 3000 })).toBeInTheDocument();
    expect(screen.getByTestId('current-path')).toHaveTextContent('/carrier-ratings');
  });

  it('opens a carrier-filtered report from the ratings table', async () => {
    const user = setupUser();
    sessionStorage.setItem(TOKEN_STORAGE_KEY, 'mock-admin-token');
    renderApp('/carrier-ratings');

    const carrierRow = await screen.findByRole('row', { name: /东驰物流/ }, { timeout: 3000 });
    await user.click(within(carrierRow).getByRole('button', { name: '查看履约' }));

    expect(await screen.findByRole('heading', { name: '履约报表' }, { timeout: 3000 })).toBeInTheDocument();
    expect(screen.getByTestId('current-path')).toHaveTextContent('/reports?carrier=%E4%B8%9C%E9%A9%B0%E7%89%A9%E6%B5%81');
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
