import { federation } from '@module-federation/vite';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import { pluginDiscovery } from './plugin-discovery';

export default defineConfig(({ command }) => {
  return {
    plugins: [
      react(),
      pluginDiscovery(fileURLToPath(new URL('.', import.meta.url))),
      federation({
        name: 'host',
        shared: {
          react: { singleton: true, requiredVersion: '^19.0.0' },
          'react-dom': { singleton: true, requiredVersion: '^19.0.0' },
          antd: { singleton: true, requiredVersion: '^6.0.0' },
          'lucide-react': { singleton: true, requiredVersion: '^0.468.0' },
          '@tt-plug/plugin-contracts': { singleton: true, requiredVersion: '^1.0.0' },
          '@tt-plug/plugin-sdk': { singleton: true, requiredVersion: '^1.0.0' },
        },
        dts: false,
        dev: { remoteHmr: 'full-reload' },
      }),
      tailwindcss(),
    ],
    // The only current public asset is MSW's development worker. Do not copy it into production builds.
    publicDir: command === 'serve' ? 'public' : false,
    resolve: {
      alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
      dedupe: ['react', 'react-dom', 'antd', '@tt-plug/plugin-contracts', '@tt-plug/plugin-sdk'],
    },
    server: { host: true, port: 3000 },
  };
});
