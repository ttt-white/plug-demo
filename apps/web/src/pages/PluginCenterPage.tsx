import { usePluginRegistry } from '@/plugins/PluginRegistryProvider';
import { Alert, Card, List, Space, Spin, Switch, Tag, Typography } from 'antd';
import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

export function PluginCenterPage() {
  const { registrations, states, loading, setEnabled } = usePluginRegistry();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const location = useLocation();
  const navigate = useNavigate();

  const toggle = async (id: string, enabled: boolean) => {
    setPendingId(id);
    setError('');
    try {
      await setEnabled(id, enabled);
      const registration = registrations.find(({ plugin }) => plugin.manifest.id === id);
      if (!enabled && registration?.plugin.routes?.some((route) => route.path === location.pathname)) navigate('/dashboard');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '插件状态更新失败');
    } finally {
      setPendingId(null);
    }
  };

  return (
    <Card title="宿主 / 插件中心">
      {error && <Alert className="mb-4" closable message={error} showIcon type="error" onClose={() => setError('')} />}
      {loading ? (
        <Spin description="正在读取插件状态">
          <div className="h-24" />
        </Spin>
      ) : (
        <List
          dataSource={registrations}
          renderItem={(registration) => {
            const { plugin } = registration;
            const enabled = states.find((state) => state.id === plugin.manifest.id)?.enabled ?? false;
            const summary = [
              `${plugin.routes?.length ?? 0} 个页面`,
              `${plugin.routeLinks?.length ?? 0} 个页面入口`,
              `${plugin.modules?.length ?? 0} 个模块`,
            ].join(' / ');
            return (
              <List.Item
                actions={[
                  <Switch
                    key="enabled"
                    aria-label={`${enabled ? '停用' : '启用'}${plugin.manifest.name}`}
                    checked={enabled}
                    disabled={registration.status === 'error'}
                    loading={pendingId === plugin.manifest.id}
                    onChange={(checked) => void toggle(plugin.manifest.id, checked)}
                  />,
                ]}
              >
                <Space orientation="vertical" size={2}>
                  <Space wrap>
                    <Typography.Text strong>{plugin.manifest.name}</Typography.Text>
                    <Typography.Text type="secondary">v{plugin.manifest.version}</Typography.Text>
                    <Tag color={registration.status === 'ready' ? 'success' : 'error'}>
                      {registration.status === 'ready' ? '可用' : '注册失败'}
                    </Tag>
                  </Space>
                  <Typography.Text type="secondary">{summary}</Typography.Text>
                  {registration.errors.map((item) => (
                    <Typography.Text key={item} type="danger">
                      {item}
                    </Typography.Text>
                  ))}
                </Space>
              </List.Item>
            );
          }}
        />
      )}
    </Card>
  );
}
