// @vitest-environment jsdom

import {
  createPluginChannelBus,
  workspaceContract,
  type PluginQueryClient,
  type PluginRouteReference,
  type PluginRuntime,
} from '@tt-plug/plugin-sdk';
import '@testing-library/jest-dom/vitest';
import { act, cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { twoContract } from './contract';
import TwoPage from './TwoPage';

const query: PluginQueryClient = { observe: vi.fn(), invalidate: vi.fn(), clear: vi.fn() };

// 模拟一个主体之外的远程插件向 two 贡献入口，契约在本地声明。
const remotePluginRoute: PluginRouteReference<'sample', 'sample'> & { path: string } = {
  pluginId: 'sample',
  routeId: 'sample',
  path: '/plugin-sample',
};

afterEach(cleanup);

describe('TwoPage', () => {
  it('shows route params and receives typed direct and public messages', async () => {
    const bus = createPluginChannelBus();
    const navigateTo = vi.fn();
    const runtime: PluginRuntime = {
      pluginId: 'two',
      api: { get: vi.fn(), post: vi.fn(), patch: vi.fn() },
      query,
      user: { id: 'admin', username: 'admin', displayName: '管理员', role: 'admin', permissions: ['*'] },
      can: () => true,
      channel: bus.forPlugin('two'),
      contracts: { two: twoContract },
      extensions: {
        renderSlot: () => <div>sample 扩展模块</div>,
        routesFor: () => [
          {
            id: 'two.sample',
            pluginId: 'sample',
            targetRoute: remotePluginRoute,
            path: remotePluginRoute.path,
            label: '打开外部插件 sample',
            order: 10,
          },
        ],
        navigateTo,
      },
    };

    render(
      <MemoryRouter initialEntries={['/plugin-two?from=sample&message=路由消息']}>
        <TwoPage runtime={runtime} />
      </MemoryRouter>,
    );

    expect(screen.getByText('路由参数：sample: 路由消息')).toBeInTheDocument();
    expect(screen.getByText('sample 扩展模块')).toBeInTheDocument();

    act(() => bus.forPlugin('sample').publish(twoContract.channels.message, { message: '定向消息' }));
    expect(screen.getByText('定向消息：定向消息')).toBeInTheDocument();

    act(() => bus.forPlugin('sample').publishPublic(workspaceContract.channels.publicMessage, { message: '公共消息' }));
    expect(screen.getByText('公共消息：sample: 公共消息')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: '打开外部插件 sample' }));
    expect(navigateTo).toHaveBeenCalledWith(remotePluginRoute);
  });
});
