import { PluginApiError } from '@tt-plug/plugin-sdk';
import { describe, expect, it, vi } from 'vitest';
import { createWorkspaceQueryClient } from './query-client';

const responseSchema = {
  parse(input: unknown) {
    if (typeof input !== 'object' || input === null || !('value' in input) || typeof input.value !== 'number') {
      throw new Error('invalid response');
    }
    return { value: input.value };
  },
};

describe('WorkspaceQueryClient', () => {
  it('deduplicates concurrent observers and reuses fresh cached data', async () => {
    const client = createWorkspaceQueryClient();
    let resolveRequest: ((value: unknown) => void) | undefined;
    const queryFn = vi.fn(
      () =>
        new Promise<unknown>((resolve) => {
          resolveRequest = resolve;
        }),
    );
    const options = { queryKey: ['test', 1] as const, queryFn, schema: responseSchema };
    const first = client.observe(options);
    const second = client.observe(options);

    const firstRequest = first.fetch();
    const secondRequest = second.fetch();
    expect(queryFn).toHaveBeenCalledOnce();
    resolveRequest?.({ value: 42 });

    await expect(firstRequest).resolves.toEqual({ value: 42 });
    await expect(secondRequest).resolves.toEqual({ value: 42 });
    await expect(second.fetch()).resolves.toEqual({ value: 42 });
    expect(queryFn).toHaveBeenCalledOnce();
    expect(second.getSnapshot()).toMatchObject({ status: 'success', data: { value: 42 }, isFetching: false });
  });

  it('rejects a response that violates its runtime schema without retrying', async () => {
    const client = createWorkspaceQueryClient();
    const queryFn = vi.fn().mockResolvedValue({ value: 'invalid' });
    const observer = client.observe({ queryKey: ['invalid'] as const, queryFn, schema: responseSchema, retry: 3 });

    await expect(observer.fetch()).rejects.toMatchObject({ name: 'QueryResponseValidationError' });
    expect(queryFn).toHaveBeenCalledOnce();
    expect(observer.getSnapshot()).toMatchObject({ status: 'error', isFetching: false });
  });

  it('cancels an in-flight request after its final observer unsubscribes', async () => {
    const client = createWorkspaceQueryClient();
    let requestSignal: AbortSignal | undefined;
    const observer = client.observe({
      queryKey: ['cancel'] as const,
      schema: responseSchema,
      queryFn: ({ signal }) => {
        requestSignal = signal;
        return new Promise((_, reject) => signal.addEventListener('abort', () => reject(signal.reason), { once: true }));
      },
    });
    const unsubscribe = observer.subscribe(() => undefined);
    const request = observer.fetch();
    unsubscribe();
    await new Promise<void>((resolve) => queueMicrotask(resolve));

    expect(requestSignal?.aborted).toBe(true);
    await expect(request).rejects.toMatchObject({ name: 'AbortError' });
    expect(observer.getSnapshot()).toMatchObject({ status: 'idle', isFetching: false });
  });

  it('retries retryable API failures but not permission failures', async () => {
    const client = createWorkspaceQueryClient();
    const retryable = vi.fn().mockRejectedValueOnce(new PluginApiError(503, 'unavailable')).mockResolvedValue({ value: 7 });
    const observer = client.observe({
      queryKey: ['retry'] as const,
      queryFn: retryable,
      schema: responseSchema,
      retry: 1,
      retryDelayMs: 0,
    });
    await expect(observer.fetch()).resolves.toEqual({ value: 7 });
    expect(retryable).toHaveBeenCalledTimes(2);

    const forbidden = vi.fn().mockRejectedValue(new PluginApiError(403, 'forbidden'));
    const forbiddenObserver = client.observe({
      queryKey: ['forbidden'] as const,
      queryFn: forbidden,
      schema: responseSchema,
      retry: 2,
    });
    await expect(forbiddenObserver.fetch()).rejects.toMatchObject({ status: 403 });
    expect(forbidden).toHaveBeenCalledOnce();
  });

  it('times out stalled requests and retries with a fresh signal', async () => {
    const client = createWorkspaceQueryClient();
    const signals: AbortSignal[] = [];
    const observer = client.observe({
      queryKey: ['timeout'] as const,
      schema: responseSchema,
      timeoutMs: 5,
      retry: 1,
      retryDelayMs: 0,
      queryFn: ({ signal }) => {
        signals.push(signal);
        return new Promise((_, reject) => signal.addEventListener('abort', () => reject(signal.reason), { once: true }));
      },
    });

    await expect(observer.fetch()).rejects.toMatchObject({ name: 'QueryTimeoutError' });
    expect(signals).toHaveLength(2);
    expect(signals.every((signal) => signal.aborted)).toBe(true);
  });
});
