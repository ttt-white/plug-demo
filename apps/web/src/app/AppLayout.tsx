import { useAuth } from '@/auth/AuthProvider';
import { usePluginRegistry } from '@/plugins/PluginRegistryProvider';
import { Avatar, Button, Layout, Menu, Tooltip, Typography, type MenuProps } from 'antd';
import { Blocks, Boxes, ChartNoAxesColumn, House, LogOut, Puzzle, type LucideIcon } from 'lucide-react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';

const iconMap: Record<string, LucideIcon> = {
  'chart-no-axes-column': ChartNoAxesColumn,
};

export function AppLayout() {
  const { user, can, logout } = useAuth();
  const { routes } = usePluginRegistry();
  const navigate = useNavigate();
  const location = useLocation();
  if (!user) return null;

  const signOut = () => {
    logout();
    navigate('/login', { replace: true });
  };

  const menuItems: MenuProps['items'] = [
    { key: '/dashboard', icon: <House aria-hidden="true" size={17} />, label: <Link to="/dashboard">工作台</Link> },
    ...routes
      .filter(({ contribution }) => can(contribution.permission))
      .map(({ plugin, contribution }) => {
        const Icon = iconMap[contribution.menu.icon as keyof typeof iconMap] ?? Puzzle;
        return {
          key: contribution.path,
          icon: <Icon aria-hidden="true" size={17} />,
          label: <Link to={contribution.path}>{contribution.menu.label}</Link>,
          title: `${plugin.manifest.name}：${contribution.menu.label}`,
        };
      }),
    ...(can('plugins:manage')
      ? [{ key: '/plugins', icon: <Blocks aria-hidden="true" size={17} />, label: <Link to="/plugins">插件中心</Link> }]
      : []),
  ];

  return (
    <Layout className="min-h-screen bg-[#f3f6f4]!">
      <Layout.Header className="sticky top-0 z-20 h-17.5! border-b border-[#dce3df] bg-white/95! px-0! leading-normal! backdrop-blur-md">
        <div className="mx-auto grid h-full w-full max-w-360 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 px-3 sm:gap-5 sm:px-7">
          <Link
            className="inline-flex items-center gap-2.5 whitespace-nowrap text-[#1b2821] no-underline"
            to="/dashboard"
            aria-label="FMS Workspace 首页"
          >
            <span className="grid size-9 place-items-center rounded-md bg-[#1c8059] text-white">
              <Boxes aria-hidden="true" size={19} />
            </span>
            <span className="hidden text-sm sm:inline">
              FMS <strong className="text-[#237c58]">Workspace</strong>
            </span>
          </Link>

          <Menu
            aria-label="主菜单"
            className="min-w-0 border-b-0! bg-transparent!"
            items={menuItems}
            mode="horizontal"
            selectedKeys={[location.pathname]}
          />

          <div className="flex items-center gap-2">
            <Avatar className="shrink-0 bg-[#fee9df]! text-[#a84131]!">{user.displayName.slice(0, 1)}</Avatar>
            <div className="hidden min-w-16 lg:grid">
              <Typography.Text className="text-xs! font-semibold!">{user.displayName}</Typography.Text>
              <Typography.Text className="text-xs! text-[#87918c]!">
                {user.role === 'admin' ? '管理员' : '查看者'}
              </Typography.Text>
            </div>
            <Tooltip title="退出登录">
              <Button
                aria-label="退出登录"
                color="danger"
                icon={<LogOut aria-hidden="true" size={17} />}
                type="text"
                onClick={signOut}
              />
            </Tooltip>
          </div>
        </div>
      </Layout.Header>
      <Layout.Content className="mx-auto w-full max-w-310 px-4 pt-7 pb-14 sm:px-7 sm:pt-8">
        <Outlet />
      </Layout.Content>
    </Layout>
  );
}
