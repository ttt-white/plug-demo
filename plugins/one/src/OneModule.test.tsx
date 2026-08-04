// @vitest-environment jsdom

import type { DashboardSummary } from '@fms/plugin-contracts';
import { createPluginChannelBus, type PluginQueryClient, type PluginQueryOptions, type PluginRuntime } from '@fms/plugin-sdk';
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import OneModule from './OneModule';

const dashboard: DashboardSummary = {
  updatedAt: '2026-08-04 10:00',
  inTransit: 28,
  pendingDispatch: 6,
  exceptions: 3,
  completedToday: 42,
  onTimeRate: 96.7,
  metrics: [
    { id: 'revenue', label: '本月结算额', value: '¥ 1.28M', change: 12.8 },
    { id: 'ontime', label: '准时交付率', value: '96.7%', change: -0.6 },
  ],
};

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
  return {
    pluginId: 'one',
    api: { get: vi.fn(), post: vi.fn(), patch: vi.fn() },
    query: queryWith(dashboard),
    user: {
      id: 'admin',
      username: 'admin',
      displayName: '管理员',
      role: 'admin',
      permissions: ['*'],
    },
    can: () => true,
    channel: createPluginChannelBus().forPlugin('one'),
    extensions: { renderSlot: (_, fallback) => fallback ?? null, routesFor: () => [], navigateTo: vi.fn() },
  };
}

afterEach(cleanup);

describe('OneModule', () => {
  it('renders dashboard metrics from the shared query snapshot', () => {
    render(<OneModule runtime={createRuntime()} />);

    expect(screen.getByRole('heading', { name: '业务指标' })).toBeInTheDocument();
    expect(screen.getByText('本月结算额')).toBeInTheDocument();
    expect(screen.getByText('¥ 1.28M')).toBeInTheDocument();
    expect(screen.getByText('0.6%')).toHaveClass('text-red-700');
  });
});
