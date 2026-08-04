import {
  PLUGIN_API_VERSION,
  createPluginChannelBus,
  type PluginComponentLoader,
  type PluginQueryClient,
  type PluginRuntime,
  type WorkspacePlugin,
} from '@fms/plugin-sdk';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ResolvedRoute } from './PluginRegistryProvider';
import { PluginPageRenderer } from './PluginRenderer';

const { usePluginRegistryMock } = vi.hoisted(() => ({ usePluginRegistryMock: vi.fn() }));

vi.mock('./PluginRegistryProvider', () => ({ usePluginRegistry: usePluginRegistryMock }));

const runtime: PluginRuntime = {
  pluginId: 'retry-plugin',
  api: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
  },
  query: {
    observe: vi.fn() as PluginQueryClient['observe'],
    invalidate: vi.fn(),
    clear: vi.fn(),
  },
  user: {
    id: 'test-user',
    username: 'tester',
    displayName: '测试用户',
    role: 'admin',
    permissions: ['*'],
  },
  can: () => true,
  channel: createPluginChannelBus().forPlugin('retry-plugin'),
  extensions: {
    renderSlot: (_, fallback) => fallback ?? null,
    routesFor: () => [],
    navigateTo: vi.fn(),
  },
};

beforeEach(() => {
  usePluginRegistryMock.mockReturnValue({ runtimeFor: () => runtime, modulesFor: () => [] });
});

describe('PluginPageRenderer', () => {
  it('creates a fresh lazy component when retrying a failed plugin loader', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const loader = vi
      .fn()
      .mockRejectedValueOnce(new Error('temporary chunk failure'))
      .mockResolvedValueOnce({ default: () => <div>插件恢复成功</div> }) as PluginComponentLoader;
    const plugin: WorkspacePlugin = {
      manifest: {
        id: 'retry-plugin',
        name: '重试插件',
        version: '1.0.0',
        apiVersion: PLUGIN_API_VERSION,
      },
    };
    const route: ResolvedRoute = {
      plugin,
      contribution: {
        id: 'retry-page',
        path: '/retry',
        permission: 'retry:view',
        menu: { label: '重试', order: 1 },
        load: loader,
      },
    };

    const user = userEvent.setup();
    render(<PluginPageRenderer route={route} />);

    expect(await screen.findByText('重试插件暂不可用')).toBeInTheDocument();
    expect(loader).toHaveBeenCalledOnce();
    await user.click(screen.getByRole('button', { name: '重试' }));

    expect(await screen.findByText('插件恢复成功')).toBeInTheDocument();
    expect(loader).toHaveBeenCalledTimes(2);
    consoleError.mockRestore();
  });
});
