import { describe, expect, it } from 'vitest';
import { FORBIDDEN_PATH, getWorkspaceHome, safeReturnPath } from './route-catalog';

describe('route catalog', () => {
  it('selects the first accessible host or plugin route', () => {
    const pluginRoutes = [
      {
        contribution: {
          id: 'reports',
          path: '/reports',
          permission: 'reports:view',
          menu: { label: '报表', order: 30 },
          load: async () => ({ default: () => null }),
        },
      },
    ];

    expect(getWorkspaceHome((permission) => permission === 'dashboard:view', pluginRoutes)).toBe('/dashboard');
    expect(getWorkspaceHome((permission) => permission === 'reports:view', pluginRoutes)).toBe('/reports');
    expect(getWorkspaceHome(() => false, pluginRoutes)).toBe(FORBIDDEN_PATH);
  });

  it('accepts only internal non-login return paths while preserving query and hash', () => {
    expect(safeReturnPath('/reports?carrier=east#summary')).toBe('/reports?carrier=east#summary');
    expect(safeReturnPath('//example.com/reports')).toBeNull();
    expect(safeReturnPath('/login')).toBeNull();
    expect(safeReturnPath('/login#form')).toBeNull();
    expect(safeReturnPath('https://example.com')).toBeNull();
  });
});
