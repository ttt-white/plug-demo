import type { PluginComponentProps } from '@tt-plug/plugin-sdk';
import { Typography } from 'antd';
import { oneContract } from './contract';

/**
 * one 注入到 two 页面 two.demo 插槽的模块，同时自己再开一个插槽。
 *
 * renderSlot 只允许渲染本插件开放的插槽（`PluginRenderer.tsx` 里按
 * `slot.pluginId === pluginId` 判断），所以这里渲染的是 one 自己的 one.nested，
 * 尽管它位于 two 的页面上。two 和 five 的模块会落进来，形成三层嵌套。
 */
export default function OneTwoModule({ runtime }: PluginComponentProps) {
  return (
    <section aria-labelledby="one-two-module-title" className="grid gap-3 rounded-md border border-slate-200 p-4">
      <div>
        <Typography.Title className="m-0! text-base!" id="one-two-module-title" level={2}>
          one 注入 two 的模块
        </Typography.Title>
        <Typography.Text type="secondary">
          运行身份 {runtime.pluginId} · 下面是 one 开放的 {oneContract.slots.nested.slotId} 插槽
        </Typography.Text>
      </div>
      <div className="grid gap-3 border-l-2 border-slate-200 pl-4">
        {runtime.extensions.renderSlot(
          oneContract.slots.nested,
          <Typography.Text type="secondary">暂无插件注入到 one 的嵌套插槽</Typography.Text>,
        )}
      </div>
    </section>
  );
}
