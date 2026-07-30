import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { AuthProvider } from '@/auth/AuthProvider';
import { PluginRegistryProvider } from '@/plugins/PluginRegistryProvider';
import { TOKEN_STORAGE_KEY } from '@/services/api-client';
import { App } from './App';

function renderApp(path = '/login') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AuthProvider>
        <PluginRegistryProvider>
          <App />
        </PluginRegistryProvider>
      </AuthProvider>
    </MemoryRouter>,
  );
}

describe('workspace flows', () => {
  it('logs in as admin, renders contributions and disables a page plugin', async () => {
    const user = userEvent.setup();
    renderApp();
    await user.click(screen.getByRole('button', { name: '登录工作区' }));

    expect(await screen.findByRole('heading', { name: '早上好，运输团队' })).toBeInTheDocument();
    expect(await screen.findByText('实时经营指标')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /履约报表/ })).toBeInTheDocument();

    await user.click(screen.getByRole('link', { name: /插件中心/ }));
    const reportCard = (await screen.findByText('履约报表页面')).closest('article');
    expect(reportCard).not.toBeNull();
    const toggle = within(reportCard as HTMLElement).getByRole('switch');
    await user.click(toggle);

    await waitFor(() => expect(screen.queryByRole('link', { name: /履约报表/ })).not.toBeInTheDocument());
    expect(toggle).not.toBeChecked();
  });

  it('returns to the requested plugin page after admin login', async () => {
    const user = userEvent.setup();
    renderApp('/reports');
    await user.click(await screen.findByRole('button', { name: '登录工作区' }));
    expect(await screen.findByRole('heading', { name: '履约报表' })).toBeInTheDocument();
  });

  it('shows 403 when a viewer opens an enabled restricted plugin route', async () => {
    sessionStorage.setItem(TOKEN_STORAGE_KEY, 'mock-viewer-token');
    renderApp('/reports');
    expect(await screen.findByRole('heading', { name: '没有访问权限' })).toBeInTheDocument();
  });
});
