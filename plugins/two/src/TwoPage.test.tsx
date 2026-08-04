// @vitest-environment jsdom

import { twoContract, type ReportsResponse } from '@fms/plugin-contracts';
import { createPluginChannelBus, type PluginQueryClient, type PluginQueryOptions, type PluginRuntime } from '@fms/plugin-sdk';
import '@testing-library/jest-dom/vitest';
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import TwoPage from './TwoPage';

window.matchMedia = vi.fn().mockImplementation(
  (query: string): MediaQueryList => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(() => false),
  }),
);

class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}

vi.stubGlobal('ResizeObserver', ResizeObserverMock);

const getComputedStyle = window.getComputedStyle.bind(window);
window.getComputedStyle = (element) => getComputedStyle(element);

const reports: ReportsResponse = {
  updatedAt: '2026-08-04 10:00',
  total: 1,
  rows: [
    {
      id: 'FMS-001',
      origin: '苏州',
      destination: '上海',
      carrier: '东驰物流',
      status: '运输中',
      amount: 18600,
      updatedAt: '10:24',
    },
  ],
  facets: { carriers: ['东驰物流'], statuses: ['待处理', '运输中', '已完成', '异常'] },
};

function createQueryClient(observe: ReturnType<typeof vi.fn>): PluginQueryClient {
  return {
    observe: observe as PluginQueryClient['observe'],
    invalidate: vi.fn(),
    clear: vi.fn(),
  };
}

function LocationProbe() {
  const location = useLocation();
  return <output data-testid="location">{`${location.pathname}${location.search}`}</output>;
}

afterEach(cleanup);

describe('TwoPage', () => {
  it('updates its URL-backed query key when another plugin sends a carrier filter', async () => {
    const bus = createPluginChannelBus();
    const observe = vi.fn(<TData,>(_options: PluginQueryOptions<TData>) => {
      const snapshot = {
        status: 'success' as const,
        data: reports as TData,
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
    });
    const runtime: PluginRuntime = {
      pluginId: 'two',
      api: { get: vi.fn(), post: vi.fn(), patch: vi.fn() },
      query: createQueryClient(observe),
      user: {
        id: 'admin',
        username: 'admin',
        displayName: '管理员',
        role: 'admin',
        permissions: ['*'],
      },
      can: () => true,
      channel: bus.forPlugin('two'),
      extensions: { renderSlot: () => null, routesFor: () => [], navigateTo: vi.fn() },
    };

    render(
      <MemoryRouter initialEntries={['/reports']}>
        <LocationProbe />
        <TwoPage runtime={runtime} />
      </MemoryRouter>,
    );
    expect(await screen.findByRole('cell', { name: 'FMS-001' })).toBeInTheDocument();

    act(() => bus.forPlugin('three').publish(twoContract.channels.filterCarrier, { carrier: '东驰物流' }));

    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('carrier=%E4%B8%9C%E9%A9%B0%E7%89%A9%E6%B5%81'));
    const lastOptions = observe.mock.calls.at(-1)?.[0] as PluginQueryOptions<unknown> | undefined;
    expect(lastOptions?.queryKey).toContain('东驰物流');
  });
});
