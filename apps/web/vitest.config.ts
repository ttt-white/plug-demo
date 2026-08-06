import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';
import { fmsPluginDiscovery } from './fms-plugin-discovery';

export default defineConfig({
  plugins: [react(), fmsPluginDiscovery(fileURLToPath(new URL('.', import.meta.url)))],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      '@module-federation/runtime': fileURLToPath(new URL('./src/test/module-federation-runtime.ts', import.meta.url)),
      'plugin_three/plugin': fileURLToPath(new URL('../../../扩展插件/three/src/index.ts', import.meta.url)),
    },
    conditions: ['development'],
    dedupe: ['react', 'react-dom', 'antd', '@tt-plug/plugin-contracts', '@tt-plug/plugin-sdk'],
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    clearMocks: true,
    testTimeout: 10000,
  },
});
