/**
 * `cloudflare:workers` 的测试替身。
 *
 * 这个模块名是 Workers 运行时提供的虚拟模块：打包时由 scripts/build-workers.mjs 标成
 * external 交给运行时，但 vitest 跑在 node 上，解析不到就会让整个测试文件加载失败
 * （`Failed to load url cloudflare:workers`）。这里给它一个最小实现，由 vitest.config.ts
 * 的 alias 指过来。
 *
 * 只还原真实基类那点行为：把 (ctx, env) 存成实例属性。alarm 的调度不在这里模拟——
 * 需要验 alarm 行为的测试自己造 storage 替身，那样断言的是「设没设 alarm」这件事本身，
 * 比在替身里假装一套定时器可靠。
 */
export class DurableObject<Env = unknown> {
  protected ctx: unknown;
  protected env: Env;

  constructor(ctx: unknown, env: Env) {
    this.ctx = ctx;
    this.env = env;
  }
}
