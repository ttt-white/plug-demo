// @vitest-environment jsdom

import { threeContract, twoContract, workspaceContract } from '@fms/plugin-contracts';
import { createPluginChannelBus, type PluginQueryClient, type PluginRuntime } from '@fms/plugin-sdk';
import '@testing-library/jest-dom/vitest';
import { act, cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import TwoPage from './TwoPage';

const query: PluginQueryClient = { observe: vi.fn(), invalidate: vi.fn(), clear: vi.fn() };

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
      extensions: {
        renderSlot: () => <div>three 扩展模块</div>,
        routesFor: () => [
          {
            id: 'two.three',
            pluginId: 'three',
            targetRoute: threeContract.routes.page,
            path: threeContract.routes.page.path,
            label: '打开外部插件 three',
            order: 10,
          },
        ],
        navigateTo,
      },
    };

    render(
      <MemoryRouter initialEntries={['/plugin-two?from=three&message=路由消息']}>
        <TwoPage runtime={runtime} />
      </MemoryRouter>,
    );

    expect(screen.getByText('路由参数：three: 路由消息')).toBeInTheDocument();
    expect(screen.getByText('three 扩展模块')).toBeInTheDocument();

    act(() => bus.forPlugin('three').publish(twoContract.channels.message, { message: '定向消息' }));
    expect(screen.getByText('定向消息：定向消息')).toBeInTheDocument();

    act(() => bus.forPlugin('three').publishPublic(workspaceContract.channels.publicMessage, { message: '公共消息' }));
    expect(screen.getByText('公共消息：three: 公共消息')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: '打开外部插件 three' }));
    expect(navigateTo).toHaveBeenCalledWith(threeContract.routes.page);
  });
});
