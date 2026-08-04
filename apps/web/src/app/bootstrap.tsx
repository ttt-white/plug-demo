import type { ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { BootstrapError, RootApplication } from './RootApplication';

export async function bootstrapApplication(
  rootElement: HTMLElement,
  prepare: () => Promise<void>,
  application: ReactNode = <RootApplication />,
): Promise<Root> {
  const root = createRoot(rootElement);
  try {
    await prepare();
    root.render(application);
  } catch (error) {
    console.error('Application bootstrap failed', error);
    root.render(<BootstrapError error={error} />);
  }
  return root;
}
