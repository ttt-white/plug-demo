import { Spin } from 'antd';

export function FullScreenLoading({ label = '正在加载工作区' }: { label?: string }) {
  return (
    <div className="grid min-h-screen place-items-center bg-neutral-50" role="status">
      <Spin description={label} size="large">
        <div className="h-16 w-32" />
      </Spin>
    </div>
  );
}
