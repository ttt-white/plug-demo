// @vitest-environment jsdom

import type { DemoStatus } from '@tt-plug/plugin-contracts';
import { createPluginChannelBus, type PluginQueryClient, type PluginQueryOptions, type PluginRuntime } from '@tt-plug/plugin-sdk';
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import OneModule from './OneModule';

const status: DemoStatus = { message: '共享 API 已就绪', updatedAt: '2026-08-04 10:00' };

function queryWith<TData>(data: TData): PluginQueryClient {
  return {
    observe<TObserved>(_options: PluginQueryOptions<TObserved>) {
      const snapshot = {
        status: 'success' as const,
        data: data as unknown as TObserved,
        error: null,
        isFetching: false,
        updatedAt: Date.now(),
      };
      return {
        getSnapshot: () => snapshot,
        subscribe: () => () => undefined,
        fetch: async () => snapshot.data,
        refetch: async () => snapshot.data,
      };
    },
    invalidate: vi.fn(),
    clear: vi.fn(),
  };
}

function createRuntime(): PluginRuntime {
  const bus = createPluginChannelBus();
  return {
    pluginId: 'one',
    api: { get: vi.fn(), post: vi.fn(), patch: vi.fn() },
    query: queryWith(status),
    user: { id: 'admin', username: 'admin', displayName: '管理员', role: 'admin', permissions: ['*'] },
    can: () => true,
    channel: bus.forPlugin('one'),
    extensions: { renderSlot: (_, fallback) => fallback ?? null, routesFor: () => [], navigateTo: vi.fn() },
  };
}

afterEach(cleanup);

describe('OneModule', () => {
  it('uses the runtime query, user, permission and public channel', async () => {
    render(<OneModule runtime={createRuntime()} />);
    expect(screen.getByRole('heading', { name: '插槽模块 one' })).toBeInTheDocument();
    expect(screen.getByText('共享 API 已就绪')).toBeInTheDocument();
    expect(screen.getByText('管理员 · 已授权')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: '发送公共消息' }));
    expect(await screen.findByText('公共消息：one: one 已就绪')).toBeInTheDocument();
  });
});
