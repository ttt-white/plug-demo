import { useAuth } from '@/auth/AuthProvider';
import { usePluginRegistry } from '@/plugins/PluginRegistryProvider';
import { Alert, Button, Dropdown, Layout, Menu, type MenuProps } from 'antd';
import { BadgeCheck, Blocks, Boxes, Ellipsis, House, LogOut, Puzzle, RefreshCw, UserRound, type LucideIcon } from 'lucide-react';
import { Link, matchPath, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { getWorkspaceHome, HOST_ROUTE_CATALOG } from './route-catalog';

const iconMap: Record<string, LucideIcon> = {
  'badge-check': BadgeCheck,
  blocks: Blocks,
  house: House,
};
const roleLabels: Record<string, string> = {
  admin: '管理员',
  viewer: '查看者',
};

export function AppLayout() {
  const { user, can, logout } = useAuth();
  const { routes, statesState, reloadStates } = usePluginRegistry();
  const navigate = useNavigate();
  const location = useLocation();
  if (!user) return null;

  const workspaceHome = getWorkspaceHome(can, routes);

  const signOut = () => {
    logout();
    navigate('/login', { replace: true });
  };

  const menuEntries = [
    ...HOST_ROUTE_CATALOG.flatMap((route) => {
      if (!route.menu || !route.permission || !can(route.permission)) return [];
      const Icon = iconMap[route.menu.icon] ?? Puzzle;
      return [
        {
          path: route.path,
          order: route.menu.order,
          item: {
            key: route.path,
            icon: <Icon aria-hidden="true" size={17} />,
            label: <Link to={route.path}>{route.menu.label}</Link>,
            title: route.menu.title,
          },
        },
      ];
    }),
    ...routes
      .filter(({ contribution }) => can(contribution.permission))
      .map(({ plugin, contribution }) => {
        const Icon = iconMap[contribution.menu.icon as keyof typeof iconMap] ?? Puzzle;
        return {
          path: contribution.path,
          order: contribution.menu.order,
          item: {
            key: contribution.path,
            icon: <Icon aria-hidden="true" size={17} />,
            label: <Link to={contribution.path}>{contribution.menu.label}</Link>,
            title: `${plugin.manifest.name}：${contribution.menu.label}`,
          },
        };
      }),
  ].sort((left, right) => left.order - right.order || left.path.localeCompare(right.path));
  const menuItems: MenuProps['items'] = menuEntries.map(({ item }) => item);
  const selectedPath = [...menuEntries]
    .sort((left, right) => right.path.length - left.path.length)
    .find(({ path }) => matchPath({ path, end: false }, location.pathname))?.path;

  const accountItems: MenuProps['items'] = [
    {
      key: 'account',
      disabled: true,
      label: `${user.displayName} / ${roleLabels[user.role] ?? user.role}`,
    },
    { type: 'divider' },
    { key: 'logout', danger: true, icon: <LogOut aria-hidden="true" size={16} />, label: '退出登录' },
  ];

  return (
    <Layout className="min-h-screen! bg-neutral-50!">
      <a
        className="sr-only z-50 bg-white px-3 py-2 text-sm font-medium text-blue-700 focus:not-sr-only focus:fixed focus:top-2 focus:left-2"
        href="#main-content"
      >
        跳转到主内容
      </a>
      <Layout.Header className="sticky top-0 z-20 flex h-auto! min-h-16 items-center gap-3 bg-white! px-4! sm:px-6!">
        <Link className="flex shrink-0 items-center gap-2 font-semibold whitespace-nowrap text-neutral-950" to={workspaceHome}>
          <Boxes aria-hidden="true" size={19} />
          <span className="hidden sm:inline">FMS Workspace</span>
        </Link>
        <Menu
          aria-label="主导航"
          className="min-w-0 flex-1 border-0!"
          items={menuItems}
          mode="horizontal"
          overflowedIndicator={<Ellipsis aria-label="更多导航" role="img" size={18} />}
          selectedKeys={selectedPath ? [selectedPath] : []}
        />
        <Dropdown menu={{ items: accountItems, onClick: ({ key }) => key === 'logout' && signOut() }} placement="bottomRight">
          <Button aria-label="账户菜单" icon={<UserRound aria-hidden="true" size={17} />} type="text" />
        </Dropdown>
      </Layout.Header>
      <Layout.Content id="main-content" className="mx-auto w-full max-w-300 px-4 py-6 sm:px-6" tabIndex={-1}>
        {statesState.status === 'error' && location.pathname !== '/plugins' && (
          <Alert
            action={
              <Button
                aria-label="重试插件状态同步"
                icon={<RefreshCw aria-hidden="true" size={16} />}
                size="small"
                onClick={() => void reloadStates()}
              >
                重试
              </Button>
            }
            className="mb-4"
            description={
              statesState.states.length > 0 ? '已保留最后一次成功状态，插件菜单和页面仍可继续使用。' : statesState.error
            }
            message="插件状态同步失败"
            showIcon
            type="error"
          />
        )}
        <Outlet />
      </Layout.Content>
    </Layout>
  );
}
