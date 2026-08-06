import type { PluginComponentProps } from '@tt-plug/plugin-sdk';
import { Typography } from 'antd';

/**
 * two 注入到 one.nested 的模块。
 *
 * 路径是：two 的页面 → two.demo 插槽 → one 的模块 → one.nested 插槽 → 这里。
 * two 最终注入回了自己的页面，只不过隔着 one 的一层模块。
 */
export default function TwoNestedModule({ runtime }: PluginComponentProps) {
  return (
    <section aria-labelledby="two-nested-title">
      <Typography.Title className="m-0! text-sm!" id="two-nested-title" level={3}>
        two 注入 one 的嵌套模块
      </Typography.Title>
      <Typography.Text type="secondary">运行身份 {runtime.pluginId} · 绕了一圈回到自己的页面</Typography.Text>
    </section>
  );
}
