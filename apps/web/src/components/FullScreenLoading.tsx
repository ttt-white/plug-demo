import { Spin } from 'antd';

export function FullScreenLoading({ label = '正在加载工作区' }: { label?: string }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f3f6f4]" role="status">
      <Spin description={label} size="large">
        <div className="h-16 w-40" />
      </Spin>
    </div>
  );
}
