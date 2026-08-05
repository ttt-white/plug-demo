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
      refreshing: false,
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

  it('shows an unavailable remote plugin as offline with its service address', () => {
    useAuthMock.mockReturnValue({ can: () => true });
    const registration: PluginRegistration = {
      source: {
        packageName: 'remote:three',
        packageVersion: '0.0.0',
        declaredPluginId: 'three',
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
      states: [{ id: 'three', enabled: true }],
      statesState: { status: 'ready', states: [{ id: 'three', enabled: true }], error: null },
      loading: false,
      refreshing: false,
      routes: [],
      reloadStates: vi.fn(),
      setEnabled: vi.fn(),
    });

    render(
      <MemoryRouter>
        <PluginCenterPage />
      </MemoryRouter>,
    );

    expect(screen.getByText('离线')).toBeInTheDocument();
    expect(screen.getByText('http://localhost:3100')).toBeInTheDocument();
    expect(screen.getByRole('switch', { name: '停用three' })).toBeDisabled();
  });
});
