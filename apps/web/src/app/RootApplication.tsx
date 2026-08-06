import { AuthProvider } from '@/auth/AuthProvider';
import { PluginRegistryProvider } from '@/plugins/PluginRegistryProvider';
import { App as AntdApp, ConfigProvider } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import { BrowserRouter } from 'react-router-dom';
import { App } from './App';

export function RootApplication() {
  return (
    <BrowserRouter>
      <ConfigProvider locale={zhCN}>
        <AntdApp>
          <AuthProvider>
            <PluginRegistryProvider>
              <App />
            </PluginRegistryProvider>
          </AuthProvider>
        </AntdApp>
      </ConfigProvider>
    </BrowserRouter>
  );
}

export function BootstrapError({ error }: { error: unknown }) {
  const message = error instanceof Error ? error.message : String(error);
  return (
    <main className="grid min-h-screen place-items-center bg-neutral-50 p-4" role="alert">
      <div className="w-full max-w-120 border border-red-200 bg-white p-6">
        <h1 className="text-lg font-semibold text-neutral-950">应用启动失败</h1>
        <p className="mt-2 text-sm text-neutral-600">{message}</p>
        <button
          className="mt-5 cursor-pointer border border-neutral-300 bg-white px-3 py-2 text-sm font-medium text-neutral-900 transition-colors duration-200 hover:bg-neutral-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
          type="button"
          onClick={() => window.location.reload()}
        >
          重新加载
        </button>
      </div>
    </main>
  );
}
