import { useAuth } from '@/auth/AuthProvider';
import { RequireAuth, RequirePermission } from '@/auth/RouteGuards';
import { FullScreenLoading } from '@/components/FullScreenLoading';
import { DashboardPage } from '@/pages/DashboardPage';
import { ForbiddenPage } from '@/pages/ForbiddenPage';
import { LoginPage } from '@/pages/LoginPage';
import { NotFoundPage } from '@/pages/NotFoundPage';
import { PluginCenterPage } from '@/pages/PluginCenterPage';
import { usePluginRegistry } from '@/plugins/PluginRegistryProvider';
import { PluginPageRenderer } from '@/plugins/PluginRenderer';
import type { ReactNode } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { AppLayout } from './AppLayout';
import { getWorkspaceHome, HOST_ROUTE_CATALOG, LOGIN_PATH, safeReturnPath, type HostRouteId } from './route-catalog';

const hostRouteElements: Record<HostRouteId, ReactNode> = {
  dashboard: <DashboardPage />,
  plugins: <PluginCenterPage />,
  forbidden: <ForbiddenPage />,
};

export function App() {
  const { user, bootstrapping, can } = useAuth();
  const { routes, loading: pluginsLoading } = usePluginRegistry();
  const location = useLocation();
  if (bootstrapping) return <FullScreenLoading />;

  const loginState = location.state as { from?: string } | null;
  const workspaceHome = getWorkspaceHome(can, routes);
  const authenticatedDestination = safeReturnPath(loginState?.from) ?? workspaceHome;

  return (
    <Routes>
      <Route
        path={LOGIN_PATH}
        element={
          user ? (
            pluginsLoading ? (
              <FullScreenLoading label="正在读取工作区入口" />
            ) : (
              <Navigate to={authenticatedDestination} replace />
            )
          ) : (
            <LoginPage />
          )
        }
      />
      <Route element={<RequireAuth />}>
        <Route element={<AppLayout />}>
          <Route
            index
            element={pluginsLoading ? <FullScreenLoading label="正在读取工作区入口" /> : <Navigate to={workspaceHome} replace />}
          />
          {HOST_ROUTE_CATALOG.map((route) => (
            <Route
              key={route.id}
              path={route.path.slice(1)}
              element={
                route.permission ? (
                  <RequirePermission permission={route.permission}>{hostRouteElements[route.id]}</RequirePermission>
                ) : (
                  hostRouteElements[route.id]
                )
              }
            />
          ))}
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
