import { describe, expect, it } from 'vitest';
import { oneContract, threeContract, twoContract, workspaceContract } from './index';

describe('workspace plugin contracts', () => {
  it('exposes every plugin config through one shared object', () => {
    expect(workspaceContract.plugins.one).toBe(oneContract);
    expect(workspaceContract.plugins.two).toBe(twoContract);
    expect(workspaceContract.plugins.three).toBe(threeContract);
    expect(oneContract.targets.dashboardMetrics.path).toBe('/dashboard');
    expect(twoContract.routes.two.path).toBe('/reports');
    expect(threeContract.routes.three.path).toBe('/carrier-ratings');
  });

  it('exposes one typed public message channel', () => {
    expect(workspaceContract.channels.publicMessage).toEqual({ topic: 'workspace:public-message' });
  });
});
