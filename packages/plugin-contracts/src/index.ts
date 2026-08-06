import type {
  HostRouteReference,
  HostSlotReference,
  PluginChannelReference,
  PluginPublicChannelReference,
  PluginRouteReference,
  PluginSlotReference,
} from '@tt-plug/plugin-sdk';
import { z } from 'zod';

export const demoStatusSchema = z.object({
  message: z.string().min(1),
  updatedAt: z.string().min(1),
});

export type DemoStatus = z.infer<typeof demoStatusSchema>;

export const fmsDataContract = {
  status: {
    path: '/api/demo-status',
    queryKey: ['fms', 'demo-status'] as const,
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

export interface OnePluginContract {
  readonly pluginId: 'one';
  readonly targets: {
    readonly dashboard: HostSlotReference<'dashboard', 'dashboard.demo'> & { readonly path: '/dashboard' };
  };
}

export const oneContract: OnePluginContract = {
  pluginId: 'one',
  targets: {
    dashboard: { ...hostContract.routes.dashboard, ...hostContract.slots.dashboard },
  },
};

export interface TwoPluginContract {
  readonly pluginId: 'two';
  readonly routes: {
    readonly page: PluginRouteReference<'two', 'two'> & { readonly path: '/plugin-two' };
  };
  readonly slots: {
    readonly demo: PluginSlotReference<'two', 'two', 'two.demo'>;
  };
  readonly channels: {
    readonly message: PluginChannelReference<PluginMessagePayload, 'two', 'two:message'>;
  };
}

export const twoContract: TwoPluginContract = {
  pluginId: 'two',
  routes: {
    page: { path: '/plugin-two', pluginId: 'two', routeId: 'two' },
  },
  slots: {
    demo: { pluginId: 'two', routeId: 'two', slotId: 'two.demo' },
  },
  channels: {
    message: { pluginId: 'two', topic: 'two:message' },
  },
};

export interface ThreePluginContract {
  readonly pluginId: 'three';
  readonly routes: {
    readonly page: PluginRouteReference<'three', 'three'> & { readonly path: '/plugin-three' };
  };
}

export const threeContract: ThreePluginContract = {
  pluginId: 'three',
  routes: {
    page: { path: '/plugin-three', pluginId: 'three', routeId: 'three' },
  },
};

export interface WorkspaceContract {
  readonly host: HostContract;
  readonly plugins: {
    readonly one: OnePluginContract;
    readonly two: TwoPluginContract;
    readonly three: ThreePluginContract;
  };
  readonly channels: {
    readonly publicMessage: PluginPublicChannelReference<PluginMessagePayload, 'workspace:public-message'>;
  };
}

export const workspaceContract: WorkspaceContract = {
  host: hostContract,
  plugins: { one: oneContract, two: twoContract, three: threeContract },
  channels: {
    publicMessage: { topic: 'workspace:public-message' },
  },
};
