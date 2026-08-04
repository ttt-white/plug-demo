import { server } from '@/mocks/server';
import { http, HttpResponse } from 'msw';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { apiClient, setUnauthorizedHandler, TOKEN_STORAGE_KEY } from './api-client';

afterEach(() => setUnauthorizedHandler(undefined));

describe('apiClient', () => {
  it('injects the bearer token', async () => {
    sessionStorage.setItem(TOKEN_STORAGE_KEY, 'test-token');
    server.use(
      http.get('/api/test-auth', ({ request }) => HttpResponse.json({ authorization: request.headers.get('Authorization') })),
    );
    await expect(apiClient.get<{ authorization: string }>('/api/test-auth')).resolves.toEqual({
      authorization: 'Bearer test-token',
    });
  });

  it('notifies on 401 but keeps a 403 as a regular API error', async () => {
    const unauthorized = vi.fn();
    setUnauthorizedHandler(unauthorized);
    server.use(
      http.get('/api/forbidden-test', () => HttpResponse.json({ message: 'forbidden' }, { status: 403 })),
      http.get('/api/unauthorized-test', () => HttpResponse.json({ message: 'unauthorized' }, { status: 401 })),
    );

    await expect(apiClient.get('/api/forbidden-test')).rejects.toMatchObject({ status: 403 });
    expect(unauthorized).not.toHaveBeenCalled();
    await expect(apiClient.get('/api/unauthorized-test')).rejects.toMatchObject({ status: 401 });
    expect(unauthorized).toHaveBeenCalledOnce();
  });
});
