import {
  PLUGIN_API_VERSION,
  createPluginChannelBus,
  type PluginComponentLoader,
  type PluginQueryClient,
  type PluginRuntime,
  type WorkspacePlugin,
} from '@tt-plug/plugin-sdk';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { act, startTransition } from 'react';
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

  it('resets the suspense boundary when switching between plugin routes', async () => {
    let resolveSecondRoute: ((value: { default: () => React.JSX.Element }) => void) | undefined;
    const secondRouteResult = new Promise<{ default: () => React.JSX.Element }>((resolve) => {
      resolveSecondRoute = resolve;
    });
    const firstPlugin: WorkspacePlugin = {
      manifest: {
        id: 'first-plugin',
        name: '第一个插件',
        version: '1.0.0',
        apiVersion: PLUGIN_API_VERSION,
      },
    };
    const secondPlugin: WorkspacePlugin = {
      manifest: {
        id: 'second-plugin',
        name: '第二个插件',
        version: '1.0.0',
        apiVersion: PLUGIN_API_VERSION,
      },
    };
    const firstRoute: ResolvedRoute = {
      plugin: firstPlugin,
      contribution: {
        id: 'first-page',
        path: '/first',
        permission: 'first:view',
        menu: { label: '第一个页面', order: 1 },
        load: () => Promise.resolve({ default: () => <div>第一个插件页面</div> }),
      },
    };
    const secondRoute: ResolvedRoute = {
      plugin: secondPlugin,
      contribution: {
        id: 'second-page',
        path: '/second',
        permission: 'second:view',
        menu: { label: '第二个页面', order: 2 },
        load: () => secondRouteResult,
      },
    };

    const view = render(<PluginPageRenderer route={firstRoute} />);
    expect(await screen.findByText('第一个插件页面')).toBeInTheDocument();

    act(() => {
      startTransition(() => view.rerender(<PluginPageRenderer route={secondRoute} />));
    });

    expect(screen.queryByText('第一个插件页面')).not.toBeInTheDocument();
    expect(screen.getByText('正在加载插件')).toBeInTheDocument();

    resolveSecondRoute?.({ default: () => <div>第二个插件页面</div> });
    expect(await screen.findByText('第二个插件页面')).toBeInTheDocument();
  });
});
