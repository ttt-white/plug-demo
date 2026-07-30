import { Button, Result } from 'antd';
import { ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';

export function NotFoundPage() {
  return (
    <Result
      className="grid min-h-[calc(100vh-var(--spacing)*39.5)] place-content-center"
      extra={
        <Link to="/dashboard">
          <Button icon={<ArrowLeft aria-hidden="true" size={16} />}>返回工作台</Button>
        </Link>
      }
      status="404"
      subTitle="该路由可能已被停用或移除。"
      title={<h1 className="text-2xl">页面不存在</h1>}
    />
  );
}
