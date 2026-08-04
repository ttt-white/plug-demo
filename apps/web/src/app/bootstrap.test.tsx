import { act, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { bootstrapApplication } from './bootstrap';

let mountedRoot: Awaited<ReturnType<typeof bootstrapApplication>> | undefined;

afterEach(() => {
  if (mountedRoot) {
    act(() => mountedRoot?.unmount());
    mountedRoot = undefined;
  }
});

describe('bootstrapApplication', () => {
  it('renders the application after preparation succeeds', async () => {
    const rootElement = document.createElement('div');
    document.body.append(rootElement);
    await act(async () => {
      mountedRoot = await bootstrapApplication(rootElement, async () => undefined, <div>workspace ready</div>);
    });

    expect(screen.getByText('workspace ready')).toBeInTheDocument();
  });

  it('renders a recoverable error when preparation fails', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const rootElement = document.createElement('div');
    document.body.append(rootElement);

    await act(async () => {
      mountedRoot = await bootstrapApplication(rootElement, async () => {
        throw new Error('Mock worker failed');
      });
    });

    expect(screen.getByRole('alert')).toHaveTextContent('应用启动失败');
    expect(screen.getByText('Mock worker failed')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '重新加载' })).toBeInTheDocument();
    expect(error).toHaveBeenCalledOnce();
    error.mockRestore();
  });
});
