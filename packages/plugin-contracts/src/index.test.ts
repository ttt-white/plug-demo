import { describe, expect, it } from 'vitest';
import {
  carrierRatingsResponseSchema,
  dashboardSummarySchema,
  fmsDataContract,
  oneContract,
  reportsResponseSchema,
  threeContract,
  twoContract,
  workspaceContract,
} from './index';

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

  it('validates the shared FMS response DTOs at runtime', () => {
    expect(
      dashboardSummarySchema.safeParse({
        updatedAt: '2026-08-04 10:00',
        inTransit: 28,
        pendingDispatch: 6,
        exceptions: 3,
        completedToday: 42,
        onTimeRate: 96.7,
        metrics: [{ id: 'orders', label: '今日运输单', value: '326', change: 8.4 }],
      }).success,
    ).toBe(true);
    expect(reportsResponseSchema.safeParse({ rows: [{ amount: '18,600' }] }).success).toBe(false);
    expect(
      carrierRatingsResponseSchema.safeParse({
        updatedAt: '2026-08-04 10:00',
        rows: [{ id: 'c1', carrier: '东驰物流', level: 'A', score: 96, onTimeRate: 98.2, incidents: 1, trend: 2.4 }],
      }).success,
    ).toBe(false);
    expect(fmsDataContract.dashboard.queryKey).toEqual(['fms', 'dashboard']);
  });
});
