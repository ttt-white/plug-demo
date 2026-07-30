import { Alert, Card, Spin, Switch, Tag, Typography } from 'antd';
import { Blocks, Box, FileText } from 'lucide-react';
import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { usePluginRegistry } from '@/plugins/PluginRegistryProvider';

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
    <div className="grid gap-5.5">
      <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <span className="text-xs font-extrabold text-[#21845d] uppercase">Workspace Extensions</span>
          <Typography.Title className="mt-1! mb-1! text-3xl!" level={1}>
            插件中心
          </Typography.Title>
          <Typography.Paragraph className="m-0! text-sm! text-[#707b75]!">管理已经安装到当前构建中的插件。</Typography.Paragraph>
        </div>
        <Tag icon={<Blocks aria-hidden="true" size={15} />} color="blue">
          {registrations.length} 个已安装
        </Tag>
      </div>
      {error && <Alert closable message={error} role="alert" showIcon type="error" onClose={() => setError('')} />}
      {loading ? (
        <div className="grid min-h-56 place-items-center" role="status">
          <Spin description="正在读取插件状态" size="large">
            <div className="h-16 w-48" />
          </Spin>
        </div>
      ) : (
        <div className="grid gap-3">
          {registrations.map((registration) => {
            const { plugin } = registration;
            const enabled = states.find((state) => state.id === plugin.manifest.id)?.enabled ?? false;
            const pending = pendingId === plugin.manifest.id;
            const hasPage = Boolean(plugin.routes?.length);
            const hasModule = Boolean(plugin.modules?.length);
            return (
              <article key={plugin.manifest.id}>
                <Card className="shadow-sm [&_.ant-card-body]:p-5!">
                  <div className="grid grid-cols-[auto_minmax(0,1fr)] items-start gap-4 sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:items-center">
                    <div className="grid size-11 place-items-center rounded-md bg-[#eaf4ef] text-[#1e7d58]">
                      {hasPage ? <FileText aria-hidden="true" size={21} /> : <Box aria-hidden="true" size={21} />}
                    </div>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-baseline gap-2">
                        <Typography.Title className="m-0! text-base!" level={2}>
                          {plugin.manifest.name}
                        </Typography.Title>
                        <Typography.Text className="text-xs! text-[#89938e]!">v{plugin.manifest.version}</Typography.Text>
                      </div>
                      <Typography.Paragraph className="mt-1! mb-2.5! text-sm! text-[#6d7871]!">
                        {plugin.manifest.description}
                      </Typography.Paragraph>
                      <div className="flex flex-wrap gap-1.5">
                        {hasModule && <Tag>路由模块 · {plugin.modules?.length}</Tag>}
                        {hasPage && <Tag>独立页面 · {plugin.routes?.length}</Tag>}
                        <Tag color={registration.status === 'ready' ? 'success' : 'error'}>
                          {registration.status === 'ready' ? '校验通过' : '注册失败'}
                        </Tag>
                      </div>
                      {registration.errors.length > 0 && (
                        <ul className="mt-2.5 list-disc pl-4 text-xs text-[#a74332]">
                          {registration.errors.map((item) => (
                            <li key={item}>{item}</li>
                          ))}
                        </ul>
                      )}
                    </div>
                    <div className="col-span-2 flex items-center justify-end gap-2 sm:col-span-1 sm:flex-col">
                      <Switch
                        aria-label={`${enabled ? '停用' : '启用'}${plugin.manifest.name}`}
                        checked={enabled}
                        disabled={registration.status === 'error'}
                        loading={pending}
                        onChange={(checked) => void toggle(plugin.manifest.id, checked)}
                      />
                      <Typography.Text className="text-xs! text-[#76817b]!">
                        {pending ? '处理中' : enabled ? '已启用' : '已停用'}
                      </Typography.Text>
                    </div>
                  </div>
                </Card>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
