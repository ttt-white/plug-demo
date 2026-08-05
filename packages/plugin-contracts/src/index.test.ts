import { describe, expect, it } from 'vitest';
import { demoStatusSchema, fmsDataContract, oneContract, threeContract, twoContract, workspaceContract } from './index';

describe('workspace plugin contracts', () => {
  it('exposes typed routes, slots and channels for every demo plugin', () => {
    expect(workspaceContract.plugins).toEqual({ one: oneContract, two: twoContract, three: threeContract });
    expect(oneContract.targets.dashboard.slotId).toBe('dashboard.demo');
    expect(twoContract.routes.page.path).toBe('/plugin-two');
    expect(twoContract.slots.demo.slotId).toBe('two.demo');
    expect(twoContract.channels.message.topic).toBe('two:message');
    expect(threeContract.routes.page.path).toBe('/plugin-three');
    expect(workspaceContract.channels.publicMessage.topic).toBe('workspace:public-message');
  });

  it('validates the only shared API payload', () => {
    expect(demoStatusSchema.safeParse({ message: 'ready', updatedAt: '2026-08-04 10:00' }).success).toBe(true);
    expect(demoStatusSchema.safeParse({ message: '' }).success).toBe(false);
    expect(fmsDataContract.status.queryKey).toEqual(['fms', 'demo-status']);
  });
});
