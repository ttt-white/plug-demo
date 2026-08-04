import { useEffect, useMemo, useSyncExternalStore } from 'react';

/** 可稳定序列化的查询键片段。 */
export type PluginQueryKeyPart = string | number | boolean | null;

/** 跨宿主和插件共享缓存时使用的查询键。 */
export type PluginQueryKey = readonly PluginQueryKeyPart[];

/** 与 Zod 等运行时校验器兼容的最小 Schema 协议。 */
export interface PluginQuerySchema<TData> {
  parse(input: unknown): TData;
}

/** 查询函数可使用的取消信号。 */
export interface PluginQueryFunctionContext {
  signal: AbortSignal;
}

/** 单次查询的缓存、超时和重试配置。 */
export interface PluginQueryOptions<TData> {
  queryKey: PluginQueryKey;
  queryFn(context: PluginQueryFunctionContext): Promise<unknown>;
  schema: PluginQuerySchema<TData>;
  staleTimeMs?: number;
  timeoutMs?: number;
  retry?: number;
  retryDelayMs?: number;
}

/** 查询在任意时刻暴露给页面的稳定快照。 */
export interface PluginQuerySnapshot<TData> {
  status: 'idle' | 'loading' | 'success' | 'error';
  data: TData | undefined;
  error: Error | null;
  isFetching: boolean;
  updatedAt: number | null;
}

/** 单个查询观察器；同 key 的观察器共享宿主缓存和正在进行的请求。 */
export interface PluginQueryObserver<TData> {
  getSnapshot(): PluginQuerySnapshot<TData>;
  subscribe(listener: () => void): () => void;
  fetch(): Promise<TData>;
  refetch(): Promise<TData>;
}

/** 宿主提供的共享查询能力。 */
export interface PluginQueryClient {
  observe<TData>(options: PluginQueryOptions<TData>): PluginQueryObserver<TData>;
  invalidate(queryKey: PluginQueryKey): void;
  clear(): void;
}

/** 将查询键转换为稳定缓存键；键片段仅允许 JSON 原始值。 */
export function serializePluginQueryKey(queryKey: PluginQueryKey) {
  if (queryKey.length === 0) throw new Error('查询键不能为空');
  return JSON.stringify(queryKey);
}

/**
 * 订阅宿主 Query Client。组件卸载后会解除订阅；最后一个订阅者离开时，宿主可以取消请求。
 */
export function usePluginQuery<TData>(client: PluginQueryClient, options: PluginQueryOptions<TData>) {
  const serializedKey = serializePluginQueryKey(options.queryKey);
  // queryKey 是查询身份；同一身份必须使用同一 queryFn 和 schema。
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const observer = useMemo(() => client.observe(options), [client, serializedKey]);
  const snapshot = useSyncExternalStore(observer.subscribe, observer.getSnapshot, observer.getSnapshot);

  useEffect(() => {
    void observer.fetch().catch(() => undefined);
  }, [observer]);

  return useMemo(
    () => ({
      ...snapshot,
      refetch: observer.refetch,
    }),
    [observer.refetch, snapshot],
  );
}
