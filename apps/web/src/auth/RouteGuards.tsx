import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { ForbiddenPage } from '@/pages/ForbiddenPage';
import { useAuth } from './AuthProvider';

export function RequireAuth() {
  const { user } = useAuth();
  const location = useLocation();
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  return <Outlet />;
}

export function RequirePermission({ permission, children }: { permission: string; children: React.ReactNode }) {
  const { can } = useAuth();
  return can(permission) ? children : <ForbiddenPage />;
}
