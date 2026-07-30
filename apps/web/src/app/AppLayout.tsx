import { useAuth } from '@/auth/AuthProvider';
import { usePluginRegistry } from '@/plugins/PluginRegistryProvider';
import { Button, Dropdown, Layout, Menu, type MenuProps } from 'antd';
import { BadgeCheck, Blocks, Boxes, ChartNoAxesColumn, House, LogOut, Puzzle, UserRound, type LucideIcon } from 'lucide-react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';

const iconMap: Record<string, LucideIcon> = {
  'badge-check': BadgeCheck,
  'chart-no-axes-column': ChartNoAxesColumn,
};

export function AppLayout() {
  const { user, can, logout } = useAuth();
  const { routes } = usePluginRegistry();
  const navigate = useNavigate();
  const location = useLocation();
  if (!user) return null;

  const currentPluginRoute = routes.find(({ contribution }) => contribution.path === location.pathname);

  const signOut = () => {
    logout();
    navigate('/login', { replace: true });
  };

  const menuItems: MenuProps['items'] = [
    {
      key: '/dashboard',
      icon: <House aria-hidden="true" size={17} />,
      label: <Link to="/dashboard">one</Link>,
      title: 'one：工作台',
    },
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

  const accountItems: MenuProps['items'] = [
    {
      key: 'account',
      disabled: true,
      label: `${user.displayName} / ${user.role === 'admin' ? '管理员' : '查看者'}`,
    },
    { type: 'divider' },
    { key: 'logout', danger: true, icon: <LogOut aria-hidden="true" size={16} />, label: '退出登录' },
  ];

  return (
    <Layout className="min-h-screen! bg-neutral-50!">
      <Layout.Header className="sticky top-0 z-20 flex h-auto! min-h-16 items-center gap-3 bg-white! px-4! sm:px-6!">
        <Link className="flex shrink-0 items-center gap-2 whitespace-nowrap font-semibold text-neutral-950" to="/dashboard">
          <Boxes aria-hidden="true" size={19} />
          <span className="hidden sm:inline">FMS Workspace</span>
        </Link>
        <Menu
          aria-label="主导航"
          className="min-w-0 flex-1 border-0!"
          items={menuItems}
          mode="horizontal"
          selectedKeys={[currentPluginRoute?.contribution.path ?? location.pathname]}
        />
        <Dropdown menu={{ items: accountItems, onClick: ({ key }) => key === 'logout' && signOut() }} placement="bottomRight">
          <Button aria-label="账户菜单" icon={<UserRound aria-hidden="true" size={17} />} type="text" />
        </Dropdown>
      </Layout.Header>
      <Layout.Content className="mx-auto w-full max-w-300 px-4 py-6 sm:px-6">
        <Outlet />
      </Layout.Content>
    </Layout>
  );
}
