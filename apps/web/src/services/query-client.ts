import {
  PluginApiError,
  serializePluginQueryKey,
  type PluginQueryClient,
  type PluginQueryKey,
  type PluginQueryKeyPart,
  type PluginQueryObserver,
  type PluginQueryOptions,
  type PluginQuerySnapshot,
} from '@tt-plug/plugin-sdk';

const DEFAULT_STALE_TIME_MS = 30_000;
const DEFAULT_TIMEOUT_MS = 10_000;
const DEFAULT_RETRY_COUNT = 1;
const DEFAULT_RETRY_DELAY_MS = 200;
const CACHE_GC_TIME_MS = 5 * 60_000;

class QueryResponseValidationError extends Error {
  constructor(cause: unknown) {
    super('接口响应不符合数据契约', { cause });
    this.name = 'QueryResponseValidationError';
  }
}

class QueryTimeoutError extends Error {
  constructor(timeoutMs: number) {
    super(`请求超时（${timeoutMs}ms）`);
    this.name = 'QueryTimeoutError';
  }
}

interface ActiveRequest<TData> {
  promise: Promise<TData>;
  controller: AbortController | null;
  cancelled: boolean;
}

interface QueryEntry<TData> {
  snapshot: PluginQuerySnapshot<TData>;
  listeners: Set<() => void>;
  activeRequest: ActiveRequest<TData> | null;
  gcTimer: ReturnType<typeof setTimeout> | null;
}

const idleSnapshot = <TData>(): PluginQuerySnapshot<TData> => ({
  status: 'idle',
  data: undefined,
  error: null,
  isFetching: false,
  updatedAt: null,
});

function toError(reason: unknown) {
  if (reason instanceof Error) return reason;
  if (
    typeof reason === 'object' &&
    reason !== null &&
    'name' in reason &&
    typeof reason.name === 'string' &&
    'message' in reason &&
    typeof reason.message === 'string'
  ) {
    const error = new Error(reason.message, { cause: reason });
    error.name = reason.name;
    return error;
  }
  return new Error('查询失败', { cause: reason });
}

function abortError() {
  return new DOMException('查询已取消', 'AbortError');
}

function shouldRetry(error: Error) {
  if (error instanceof QueryResponseValidationError) return false;
  if (error.name === 'AbortError') return false;
  if (error instanceof PluginApiError) return error.status === 408 || error.status === 429 || error.status >= 500;
  return true;
}

function waitForRetry(delayMs: number, activeRequest: ActiveRequest<unknown>) {
  if (delayMs <= 0) return Promise.resolve();
  const controller = new AbortController();
  activeRequest.controller = controller;
  return new Promise<void>((resolve, reject) => {
    const timer = setTimeout(resolve, delayMs);
    controller.signal.addEventListener(
      'abort',
      () => {
        clearTimeout(timer);
        reject(controller.signal.reason ?? abortError());
      },
      { once: true },
    );
  });
}

export class WorkspaceQueryClient implements PluginQueryClient {
  private readonly entries = new Map<string, QueryEntry<unknown>>();
  private readonly ownerId: PluginQueryKeyPart;

  constructor(ownerId: PluginQueryKeyPart = null) {
    this.ownerId = ownerId;
  }

  observe<TData>(options: PluginQueryOptions<TData>): PluginQueryObserver<TData> {
    const cacheKey = this.serializeOwnedQueryKey(options.queryKey);
    const entry = this.getEntry<TData>(cacheKey);

    return {
      getSnapshot: () => entry.snapshot,
      subscribe: (listener) => {
        if (entry.gcTimer) {
          clearTimeout(entry.gcTimer);
          entry.gcTimer = null;
        }
        entry.listeners.add(listener);
        return () => {
          entry.listeners.delete(listener);
          if (entry.listeners.size > 0) return;
          queueMicrotask(() => {
            if (entry.listeners.size === 0) this.cancelEntry(entry);
          });
          entry.gcTimer = setTimeout(() => {
            if (entry.listeners.size === 0 && !entry.activeRequest) this.entries.delete(cacheKey);
          }, CACHE_GC_TIME_MS);
        };
      },
      fetch: () => this.fetchEntry(entry, options, false),
      refetch: () => this.fetchEntry(entry, options, true),
    };
  }

  invalidate(queryKey: PluginQueryKey) {
    const entry = this.entries.get(this.serializeOwnedQueryKey(queryKey));
    if (!entry || entry.snapshot.updatedAt === null) return;
    entry.snapshot = { ...entry.snapshot, updatedAt: 0 };
    this.notify(entry);
  }

  clear() {
    for (const entry of this.entries.values()) {
      if (entry.gcTimer) clearTimeout(entry.gcTimer);
      this.cancelEntry(entry);
    }
    this.entries.clear();
  }

  private getEntry<TData>(cacheKey: string) {
    const current = this.entries.get(cacheKey) as QueryEntry<TData> | undefined;
    if (current) return current;
    const entry: QueryEntry<TData> = {
      snapshot: idleSnapshot<TData>(),
      listeners: new Set(),
      activeRequest: null,
      gcTimer: null,
    };
    this.entries.set(cacheKey, entry as QueryEntry<unknown>);
    return entry;
  }

  private fetchEntry<TData>(entry: QueryEntry<TData>, options: PluginQueryOptions<TData>, force: boolean) {
    if (entry.activeRequest) return entry.activeRequest.promise;

    const staleTimeMs = options.staleTimeMs ?? DEFAULT_STALE_TIME_MS;
    const isFresh = entry.snapshot.updatedAt !== null && Date.now() - entry.snapshot.updatedAt < staleTimeMs;
    if (!force && entry.snapshot.data !== undefined && isFresh) return Promise.resolve(entry.snapshot.data);

    entry.snapshot = {
      ...entry.snapshot,
      status: entry.snapshot.data === undefined ? 'loading' : 'success',
      error: null,
      isFetching: true,
    };
    this.notify(entry);

    const activeRequest: ActiveRequest<TData> = {
      promise: Promise.resolve(undefined as TData),
      controller: null,
      cancelled: false,
    };
    const promise = this.execute(options, activeRequest)
      .then((data) => {
        if (activeRequest.cancelled) throw abortError();
        entry.snapshot = { status: 'success', data, error: null, isFetching: false, updatedAt: Date.now() };
        this.notify(entry);
        return data;
      })
      .catch((reason: unknown) => {
        const error = toError(reason);
        if (activeRequest.cancelled || error.name === 'AbortError') {
          entry.snapshot =
            entry.snapshot.data === undefined
              ? idleSnapshot<TData>()
              : { ...entry.snapshot, status: 'success', error: null, isFetching: false };
        } else {
          entry.snapshot = { ...entry.snapshot, status: 'error', error, isFetching: false };
        }
        this.notify(entry);
        throw error;
      })
      .finally(() => {
        if (entry.activeRequest === activeRequest) entry.activeRequest = null;
      });
    activeRequest.promise = promise;
    entry.activeRequest = activeRequest;
    return promise;
  }

  private async execute<TData>(options: PluginQueryOptions<TData>, activeRequest: ActiveRequest<TData>) {
    const retryCount = Math.max(0, options.retry ?? DEFAULT_RETRY_COUNT);
    const timeoutMs = Math.max(1, options.timeoutMs ?? DEFAULT_TIMEOUT_MS);
    const retryDelayMs = Math.max(0, options.retryDelayMs ?? DEFAULT_RETRY_DELAY_MS);

    for (let attempt = 0; ; attempt += 1) {
      if (activeRequest.cancelled) throw abortError();
      const controller = new AbortController();
      activeRequest.controller = controller;
      const timeout = setTimeout(() => controller.abort(new QueryTimeoutError(timeoutMs)), timeoutMs);
      try {
        const payload = await options.queryFn({ signal: controller.signal });
        try {
          return options.schema.parse(payload);
        } catch (reason) {
          throw new QueryResponseValidationError(reason);
        }
      } catch (reason) {
        const error = toError(controller.signal.aborted ? controller.signal.reason : reason);
        if (attempt >= retryCount || !shouldRetry(error)) throw error;
        await waitForRetry(retryDelayMs * 2 ** attempt, activeRequest as ActiveRequest<unknown>);
      } finally {
        clearTimeout(timeout);
      }
    }
  }

  private cancelEntry<TData>(entry: QueryEntry<TData>) {
    if (!entry.activeRequest) return;
    entry.activeRequest.cancelled = true;
    entry.activeRequest.controller?.abort(abortError());
  }

  private notify(entry: QueryEntry<unknown>) {
    for (const listener of entry.listeners) listener();
  }

  private serializeOwnedQueryKey(queryKey: PluginQueryKey) {
    serializePluginQueryKey(queryKey);
    return serializePluginQueryKey([this.ownerId, ...queryKey]);
  }
}

export function createWorkspaceQueryClient(ownerId: PluginQueryKeyPart = null) {
  return new WorkspaceQueryClient(ownerId);
}
