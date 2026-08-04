declare module 'virtual:fms-installed-plugins' {
  import type { PluginPackageDescriptor } from '@fms/plugin-sdk';

  export const installedPluginDescriptors: PluginPackageDescriptor[];
}
