import { describe, expect, it } from 'vitest';
import { plugin } from './index';

describe('three plugin manifest', () => {
  it('contributes one page, a typed two link and a two module', () => {
    const route = plugin.routes?.at(0);
    expect(plugin.manifest.id).toBe('three');
    expect(route).toMatchObject({
      id: 'three',
      path: '/carrier-ratings',
      permission: 'carrier-ratings:view',
    });
    expect(route?.load).toBeTypeOf('function');
    expect(plugin.routes).toHaveLength(1);
    expect(plugin.routeLinks?.at(0)).toMatchObject({
      id: 'two.three',
      parentRoute: { pluginId: 'two', routeId: 'two' },
      targetRoute: { pluginId: 'three', routeId: 'three' },
    });
    expect(plugin.modules?.at(0)).toMatchObject({
      id: 'three.two-summary',
      targetPluginId: 'two',
      routeId: 'two',
      slotId: 'two.summary',
    });
  });
});
