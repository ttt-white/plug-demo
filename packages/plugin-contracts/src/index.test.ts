import { describe, expect, it } from 'vitest';
import { demoStatusSchema, dataContract, hostContract, oneContract, twoContract, workspaceContract } from './index';

describe('workspace plugin contracts', () => {
  it('shares typed host routes and slots with plugin targets', () => {
    expect(hostContract.routes.dashboard.path).toBe('/dashboard');
    expect(hostContract.slots.dashboard).toEqual({ routeId: 'dashboard', slotId: 'dashboard.demo' });
    expect(oneContract.targets.dashboard).toMatchObject(hostContract.slots.dashboard);
    expect(workspaceContract.host).toBe(hostContract);
  });

  it('re-exports every generated plugin contract through the barrel', () => {
    expect(oneContract.targets.dashboard.slotId).toBe('dashboard.demo');
    expect(twoContract.routes.page.path).toBe('/plugin-two');
    expect(twoContract.slots.demo.slotId).toBe('two.demo');
    expect(twoContract.channels.message.topic).toBe('two:message');
  });

  it('keeps the workspace channel free of plugin specific entries', () => {
    expect(workspaceContract.channels.publicMessage.topic).toBe('workspace:public-message');
    expect(Object.keys(workspaceContract).sort()).toEqual(['channels', 'host']);
  });

  it('validates the only shared API payload', () => {
    expect(demoStatusSchema.safeParse({ message: 'ready', updatedAt: '2026-08-04 10:00' }).success).toBe(true);
    expect(demoStatusSchema.safeParse({ message: '' }).success).toBe(false);
    expect(dataContract.status.queryKey).toEqual(['workspace', 'demo-status']);
  });
});
