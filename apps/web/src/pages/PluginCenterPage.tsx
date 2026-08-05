import { getWorkspaceHome, HOST_CONTRIBUTION_CATALOG } from '@/app/route-catalog';
import { useAuth } from '@/auth/AuthProvider';
import { usePluginRegistry } from '@/plugins/PluginRegistryProvider';
import {
  catalogPluginContributions,
  type PluginContributionCatalog,
  type PluginContributionCatalogOwner,
  type PluginContributionCatalogRoute,
} from '@fms/plugin-sdk';
import {
  Alert,
  Button,
  Card,
  Form,
  Input,
  List,
  Modal,
  Popconfirm,
  Space,
  Spin,
  Switch,
  Table,
  Tabs,
  Tag,
  Tooltip,
  Typography,
} from 'antd';
import { Pencil, Plus, RefreshCw, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { matchPath, useLocation, useNavigate } from 'react-router-dom';

function OwnerIdentity({ owner }: { owner: PluginContributionCatalogOwner }) {
  return (
    <Space size={4} wrap>
      <Typography.Text strong>{owner.name}</Typography.Text>
      <Typography.Text code>{owner.id}</Typography.Text>
    </Space>
  );
}

function RouteIdentity({ route }: { route: PluginContributionCatalogRoute }) {
  return (
    <Space orientation="vertical" size={0}>
      <Typography.Text>{route.label}</Typography.Text>
      <Space size={4} wrap>
        <Typography.Text code>{`${route.owner.id}/${route.routeId}`}</Typography.Text>
        {route.path && <Typography.Text type="secondary">{route.path}</Typography.Text>}
      </Space>
    </Space>
  );
}

function PermissionValue({ permission }: { permission: string | undefined }) {
  return permission ? (
    <Typography.Text code>{permission}</Typography.Text>
  ) : (
    <Typography.Text type="secondary">-</Typography.Text>
  );
}

function ContributionCatalogView({ catalog }: { catalog: PluginContributionCatalog }) {
  return (
    <section aria-labelledby="plugin-contribution-title" className="grid gap-2">
      <Typography.Title className="m-0! text-lg!" id="plugin-contribution-title" level={2}>
        贡献关系
      </Typography.Title>
      <Tabs
        items={[
          {
            key: 'pages',
            label: `页面 (${catalog.pages.length})`,
            children: (
              <Table<PluginContributionCatalog['pages'][number]>
                columns={[
                  {
                    title: '提供方',
                    dataIndex: 'provider',
                    render: (provider: PluginContributionCatalogOwner) => <OwnerIdentity owner={provider} />,
                  },
                  {
                    title: '页面',
                    render: (_, page) => (
                      <Space orientation="vertical" size={0}>
                        <Typography.Text>{page.label}</Typography.Text>
                        <Typography.Text code>{page.routeId}</Typography.Text>
                      </Space>
                    ),
                  },
                  { title: '路径', dataIndex: 'path', render: (path: string) => <Typography.Text code>{path}</Typography.Text> },
                  { title: '顺序', dataIndex: 'order', render: (order?: number) => order ?? '-' },
                  {
                    title: '权限',
                    dataIndex: 'permission',
                    render: (permission?: string) => <PermissionValue permission={permission} />,
                  },
                ]}
                dataSource={catalog.pages}
                locale={{ emptyText: '暂无页面' }}
                pagination={false}
                rowKey={(page) => `${page.provider.id}:${page.routeId}`}
                scroll={{ x: 760 }}
                size="small"
              />
            ),
          },
          {
            key: 'route-links',
            label: `页面入口 (${catalog.routeLinks.length})`,
            children: (
              <Table<PluginContributionCatalog['routeLinks'][number]>
                columns={[
                  {
                    title: '提供方',
                    dataIndex: 'provider',
                    render: (provider: PluginContributionCatalogOwner) => <OwnerIdentity owner={provider} />,
                  },
                  {
                    title: '入口',
                    render: (_, routeLink) => (
                      <Space orientation="vertical" size={0}>
                        <Typography.Text>{routeLink.label}</Typography.Text>
                        <Typography.Text code>{routeLink.id}</Typography.Text>
                      </Space>
                    ),
                  },
                  {
                    title: '挂载页面',
                    dataIndex: 'parent',
                    render: (route: PluginContributionCatalogRoute) => <RouteIdentity route={route} />,
                  },
                  {
                    title: '目标页面',
                    dataIndex: 'target',
                    render: (route: PluginContributionCatalogRoute) => <RouteIdentity route={route} />,
                  },
                  { title: '顺序', dataIndex: 'order' },
                  {
                    title: '权限',
                    dataIndex: 'permission',
                    render: (permission?: string) => <PermissionValue permission={permission} />,
                  },
                ]}
                dataSource={catalog.routeLinks}
                locale={{ emptyText: '暂无页面入口' }}
                pagination={false}
                rowKey={(routeLink) => `${routeLink.provider.id}:${routeLink.id}`}
                scroll={{ x: 980 }}
                size="small"
              />
            ),
          },
          {
            key: 'modules',
            label: `模块 (${catalog.modules.length})`,
            children: (
              <Table<PluginContributionCatalog['modules'][number]>
                columns={[
                  {
                    title: '提供方',
                    dataIndex: 'provider',
                    render: (provider: PluginContributionCatalogOwner) => <OwnerIdentity owner={provider} />,
                  },
                  { title: '模块 ID', dataIndex: 'id', render: (id: string) => <Typography.Text code>{id}</Typography.Text> },
                  {
                    title: '注入页面',
                    dataIndex: 'target',
                    render: (target: PluginContributionCatalogRoute) => <RouteIdentity route={target} />,
                  },
                  {
                    title: '插槽 ID',
                    dataIndex: 'target',
                    render: (target: PluginContributionCatalog['modules'][number]['target']) => (
                      <Typography.Text code>{target.slotId}</Typography.Text>
                    ),
                  },
                  { title: '优先级', dataIndex: 'priority' },
                  {
                    title: '权限',
                    dataIndex: 'permission',
                    render: (permission?: string) => <PermissionValue permission={permission} />,
                  },
                ]}
                dataSource={catalog.modules}
                locale={{ emptyText: '暂无模块' }}
                pagination={false}
                rowKey={(module) => `${module.provider.id}:${module.id}`}
                scroll={{ x: 900 }}
                size="small"
              />
            ),
          },
          {
            key: 'slots',
            label: `开放插槽 (${catalog.slots.length})`,
            children: (
              <Table<PluginContributionCatalog['slots'][number]>
                columns={[
                  {
                    title: '所属方',
                    dataIndex: 'provider',
                    render: (provider: PluginContributionCatalogOwner) => <OwnerIdentity owner={provider} />,
                  },
                  {
                    title: '所在页面',
                    dataIndex: 'route',
                    render: (route: PluginContributionCatalogRoute) => <RouteIdentity route={route} />,
                  },
                  {
                    title: '插槽 ID',
                    dataIndex: 'slotId',
                    render: (slotId: string) => <Typography.Text code>{slotId}</Typography.Text>,
                  },
                  {
                    title: '所属模块',
                    dataIndex: 'ownerModuleId',
                    render: (ownerModuleId?: string) =>
                      ownerModuleId ? (
                        <Typography.Text code>{ownerModuleId}</Typography.Text>
                      ) : (
                        <Typography.Text type="secondary">-</Typography.Text>
                      ),
                  },
                  {
                    title: '说明',
                    dataIndex: 'description',
                    render: (description?: string) => description ?? <Typography.Text type="secondary">-</Typography.Text>,
                  },
                ]}
                dataSource={catalog.slots}
                locale={{ emptyText: '暂无开放插槽' }}
                pagination={false}
                rowKey={(slot) => `${slot.provider.id}:${slot.route.routeId}:${slot.slotId}`}
                scroll={{ x: 900 }}
                size="small"
              />
            ),
          },
        ]}
      />
    </section>
  );
}

export function PluginCenterPage() {
  const { can } = useAuth();
  const {
    registrations,
    states,
    statesState,
    loading,
    refreshing,
    remoteConfigurations,
    routes,
    importRemotePlugin,
    updateRemotePlugin,
    removeRemotePlugin,
    reloadStates,
    setEnabled,
  } = usePluginRegistry();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [remoteDialog, setRemoteDialog] = useState<{ mode: 'import' } | { mode: 'edit'; id: string } | null>(null);
  const [remoteAddress, setRemoteAddress] = useState('');
  const [remotePending, setRemotePending] = useState(false);
  const [remoteError, setRemoteError] = useState('');
  const [error, setError] = useState('');
  const location = useLocation();
  const navigate = useNavigate();
  const contributionCatalog = useMemo(
    () =>
      catalogPluginContributions(
        registrations.flatMap((registration) => (registration.status === 'ready' ? [registration.plugin] : [])),
        HOST_CONTRIBUTION_CATALOG,
      ),
    [registrations],
  );

  const openImportDialog = () => {
    setError('');
    setRemoteError('');
    setRemoteAddress('');
    setRemoteDialog({ mode: 'import' });
  };

  const openEditDialog = (id: string, origin: string) => {
    setError('');
    setRemoteError('');
    setRemoteAddress(origin);
    setRemoteDialog({ mode: 'edit', id });
  };

  const saveRemotePlugin = async () => {
    if (!remoteDialog) return;
    setRemotePending(true);
    setRemoteError('');
    try {
      if (remoteDialog.mode === 'import') await importRemotePlugin(remoteAddress);
      else await updateRemotePlugin(remoteDialog.id, remoteAddress);
      setRemoteDialog(null);
    } catch (reason) {
      setRemoteError(reason instanceof Error ? reason.message : '远程插件配置保存失败');
    } finally {
      setRemotePending(false);
    }
  };

  const removeRemote = async (id: string) => {
    setPendingId(id);
    setError('');
    try {
      await removeRemotePlugin(id);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '远程插件删除失败');
    } finally {
      setPendingId(null);
    }
  };

  const toggle = async (id: string, enabled: boolean) => {
    setPendingId(id);
    setError('');
    try {
      await setEnabled(id, enabled);
      const registration = registrations.find(({ plugin }) => plugin?.manifest.id === id);
      if (
        !enabled &&
        registration?.plugin?.routes?.some((route) => matchPath({ path: route.path, end: true }, location.pathname))
      ) {
        navigate(
          getWorkspaceHome(
            can,
            routes.filter(({ plugin }) => plugin.manifest.id !== id),
          ),
        );
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '插件状态更新失败');
    } finally {
      setPendingId(null);
    }
  };

  return (
    <section aria-labelledby="plugin-center-title" className="grid gap-4">
      <Typography.Title id="plugin-center-title" className="m-0! text-2xl!" level={1}>
        插件中心
      </Typography.Title>
      <Card
        extra={
          <Space>
            <Button icon={<Plus aria-hidden="true" size={16} />} onClick={openImportDialog} type="primary">
              导入
            </Button>
            <Button
              aria-label="刷新插件状态"
              icon={<RefreshCw aria-hidden="true" size={16} />}
              loading={refreshing}
              onClick={() => void reloadStates()}
            >
              刷新
            </Button>
          </Space>
        }
        title="已配置插件"
      >
        {error && <Alert className="mb-4" closable message={error} showIcon type="error" onClose={() => setError('')} />}
        {statesState.status === 'error' && (
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
              statesState.states.length > 0
                ? `${statesState.error}。已保留最后一次成功状态。`
                : `${statesState.error}。插件启停状态暂时未知。`
            }
            message="插件状态同步失败"
            showIcon
            type="error"
          />
        )}
        {loading ? (
          <Spin description="正在读取插件状态">
            <div className="h-24" />
          </Spin>
        ) : (
          <List
            dataSource={registrations}
            renderItem={(registration) => {
              const { plugin } = registration;
              const declaredId =
                typeof registration.source.declaredPluginId === 'string' ? registration.source.declaredPluginId : undefined;
              const pluginId = plugin?.manifest.id ?? declaredId;
              const remoteConfiguration = pluginId
                ? remoteConfigurations.find(({ manifest }) => manifest.id === pluginId)
                : undefined;
              const pluginName =
                plugin?.manifest.name ?? remoteConfiguration?.manifest.name ?? declaredId ?? registration.source.packageName;
              const pluginState = pluginId ? states.find((state) => state.id === pluginId) : undefined;
              const enabled = pluginState?.enabled ?? false;
              const isRemote = registration.source.sourceType === 'remote';
              const isOffline = registration.diagnostics.some(
                (diagnostic) => diagnostic.stage === 'health' && diagnostic.severity === 'error',
              );
              const stateLabel = pluginState ? `${enabled ? '停用' : '启用'}${pluginName}` : `${pluginName}状态未知`;
              const summary = [
                `${plugin?.routes?.length ?? 0} 个页面`,
                `${plugin?.routeLinks?.length ?? 0} 个页面入口`,
                `${plugin?.modules?.length ?? 0} 个模块`,
              ].join(' / ');
              return (
                <List.Item
                  actions={[
                    ...(remoteConfiguration
                      ? [
                          <Tooltip key="edit" title="修改服务地址">
                            <Button
                              aria-label={`修改${pluginName}服务地址`}
                              icon={<Pencil aria-hidden="true" size={16} />}
                              onClick={() => openEditDialog(remoteConfiguration.manifest.id, remoteConfiguration.origin)}
                              type="text"
                            />
                          </Tooltip>,
                          <Popconfirm
                            key="remove"
                            cancelText="取消"
                            description="删除后，该插件的菜单、路由和模块会立即移除。"
                            okButtonProps={{ danger: true }}
                            okText="删除"
                            onConfirm={() => void removeRemote(remoteConfiguration.manifest.id)}
                            title={`删除远程插件 ${pluginName}？`}
                          >
                            <Tooltip title="删除远程插件">
                              <Button
                                aria-label={`删除${pluginName}`}
                                danger
                                icon={<Trash2 aria-hidden="true" size={16} />}
                                loading={pendingId === pluginId}
                                type="text"
                              />
                            </Tooltip>
                          </Popconfirm>,
                        ]
                      : []),
                    <Switch
                      key="enabled"
                      aria-label={stateLabel}
                      checked={enabled}
                      disabled={registration.status === 'error' || !pluginId || !pluginState || statesState.status === 'loading'}
                      loading={pendingId === pluginId}
                      onChange={(checked) => pluginId && void toggle(pluginId, checked)}
                    />,
                  ]}
                >
                  <Space orientation="vertical" size={2}>
                    <Space wrap>
                      <Typography.Text strong>{pluginName}</Typography.Text>
                      <Typography.Text code>{registration.source.packageName}</Typography.Text>
                      <Typography.Text type="secondary">v{registration.source.packageVersion}</Typography.Text>
                      <Tag color={registration.status === 'ready' ? 'success' : 'error'}>
                        {registration.status === 'ready' ? (isRemote ? '在线' : '可用') : isOffline ? '离线' : '注册失败'}
                      </Tag>
                      {pluginId && !pluginState && <Tag>状态未知</Tag>}
                    </Space>
                    <Typography.Text type="secondary">{summary}</Typography.Text>
                    {registration.source.remoteUrl && (
                      <Typography.Text code type="secondary">
                        {registration.source.remoteUrl}
                      </Typography.Text>
                    )}
                    {registration.diagnostics.map((diagnostic) => (
                      <Typography.Text
                        key={`${diagnostic.stage}:${diagnostic.code}:${diagnostic.path ?? ''}`}
                        type={diagnostic.severity === 'error' ? 'danger' : 'warning'}
                      >
                        [{diagnostic.stage}/{diagnostic.code}] {diagnostic.message}
                      </Typography.Text>
                    ))}
                  </Space>
                </List.Item>
              );
            }}
          />
        )}
      </Card>
      <ContributionCatalogView catalog={contributionCatalog} />
      <Modal
        cancelText="取消"
        destroyOnHidden
        okButtonProps={{ disabled: !remoteAddress.trim(), loading: remotePending }}
        okText={remoteDialog?.mode === 'edit' ? '保存' : '导入'}
        onCancel={() => !remotePending && setRemoteDialog(null)}
        onOk={() => void saveRemotePlugin()}
        open={remoteDialog !== null}
        title={remoteDialog?.mode === 'edit' ? '修改远程插件地址' : '导入远程插件'}
      >
        {remoteError && <Alert className="mb-4" message={remoteError} showIcon type="error" />}
        <Form layout="vertical" onFinish={() => void saveRemotePlugin()}>
          <Form.Item htmlFor="remote-plugin-origin" label="服务地址" required>
            <Input
              autoFocus
              id="remote-plugin-origin"
              onChange={(event) => setRemoteAddress(event.target.value)}
              placeholder="https://plugins.example.com/tool"
              value={remoteAddress}
            />
          </Form.Item>
        </Form>
      </Modal>
    </section>
  );
}
