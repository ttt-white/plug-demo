import { loadRemote, registerRemotes } from '@module-federation/runtime';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { remotePluginDefinitions } from './remote-plugin-catalog';

describe('remote plugin federation loading', () => {
  beforeEach(() => {
    remotePluginDefinitions[0]?.invalidate();
  });

  it('reuses a healthy module and forces a new entry after invalidation', async () => {
    const definition = remotePluginDefinitions[0];
    if (!definition) throw new Error('测试缺少 three 远程插件配置');

    const first = await definition.load();
    const cached = await definition.load();
    expect(cached).toBe(first);
    expect(loadRemote).toHaveBeenCalledTimes(1);
    expect(registerRemotes).toHaveBeenCalledTimes(1);

    const firstRemote = vi.mocked(registerRemotes).mock.calls[0]?.[0][0];
    if (!firstRemote || !('entry' in firstRemote)) throw new Error('第一次注册缺少远程入口');
    const firstEntry = firstRemote.entry;
    definition.invalidate();
    await definition.load();

    expect(loadRemote).toHaveBeenCalledTimes(2);
    expect(registerRemotes).toHaveBeenLastCalledWith(expect.any(Array), { force: true });
    const secondRemote = vi.mocked(registerRemotes).mock.calls[1]?.[0][0];
    if (!secondRemote || !('entry' in secondRemote)) throw new Error('第二次注册缺少远程入口');
    const secondEntry = secondRemote.entry;
    expect(secondEntry).not.toBe(firstEntry);
  });
});
