import { plugin as dashboardMetricsPlugin } from '@fms/plugin-dashboard-metrics';
import { plugin as reportsPlugin } from '@fms/plugin-reports';
import type { WorkspacePlugin } from '@fms/plugin-sdk';

// Third-party packages are installed with pnpm and added to this explicit, auditable list.
export const installedPlugins: WorkspacePlugin[] = [dashboardMetricsPlugin, reportsPlugin];
