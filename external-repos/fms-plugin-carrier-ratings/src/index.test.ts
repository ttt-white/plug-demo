import { describe, expect, it } from 'vitest';
import { plugin } from './index';

describe('carrier ratings plugin manifest', () => {
  it('contributes one protected page route', () => {
    const route = plugin.routes?.at(0);
    expect(plugin.manifest.id).toBe('carrier-ratings-page');
    expect(route).toMatchObject({
      id: 'carrier-ratings',
      path: '/carrier-ratings',
      permission: 'carrier-ratings:view',
    });
    expect(route?.load).toBeTypeOf('function');
  });
});
