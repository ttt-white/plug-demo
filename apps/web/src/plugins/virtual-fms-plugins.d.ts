declare module 'virtual:fms-installed-plugins' {
  import type { WorkspacePlugin } from '@fms/plugin-sdk';

  export const installedPlugins: WorkspacePlugin[];
}
