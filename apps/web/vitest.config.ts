import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';
import { pluginDiscovery } from './plugin-discovery';

export default defineConfig({
  plugins: [react(), pluginDiscovery(fileURLToPath(new URL('.', import.meta.url)))],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      '@module-federation/runtime': fileURLToPath(new URL('./src/test/module-federation-runtime.ts', import.meta.url)),
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
