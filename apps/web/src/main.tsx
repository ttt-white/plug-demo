import '@/styles.css';
import 'antd/dist/reset.css';
import { bootstrapApplication } from './app/bootstrap';

async function startMocks() {
  if (!import.meta.env.DEV || import.meta.env['VITE_ENABLE_MOCKS'] !== 'true') return;
  const { worker } = await import('./mocks/browser');
  await worker.start({ onUnhandledRequest: 'bypass' });
}

const root = document.getElementById('root');
if (!root) throw new Error('Root element is missing');
void bootstrapApplication(root, startMocks);
