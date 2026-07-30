import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { PluginContainer, PluginErrorBoundary, type PluginContentState } from './index';

describe('PluginContainer', () => {
  it.each([
    ['loading', '正在加载内容'],
    ['empty', '暂无可展示的数据'],
    ['error', '内容加载失败'],
    ['forbidden', '你没有查看此内容的权限'],
    ['offline', '网络连接不可用'],
  ] as const)('renders the %s fallback', (status, label) => {
    render(<PluginContainer state={{ status } as PluginContentState<never>}>{() => null}</PluginContainer>);
    expect(screen.getByText(label)).toBeInTheDocument();
  });

  it('renders ready content and retries recoverable failures', () => {
    const retry = vi.fn();
    const { rerender } = render(
      <PluginContainer state={{ status: 'error' }} onRetry={retry}>
        {() => null}
      </PluginContainer>,
    );
    fireEvent.click(screen.getByRole('button', { name: '重试' }));
    expect(retry).toHaveBeenCalledOnce();

    rerender(<PluginContainer state={{ status: 'ready', data: 'ok' }}>{(data) => <span>{data}</span>}</PluginContainer>);
    expect(screen.getByText('ok')).toBeInTheDocument();
  });
});

describe('PluginErrorBoundary', () => {
  it('isolates a render failure', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const Broken = () => {
      throw new Error('broken');
    };
    render(
      <PluginErrorBoundary>
        <Broken />
      </PluginErrorBoundary>,
    );
    expect(screen.getByText('插件暂不可用')).toBeInTheDocument();
  });
});
