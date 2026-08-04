import { getWorkspaceHome } from '@/app/route-catalog';
import { useAuth } from '@/auth/AuthProvider';
import { usePluginRegistry } from '@/plugins/PluginRegistryProvider';
import { Alert, Button, Card, List, Space, Spin, Switch, Tag, Typography } from 'antd';
import { RefreshCw } from 'lucide-react';
import { useState } from 'react';
import { matchPath, useLocation, useNavigate } from 'react-router-dom';

export function PluginCenterPage() {
  const { can } = useAuth();
  const { registrations, states, statesState, loading, routes, reloadStates, setEnabled } = usePluginRegistry();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const location = useLocation();
  const navigate = useNavigate();

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
          <Button
            aria-label="刷新插件状态"
            icon={<RefreshCw aria-hidden="true" size={16} />}
            loading={statesState.status === 'loading'}
            onClick={() => void reloadStates()}
          >
            刷新
          </Button>
        }
        title="已安装插件"
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
              const pluginName = plugin?.manifest.name ?? declaredId ?? registration.source.packageName;
              const pluginState = pluginId ? states.find((state) => state.id === pluginId) : undefined;
              const enabled = pluginState?.enabled ?? false;
              const stateLabel = pluginState ? `${enabled ? '停用' : '启用'}${pluginName}` : `${pluginName}状态未知`;
              const summary = [
                `${plugin?.routes?.length ?? 0} 个页面`,
                `${plugin?.routeLinks?.length ?? 0} 个页面入口`,
                `${plugin?.modules?.length ?? 0} 个模块`,
              ].join(' / ');
              return (
                <List.Item
                  actions={[
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
                        {registration.status === 'ready' ? '可用' : '注册失败'}
                      </Tag>
                      {pluginId && !pluginState && <Tag>状态未知</Tag>}
                    </Space>
                    <Typography.Text type="secondary">{summary}</Typography.Text>
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
    </section>
  );
}
