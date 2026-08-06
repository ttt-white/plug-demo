import type { PluginRegistration } from '@tt-plug/plugin-sdk';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent, { PointerEventsCheckLevel } from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PluginCenterPage } from './PluginCenterPage';

const { useAuthMock, usePluginRegistryMock } = vi.hoisted(() => ({ useAuthMock: vi.fn(), usePluginRegistryMock: vi.fn() }));

vi.mock('@/auth/AuthProvider', () => ({ useAuth: useAuthMock }));
vi.mock('@/plugins/PluginRegistryProvider', () => ({ usePluginRegistry: usePluginRegistryMock }));

const setupUser = () => userEvent.setup({ pointerEventsCheck: PointerEventsCheckLevel.Never });

const remoteConfiguration = {
  origin: 'http://localhost:3100',
  manifest: {
    schemaVersion: 1 as const,
    id: 'sample',
    name: 'sample',
    version: '1.0.0',
    apiVersion: 1 as const,
    remote: { name: 'plugin_sample', entry: '/remoteEntry.js', module: './plugin' },
  },
};

const remoteRegistration: PluginRegistration = {
  source: {
    packageName: 'remote:sample',
    packageVersion: '1.0.0',
    declaredPluginId: 'sample',
    declaredApiVersion: 1,
    sourceType: 'remote',
    remoteUrl: 'http://localhost:3100',
  },
  plugin: {
    manifest: { id: 'sample', name: 'sample', version: '1.0.0', apiVersion: 1 },
  },
  status: 'ready',
  diagnostics: [],
  errors: [],
};

function registry(overrides: Record<string, unknown> = {}) {
  return {
    registrations: [remoteRegistration],
    states: [{ id: 'sample', enabled: true }],
    statesState: { status: 'ready', states: [{ id: 'sample', enabled: true }], error: null },
    loading: false,
    refreshing: false,
    remoteConfigurations: [remoteConfiguration],
    routes: [],
    importRemotePlugin: vi.fn(),
    updateRemotePlugin: vi.fn(),
    removeRemotePlugin: vi.fn(),
    reloadStates: vi.fn(),
    setEnabled: vi.fn(),
    ...overrides,
  };
}

describe('PluginCenterPage diagnostics', () => {
  beforeEach(() => {
    useAuthMock.mockReset();
    usePluginRegistryMock.mockReset();
  });

  it('shows package identity and a staged load failure without requiring a manifest', () => {
    useAuthMock.mockReturnValue({ can: () => true });
    const registration: PluginRegistration = {
      source: {
        packageName: '@tt-plug/plugin-broken',
        packageVersion: '1.2.3',
        declaredPluginId: 'broken',
        declaredApiVersion: 1,
      },
      plugin: null,
      status: 'error',
      diagnostics: [
        {
          code: 'PLUGIN_LOAD_FAILED',
          stage: 'load',
          severity: 'error',
          message: '插件包加载失败：top-level failed',
        },
      ],
      errors: ['插件包加载失败：top-level failed'],
    };
    usePluginRegistryMock.mockReturnValue({
      registrations: [registration],
      states: [{ id: 'broken', enabled: true }],
      statesState: { status: 'ready', states: [{ id: 'broken', enabled: true }], error: null },
      loading: false,
      refreshing: false,
      remoteConfigurations: [],
      routes: [],
      importRemotePlugin: vi.fn(),
      updateRemotePlugin: vi.fn(),
      removeRemotePlugin: vi.fn(),
      reloadStates: vi.fn(),
      setEnabled: vi.fn(),
    });

    render(
      <MemoryRouter>
        <PluginCenterPage />
      </MemoryRouter>,
    );

    expect(screen.getByText('@tt-plug/plugin-broken')).toBeInTheDocument();
    expect(screen.getByText('[load/PLUGIN_LOAD_FAILED] 插件包加载失败：top-level failed')).toBeInTheDocument();
    expect(screen.getByRole('switch', { name: '停用broken' })).toBeDisabled();
  });

  it('shows an unavailable remote plugin with its saved identity and service address', () => {
    useAuthMock.mockReturnValue({ can: () => true });
    const registration: PluginRegistration = {
      source: {
        packageName: 'remote:sample',
        packageVersion: '0.0.0',
        declaredPluginId: 'sample',
        declaredApiVersion: 1,
        sourceType: 'remote',
        remoteUrl: 'http://localhost:3100',
      },
      plugin: null,
      status: 'error',
      diagnostics: [
        {
          code: 'REMOTE_PLUGIN_UNAVAILABLE',
          stage: 'health',
          severity: 'error',
          message: '远程插件不可用：http://localhost:3100（fetch failed）',
        },
      ],
      errors: ['远程插件不可用：http://localhost:3100（fetch failed）'],
    };
    usePluginRegistryMock.mockReturnValue({
      registrations: [registration],
      states: [{ id: 'sample', enabled: true }],
      statesState: { status: 'ready', states: [{ id: 'sample', enabled: true }], error: null },
      loading: false,
      refreshing: false,
      remoteConfigurations: [{ ...remoteConfiguration, manifest: { ...remoteConfiguration.manifest, name: '运输分析插件' } }],
      routes: [],
      importRemotePlugin: vi.fn(),
      updateRemotePlugin: vi.fn(),
      removeRemotePlugin: vi.fn(),
      reloadStates: vi.fn(),
      setEnabled: vi.fn(),
    });

    render(
      <MemoryRouter>
        <PluginCenterPage />
      </MemoryRouter>,
    );

    expect(screen.getByText('离线')).toBeInTheDocument();
    expect(screen.getByText('运输分析插件')).toBeInTheDocument();
    expect(screen.getByText('http://localhost:3100')).toBeInTheDocument();
    expect(screen.getByRole('switch', { name: '停用运输分析插件' })).toBeDisabled();
  });

  it('imports a remote plugin from the entered service address', async () => {
    const importRemotePlugin = vi.fn().mockResolvedValue(undefined);
    useAuthMock.mockReturnValue({ can: () => true });
    usePluginRegistryMock.mockReturnValue(
      registry({ registrations: [], states: [], remoteConfigurations: [], importRemotePlugin }),
    );
    const user = setupUser();

    render(
      <MemoryRouter>
        <PluginCenterPage />
      </MemoryRouter>,
    );

    await user.click(screen.getByRole('button', { name: '导入' }));
    const dialog = screen.getByRole('dialog', { name: '导入远程插件' });
    await user.type(within(dialog).getByRole('textbox', { name: '服务地址' }), 'https://plugins.example.test/tool');
    await user.click(within(dialog).getByRole('button', { name: /导\s*入/ }));

    await waitFor(() => expect(importRemotePlugin).toHaveBeenCalledWith('https://plugins.example.test/tool'));
  });

  it('updates the service address of a configured remote plugin', async () => {
    const updateRemotePlugin = vi.fn().mockResolvedValue(undefined);
    useAuthMock.mockReturnValue({ can: () => true });
    usePluginRegistryMock.mockReturnValue(registry({ updateRemotePlugin }));
    const user = setupUser();

    render(
      <MemoryRouter>
        <PluginCenterPage />
      </MemoryRouter>,
    );

    await user.click(screen.getByRole('button', { name: '修改sample服务地址' }));
    const dialog = screen.getByRole('dialog', { name: '修改远程插件地址' });
    const input = within(dialog).getByRole('textbox', { name: '服务地址' });
    await user.clear(input);
    await user.type(input, 'http://127.0.0.1:3100');
    await user.click(within(dialog).getByRole('button', { name: /保\s*存/ }));

    await waitFor(() => expect(updateRemotePlugin).toHaveBeenCalledWith('sample', 'http://127.0.0.1:3100'));
  });

  it('removes a configured remote plugin after confirmation', async () => {
    const removeRemotePlugin = vi.fn().mockResolvedValue(undefined);
    useAuthMock.mockReturnValue({ can: () => true });
    usePluginRegistryMock.mockReturnValue(registry({ removeRemotePlugin }));
    const user = setupUser();

    render(
      <MemoryRouter>
        <PluginCenterPage />
      </MemoryRouter>,
    );

    await user.click(screen.getByRole('button', { name: '删除sample' }));
    await user.click(await screen.findByRole('button', { name: /^删\s*除$/ }));

    await waitFor(() => expect(removeRemotePlugin).toHaveBeenCalledWith('sample'));
  });

  it('shows page, entry, module and slot relationships with resolved targets', async () => {
    const load = vi.fn();
    const topologyRegistrations: PluginRegistration[] = [
      {
        source: { packageName: '@tt-plug/plugin-one', packageVersion: '1.0.0' },
        plugin: {
          manifest: { id: 'one', name: 'one', version: '1.0.0', apiVersion: 1 },
          modules: [{ id: 'one.module', routeId: 'dashboard', slotId: 'dashboard.demo', priority: 100, load }],
        },
        status: 'ready',
        diagnostics: [],
        errors: [],
      },
      {
        source: { packageName: '@tt-plug/plugin-two', packageVersion: '1.0.0' },
        plugin: {
          manifest: { id: 'two', name: 'two', version: '1.0.0', apiVersion: 1 },
          routes: [
            {
              id: 'two',
              path: '/plugin-two',
              permission: 'demo:two:view',
              menu: { label: '页面插件 two', order: 30 },
              load,
            },
          ],
          extensionSlots: [{ id: 'two.demo', routeId: 'two', description: 'two 页面扩展模块。' }],
        },
        status: 'ready',
        diagnostics: [],
        errors: [],
      },
      {
        source: { packageName: 'remote:sample', packageVersion: '1.0.0', sourceType: 'remote' },
        plugin: {
          manifest: { id: 'sample', name: 'sample', version: '1.0.0', apiVersion: 1 },
          routes: [
            {
              id: 'sample',
              path: '/plugin-sample',
              permission: 'demo:sample:view',
              menu: { label: '外部插件 sample', order: 35 },
              load,
            },
          ],
          routeLinks: [
            {
              id: 'two.sample',
              parentRoute: { pluginId: 'two', routeId: 'two' },
              targetRoute: { pluginId: 'sample', routeId: 'sample' },
              menu: { label: '打开外部插件 sample', order: 10 },
            },
          ],
          modules: [
            {
              id: 'sample.two-demo',
              targetPluginId: 'two',
              routeId: 'two',
              slotId: 'two.demo',
              priority: 20,
              load,
            },
          ],
        },
        status: 'ready',
        diagnostics: [],
        errors: [],
      },
    ];
    useAuthMock.mockReturnValue({ can: () => true });
    usePluginRegistryMock.mockReturnValue(
      registry({
        registrations: topologyRegistrations,
        states: topologyRegistrations.map(({ plugin }) => ({ id: plugin?.manifest.id, enabled: true })),
        remoteConfigurations: [],
      }),
    );
    const user = setupUser();

    render(
      <MemoryRouter>
        <PluginCenterPage />
      </MemoryRouter>,
    );

    expect(screen.getByRole('heading', { name: '贡献关系' })).toBeInTheDocument();
    expect(within(screen.getByRole('table')).getByText('/plugin-sample')).toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: '页面入口 (1)' }));
    expect(within(screen.getByRole('table')).getByText('two/two')).toBeInTheDocument();
    expect(within(screen.getByRole('table')).getByText('sample/sample')).toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: '模块 (2)' }));
    expect(within(screen.getByRole('table')).getByText('host/dashboard')).toBeInTheDocument();
    expect(within(screen.getByRole('table')).getByText('two.demo')).toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: '开放插槽 (2)' }));
    expect(within(screen.getByRole('table')).getByText('dashboard.demo')).toBeInTheDocument();
    expect(within(screen.getByRole('table')).getByText('two.demo')).toBeInTheDocument();
  });
});
