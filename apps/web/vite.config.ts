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
      dedupe: ['react', 'react-dom', 'antd', '@tt-plug/plugin-sdk'],
    },
    optimizeDeps: {
      // 依赖扫描进不去 virtual:installed-plugins，也进不到 Federation 共享的 SDK 里，
      // 所以 SDK 的传递依赖只能在运行时被发现，触发「optimized dependencies changed. reloading」。
      // 那次重载会 abort 正在飞行的模块请求，包括 Federation 动态 import 的 __prebuild__ 共享模块，
      // 表现为 "Failed to fetch dynamically imported module: .../virtual:mf:...__prebuild__...js"。
      // pnpm 严格布局下 semver/zod 不能从 apps/web 直接解析，用「父包 > 子包」语法。
      include: ['@tt-plug/plugin-sdk > semver', '@tt-plug/plugin-sdk > zod'],
    },
    server: { host: true, port: 3000 },
  };
});
