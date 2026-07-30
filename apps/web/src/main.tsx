import '@/styles.css';
import { App as AntdApp, ConfigProvider } from 'antd';
import 'antd/dist/reset.css';
import zhCN from 'antd/locale/zh_CN';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { App } from './app/App';
import { AuthProvider } from './auth/AuthProvider';
import { PluginRegistryProvider } from './plugins/PluginRegistryProvider';

async function startMocks() {
  if (import.meta.env['VITE_ENABLE_MOCKS'] !== 'false') {
    const { worker } = await import('./mocks/browser');
    await worker.start({ onUnhandledRequest: 'bypass' });
  }
}

void startMocks().then(() => {
  const root = document.getElementById('root');
  if (!root) throw new Error('Root element is missing');
  createRoot(root).render(
    <StrictMode>
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
    </StrictMode>,
  );
});
