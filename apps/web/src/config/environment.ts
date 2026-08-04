/** Mock API 和演示账号只能在开发或测试环境使用。 */
export const DEMO_MODE =
  import.meta.env.MODE === 'test' || (import.meta.env.DEV && import.meta.env['VITE_ENABLE_MOCKS'] === 'true');
