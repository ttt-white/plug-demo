import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import { fmsPluginDiscovery } from './fms-plugin-discovery';

export default defineConfig(({ command }) => ({
  plugins: [react(), fmsPluginDiscovery(fileURLToPath(new URL('.', import.meta.url))), tailwindcss()],
  // The only current public asset is MSW's development worker. Do not copy it into production builds.
  publicDir: command === 'serve' ? 'public' : false,
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
    dedupe: ['react', 'react-dom', 'antd', '@fms/plugin-contracts', '@fms/plugin-sdk'],
  },
  server: { host: true, port: 3000 },
}));
