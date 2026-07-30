import { useAuth } from '@/auth/AuthProvider';
import { PluginApiError } from '@fms/plugin-sdk';
import { Alert, Button, Form, Input, Segmented, Typography } from 'antd';
import { Boxes, LockKeyhole, LogIn, UserRound } from 'lucide-react';
import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

interface LocationState {
  from?: string;
}

interface LoginFormValues {
  username: string;
  password: string;
}

export function LoginPage() {
  const { login } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [form] = Form.useForm<LoginFormValues>();
  const selectedAccount = Form.useWatch('username', form);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const submit = async (values: LoginFormValues) => {
    setError('');
    setSubmitting(true);
    try {
      await login(values);
      const state = location.state as LocationState | null;
      const destination = state?.from?.startsWith('/') ? state.from : '/dashboard';
      navigate(destination, { replace: true });
    } catch (reason) {
      setError(reason instanceof PluginApiError ? reason.message : '登录失败，请稍后重试');
    } finally {
      setSubmitting(false);
    }
  };

  const selectAccount = (account: 'admin' | 'viewer') => {
    form.setFieldsValue({ username: account, password: account === 'admin' ? 'admin123' : 'viewer123' });
    setError('');
  };

  return (
    <main className="grid min-h-screen bg-white">
      <section className="relative hidden overflow-hidden bg-[#17231d] px-20 py-16 text-white lg:flex lg:flex-col lg:justify-center xl:px-28 2xl:px-36">
        <div className="mb-3.5 grid size-11 place-items-center rounded-md bg-[#2a9a6c]">
          <Boxes aria-hidden="true" size={24} />
        </div>
        <span className="text-sm font-bold text-[#b7c7bf]">FMS Workspace</span>
        <Typography.Title className="mt-12! mb-3! max-w-xl text-4xl! leading-tight! text-white!" level={1}>
          运输协同工作台
        </Typography.Title>
        <Typography.Paragraph className="m-0! max-w-lg text-base! leading-7! text-[#aebdb5]!">
          统一处理运输任务、经营指标与履约报表。
        </Typography.Paragraph>
        <div className="mt-18 flex gap-12">
          <div className="grid gap-1">
            <strong className="text-2xl">28</strong>
            <span className="text-xs text-[#9dafa6]">进行中任务</span>
          </div>
          <div className="grid gap-1">
            <strong className="text-2xl">96.7%</strong>
            <span className="text-xs text-[#9dafa6]">准时交付率</span>
          </div>
        </div>
      </section>

      <section className="grid place-items-center px-6 py-10 sm:px-12" aria-labelledby="login-title">
        <div className="w-full max-w-97.5">
          <span className="text-xs font-extrabold text-[#21845d] uppercase">安全登录</span>
          <Typography.Title className="mt-2! mb-1! text-3xl!" id="login-title" level={2}>
            欢迎回来
          </Typography.Title>
          <Typography.Paragraph className="mb-7! text-sm! text-[#738078]!">使用工作区账号继续</Typography.Paragraph>

          <Segmented
            aria-label="演示账号"
            block
            className="mb-6"
            value={selectedAccount === 'viewer' ? 'viewer' : 'admin'}
            options={[
              { label: '管理员', value: 'admin' },
              { label: '普通用户', value: 'viewer' },
            ]}
            onChange={(value) => selectAccount(value as 'admin' | 'viewer')}
          />

          <Form<LoginFormValues>
            form={form}
            layout="vertical"
            initialValues={{ username: 'admin', password: 'admin123' }}
            requiredMark={false}
            onFinish={(values) => void submit(values)}
          >
            <Form.Item label="用户名" name="username" rules={[{ required: true, message: '请输入用户名' }]}>
              <Input autoComplete="username" prefix={<UserRound aria-hidden="true" size={16} />} size="large" />
            </Form.Item>
            <Form.Item label="密码" name="password" rules={[{ required: true, message: '请输入密码' }]}>
              <Input.Password
                autoComplete="current-password"
                prefix={<LockKeyhole aria-hidden="true" size={16} />}
                size="large"
              />
            </Form.Item>
            {error && <Alert className="mb-5" message={error} showIcon type="error" />}
            <Button
              block
              htmlType="submit"
              icon={<LogIn aria-hidden="true" size={18} />}
              loading={submitting}
              size="large"
              type="primary"
            >
              登录工作区
            </Button>
          </Form>
        </div>
      </section>
    </main>
  );
}
