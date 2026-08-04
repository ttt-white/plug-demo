import { FORBIDDEN_PATH, getWorkspaceHome } from '@/app/route-catalog';
import { useAuth } from '@/auth/AuthProvider';
import { usePluginRegistry } from '@/plugins/PluginRegistryProvider';
import { Button, Result } from 'antd';
import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export function ForbiddenPage() {
  const { can } = useAuth();
  const { routes } = usePluginRegistry();
  const navigate = useNavigate();
  const workspaceHome = getWorkspaceHome(can, routes);
  return (
    <Result
      className="grid min-h-96 place-content-center"
      extra={
        workspaceHome === FORBIDDEN_PATH ? null : (
          <Button icon={<ArrowLeft aria-hidden="true" size={16} />} onClick={() => void navigate(workspaceHome)}>
            返回工作区
          </Button>
        )
      }
      status="403"
      subTitle="当前账号无法查看这个页面。"
      title={<h1 className="text-2xl">没有访问权限</h1>}
    />
  );
}
