import { z } from 'zod';
import type { HostRouteReference, HostSlotReference, PluginPublicChannelReference } from './index';

export const demoStatusSchema = z.object({
  message: z.string().min(1),
  updatedAt: z.string().min(1),
});

export type DemoStatus = z.infer<typeof demoStatusSchema>;

export const dataContract = {
  status: {
    path: '/api/demo-status',
    queryKey: ['workspace', 'demo-status'] as const,
    schema: demoStatusSchema,
  },
} as const;

export interface PluginMessagePayload {
  message: string;
}

export interface HostContract {
  readonly routes: {
    readonly dashboard: HostRouteReference<'dashboard'> & { readonly path: '/dashboard' };
  };
  readonly slots: {
    readonly dashboard: HostSlotReference<'dashboard', 'dashboard.demo'>;
  };
}

export const hostContract: HostContract = {
  routes: {
    dashboard: { path: '/dashboard', routeId: 'dashboard' },
  },
  slots: {
    dashboard: { routeId: 'dashboard', slotId: 'dashboard.demo' },
  },
};

export interface WorkspaceContract {
  readonly host: HostContract;
  readonly channels: {
    readonly publicMessage: PluginPublicChannelReference<PluginMessagePayload, 'workspace:public-message'>;
  };
}

export const workspaceContract: WorkspaceContract = {
  host: hostContract,
  channels: {
    publicMessage: { topic: 'workspace:public-message' },
  },
};
