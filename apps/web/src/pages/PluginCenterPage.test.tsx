import type { PluginRegistration } from '@fms/plugin-sdk';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { PluginCenterPage } from './PluginCenterPage';

const { useAuthMock, usePluginRegistryMock } = vi.hoisted(() => ({ useAuthMock: vi.fn(), usePluginRegistryMock: vi.fn() }));

vi.mock('@/auth/AuthProvider', () => ({ useAuth: useAuthMock }));
vi.mock('@/plugins/PluginRegistryProvider', () => ({ usePluginRegistry: usePluginRegistryMock }));

describe('PluginCenterPage diagnostics', () => {
  it('shows package identity and a staged load failure without requiring a manifest', () => {
    useAuthMock.mockReturnValue({ can: () => true });
    const registration: PluginRegistration = {
      source: {
        packageName: '@fms/plugin-broken',
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
      routes: [],
      reloadStates: vi.fn(),
      setEnabled: vi.fn(),
    });

    render(
      <MemoryRouter>
        <PluginCenterPage />
      </MemoryRouter>,
    );

    expect(screen.getByText('@fms/plugin-broken')).toBeInTheDocument();
    expect(screen.getByText('[load/PLUGIN_LOAD_FAILED] 插件包加载失败：top-level failed')).toBeInTheDocument();
    expect(screen.getByRole('switch', { name: '停用broken' })).toBeDisabled();
  });
});
