import { PluginApiError, type PluginApiClient, type PluginApiRequestOptions } from '@tt-plug/plugin-sdk';

export const TOKEN_STORAGE_KEY = 'fms.access-token';

type UnauthorizedHandler = () => void;
let unauthorizedHandler: UnauthorizedHandler | undefined;

export function setUnauthorizedHandler(handler: UnauthorizedHandler | undefined) {
  unauthorizedHandler = handler;
}

class WorkspaceApiClient implements PluginApiClient {
  private async request<T>(method: string, path: string, options: PluginApiRequestOptions = {}): Promise<T> {
    const { body: requestBody, ...fetchOptions } = options;
    const headers = new Headers(fetchOptions.headers);
    headers.set('Accept', 'application/json');
    const token = sessionStorage.getItem(TOKEN_STORAGE_KEY);
    if (token) headers.set('Authorization', `Bearer ${token}`);

    let body: BodyInit | undefined;
    if (requestBody !== undefined) {
      headers.set('Content-Type', 'application/json');
      body = JSON.stringify(requestBody);
    }

    const response = await fetch(path, {
      ...fetchOptions,
      method,
      headers,
      ...(body === undefined ? {} : { body }),
    });

    const payload = (await response.json().catch(() => null)) as unknown;
    if (!response.ok) {
      const message =
        payload && typeof payload === 'object' && 'message' in payload && typeof payload.message === 'string'
          ? payload.message
          : `请求失败 (${response.status})`;
      if (response.status === 401) unauthorizedHandler?.();
      throw new PluginApiError(response.status, message, payload);
    }
    return payload as T;
  }

  get<T>(path: string, options: PluginApiRequestOptions = {}) {
    return this.request<T>('GET', path, options);
  }

  post<T>(path: string, body?: unknown, options: PluginApiRequestOptions = {}) {
    return this.request<T>('POST', path, { ...options, body });
  }

  patch<T>(path: string, body?: unknown, options: PluginApiRequestOptions = {}) {
    return this.request<T>('PATCH', path, { ...options, body });
  }

  put<T>(path: string, body?: unknown, options: PluginApiRequestOptions = {}) {
    return this.request<T>('PUT', path, { ...options, body });
  }

  delete<T>(path: string, options: PluginApiRequestOptions = {}) {
    return this.request<T>('DELETE', path, options);
  }
}

export const apiClient = new WorkspaceApiClient();
