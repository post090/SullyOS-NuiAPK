# CLAUDE.md

项目导航搬到了 [`AGENTS.md`](./AGENTS.md)，内容在下面自动带进来，看那一份就行。

@AGENTS.md

## 本 Fork 专属补充（AGENTS.md 未覆盖的部分）

| 主题 | 文档 | 什么时候看 |
|------|------|-----------|
| **Fork 治理 / 开工前必读（本 Fork 专属）** | [`docs/fork-governance.md`](./docs/fork-governance.md) | 在本 Fork 上改持续运行/通话/音乐/RSS/Worker 相关前必读，含代码清爽原则、Worker 地址可配置、RSS 自定义校验、自检清单 |
| **持续运行 Always-On（历史过程文档）** | [`docs/ALWAYS_ON_RUNTIME_PLAN.md`](./docs/ALWAYS_ON_RUNTIME_PLAN.md) / [`docs/ALWAYS_ON_RUNTIME_PROGRESS.md`](./docs/ALWAYS_ON_RUNTIME_PROGRESS.md) | 旧三份为历史过程文档，新入口以治理文档为准 |
| **Instant Push SSE↔Push 契约** | [`docs/instant-push-dual-channel.md`](./docs/instant-push-dual-channel.md) | **改 instant push 路径或排查「报错但收到消息」类 bug 前必读**。SSE ≠ 送达判定通道、catch 不能直接判 send-failed |
| **Instant Push 通道** | [`docs/instant-push-branch-notes.md`](./docs/instant-push-branch-notes.md)、[`worker/instant-push/README.md`](./worker/instant-push/README.md) | LLM-driven Web Push、worker 端 agentic loop / reasoning / 副作用 directive |
