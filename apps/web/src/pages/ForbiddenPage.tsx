import { Button, Result } from 'antd';
import { ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';

export function ForbiddenPage() {
  return (
    <Result
      className="grid min-h-[calc(100vh-var(--spacing)*39.5)] place-content-center"
      extra={
        <Link to="/dashboard">
          <Button icon={<ArrowLeft aria-hidden="true" size={16} />}>返回工作台</Button>
        </Link>
      }
      status="403"
      subTitle="当前账号无法查看这个页面。"
      title={<h1 className="text-2xl">没有访问权限</h1>}
    />
  );
}
