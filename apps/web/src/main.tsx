import 'antd/dist/reset.css';
import '@/styles.css';
import { App as AntdApp, ConfigProvider } from 'antd';
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
        <ConfigProvider
          theme={{
            token: {
              colorPrimary: '#18794e',
              colorInfo: '#18794e',
              colorSuccess: '#18794e',
              borderRadius: 6,
              colorBgLayout: '#f3f6f4',
              colorText: '#1f2a24',
              fontFamily:
                "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif",
            },
            components: {
              Button: { controlHeight: 38 },
              Card: { headerFontSize: 16 },
              Menu: { horizontalItemSelectedColor: '#18794e', itemSelectedColor: '#18794e' },
            },
          }}
        >
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
