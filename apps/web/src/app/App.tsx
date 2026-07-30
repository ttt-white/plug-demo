import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { RequireAuth, RequirePermission } from '@/auth/RouteGuards';
import { useAuth } from '@/auth/AuthProvider';
import { FullScreenLoading } from '@/components/FullScreenLoading';
import { DashboardPage } from '@/pages/DashboardPage';
import { LoginPage } from '@/pages/LoginPage';
import { NotFoundPage } from '@/pages/NotFoundPage';
import { PluginCenterPage } from '@/pages/PluginCenterPage';
import { PluginPageRenderer } from '@/plugins/PluginRenderer';
import { usePluginRegistry } from '@/plugins/PluginRegistryProvider';
import { AppLayout } from './AppLayout';

export function App() {
  const { user, bootstrapping } = useAuth();
  const { routes, loading: pluginsLoading } = usePluginRegistry();
  const location = useLocation();
  if (bootstrapping) return <FullScreenLoading />;

  const loginState = location.state as { from?: string } | null;
  const authenticatedDestination = loginState?.from?.startsWith('/') ? loginState.from : '/dashboard';

  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to={authenticatedDestination} replace /> : <LoginPage />} />
      <Route element={<RequireAuth />}>
        <Route element={<AppLayout />}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route
            path="dashboard"
            element={
              <RequirePermission permission="dashboard:view">
                <DashboardPage />
              </RequirePermission>
            }
          />
          <Route
            path="plugins"
            element={
              <RequirePermission permission="plugins:manage">
                <PluginCenterPage />
              </RequirePermission>
            }
          />
          {!pluginsLoading &&
            routes.map((route) => (
              <Route
                key={`${route.plugin.manifest.id}:${route.contribution.id}`}
                path={route.contribution.path.slice(1)}
                element={
                  <RequirePermission permission={route.contribution.permission}>
                    <PluginPageRenderer route={route} />
                  </RequirePermission>
                }
              />
            ))}
          <Route path="*" element={pluginsLoading ? <FullScreenLoading label="正在加载插件" /> : <NotFoundPage />} />
        </Route>
      </Route>
    </Routes>
  );
}
