import { getWorkspaceHome } from '@/app/route-catalog';
import { useAuth } from '@/auth/AuthProvider';
import { usePluginRegistry } from '@/plugins/PluginRegistryProvider';
import { Button, Result } from 'antd';
import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export function NotFoundPage() {
  const { can } = useAuth();
  const { routes } = usePluginRegistry();
  const navigate = useNavigate();
  const workspaceHome = getWorkspaceHome(can, routes);
  return (
    <Result
      className="grid min-h-96 place-content-center"
      extra={
        <Button icon={<ArrowLeft aria-hidden="true" size={16} />} onClick={() => void navigate(workspaceHome)}>
          返回工作区
        </Button>
      }
      status="404"
      subTitle="该路由可能已被停用或移除。"
      title={<h1 className="text-2xl">页面不存在</h1>}
    />
  );
}
