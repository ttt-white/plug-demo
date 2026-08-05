import { describe, expect, it } from 'vitest';
import { FORBIDDEN_PATH, getWorkspaceHome, safeReturnPath } from './route-catalog';

describe('route catalog', () => {
  it('selects the first accessible host or plugin route', () => {
    const pluginRoutes = [
      {
        contribution: {
          id: 'plugin-two',
          path: '/plugin-two',
          permission: 'demo:two:view',
          menu: { label: '插件 two', order: 30 },
          load: async () => ({ default: () => null }),
        },
      },
    ];

    expect(getWorkspaceHome((permission) => permission === 'dashboard:view', pluginRoutes)).toBe('/dashboard');
    expect(getWorkspaceHome((permission) => permission === 'demo:two:view', pluginRoutes)).toBe('/plugin-two');
    expect(getWorkspaceHome(() => false, pluginRoutes)).toBe(FORBIDDEN_PATH);
  });

  it('accepts only internal non-login return paths while preserving query and hash', () => {
    expect(safeReturnPath('/plugin-two?from=three#demo')).toBe('/plugin-two?from=three#demo');
    expect(safeReturnPath('//example.com/plugin-two')).toBeNull();
    expect(safeReturnPath('/login')).toBeNull();
    expect(safeReturnPath('/login#form')).toBeNull();
    expect(safeReturnPath('https://example.com')).toBeNull();
  });
});
