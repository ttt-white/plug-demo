import type { HostSlotReference } from '@tt-plug/plugin-sdk';
import { hostContract } from '../workspace';

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
