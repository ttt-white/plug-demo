declare module 'virtual:installed-plugins' {
  import type { PluginPackageDescriptor } from '@tt-plug/plugin-sdk';

  export const installedPluginDescriptors: PluginPackageDescriptor[];
}
