import { useAuth } from '@/auth/AuthProvider';
import { PluginApiError } from '@fms/plugin-sdk';
import { Alert, Button, Card, Form, Input, Segmented, Typography } from 'antd';
import { LockKeyhole, LogIn, UserRound } from 'lucide-react';
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
    <main className="grid min-h-screen place-items-center bg-neutral-50 p-4">
      <Card className="w-full max-w-100" title="FMS Workspace 登录">
        <Typography.Paragraph type="secondary">选择演示账号并登录</Typography.Paragraph>
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
            <Input.Password autoComplete="current-password" prefix={<LockKeyhole aria-hidden="true" size={16} />} size="large" />
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
      </Card>
    </main>
  );
}
