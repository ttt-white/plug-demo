import { useAuth } from '@/auth/AuthProvider';
import { usePluginRegistry } from '@/plugins/PluginRegistryProvider';
import { Button, Dropdown, Menu, type MenuProps } from 'antd';
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

  const accountItems: MenuProps['items'] = [
    {
      key: 'account',
      disabled: true,
      label: (
        <div>
          <strong>{user.displayName}</strong>
          <div>{user.role === 'admin' ? '管理员' : '查看者'}</div>
        </div>
      ),
    },
    { type: 'divider' },
    { key: 'logout', danger: true, icon: <LogOut aria-hidden="true" size={16} />, label: '退出登录' },
  ];

  return (
    <div className="min-h-screen bg-neutral-50">
      <header className="sticky top-0 z-20 bg-white shadow-sm">
        <div className="mx-auto flex min-h-16 w-full max-w-360 items-center gap-2 px-4 sm:gap-6 sm:px-7">
          <Link
            className="inline-flex shrink-0 items-center gap-2.5 whitespace-nowrap text-neutral-950 no-underline"
            to="/dashboard"
            aria-label="FMS Workspace 首页"
          >
            <span className="grid size-9 place-items-center rounded-md bg-blue-600 text-white">
              <Boxes aria-hidden="true" size={19} />
            </span>
            <span className="hidden text-sm sm:inline">
              FMS <strong className="text-blue-600">Workspace</strong>
            </span>
          </Link>

          <nav className="min-w-0 flex-1" aria-label="主导航">
            <Menu items={menuItems} mode="horizontal" selectedKeys={[location.pathname]} />
          </nav>

          <Dropdown menu={{ items: accountItems, onClick: ({ key }) => key === 'logout' && signOut() }} placement="bottomRight">
            <Button aria-label="账户菜单" icon={<UserRound aria-hidden="true" size={17} />} type="text">
              <span className="hidden lg:inline">{user.displayName}</span>
            </Button>
          </Dropdown>
        </div>
      </header>
      <main className="mx-auto w-full max-w-310 px-4 py-8 sm:px-7 sm:py-10">
        <Outlet />
      </main>
    </div>
  );
}
