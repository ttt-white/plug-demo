import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';
import { fmsPluginDiscovery } from './fms-plugin-discovery';

export default defineConfig({
  plugins: [react(), fmsPluginDiscovery(fileURLToPath(new URL('.', import.meta.url)))],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
    conditions: ['development'],
    dedupe: ['react', 'react-dom', 'antd', '@fms/plugin-sdk', '@fms/plugin-shared'],
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    clearMocks: true,
  },
});
