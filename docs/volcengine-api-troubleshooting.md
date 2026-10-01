# 火山方舟接入糯米机：先核对接口，再查 Cloudflare 代理

适用范围：火山方舟的普通在线推理、OpenAI Chat Completions 兼容接口。仅凭「k3」「五十元」不能确定具体模型和购买的产品，先看控制台的产品名称、模型 ID、API 示例；不要凭昵称填写模型。

## 可以直接回复用户

> 可以接普通方舟 API。先确认你买的是「在线推理余额」还是「Coding Plan 套餐」，这两个不是同一个接口、也不是同一份额度。普通在线推理在糯米机设置的 API URL 填 `https://ark.cn-beijing.volces.com/api/v3`，Key 填方舟 API Key，模型名从方舟控制台的调用示例原样复制（可能是模型 ID，也可能是 `ep-...` 推理接入点 ID）。URL 不要加 `/chat/completions`，糯米机会自己补。
>
> 如果直连提示网络错误，再检查 CF 代理。代理地址要填进「API URL」，不是「网络代理 (Worker)」；后者管搜索等联网功能，不会自动代理聊天 API。可以把你填写的 URL、模型名、去掉 Key 的 Worker 代码、以及「测试连接」的完整报错发来。Key 不用发。

## 先直连判断是哪一层

1. 在火山控制台确认对应模型已开通，用控制台调用示例核对当前区域、Key、模型 ID。不要使用火山账号的 Access Key ID/Secret 代替方舟 API Key。
2. 糯米机「设置 → API」填写上述 URL、Key、Model，保存并测试连接。模型列表拉取失败时，仍可手动输入控制台的模型 ID；列表接口失败不代表聊天接口不能用。
3. `401` 先检查 Key；`403` 看响应正文的模型权限/账号限制；`404` 检查路径和模型 ID；`429` 看配额和限流。`Failed to fetch` 可能是跨域、域名不通、TLS 或网络问题，不能只凭这一句判定 CF 写错。
4. 若是 Coding Plan，先核对套餐是否支持该应用/用途。官方给出的 OpenAI 兼容地址是 `https://ark.cn-beijing.volces.com/api/coding/v3`；不能把它与普通 `/api/v3` 的 Key、Model、额度混用。普通地址不会扣 Coding Plan 额度，可能产生另外的按量费用。本页代理模板只用于普通在线推理，不把套餐自动转换为通用 API。

## CF 普通在线推理代理模板

在自己 Cloudflare 账号下创建一个独立 Worker，把以下完整代码粘贴到代码编辑器并部署。此模板不保存 Key，只把糯米机请求里携带的 Key 传给固定的火山域名，不接受任意目标 URL。

```js
export default {
  async fetch(request) {
    const cors = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Authorization, Content-Type',
      'Access-Control-Max-Age': '86400',
    };
    const error = (status, message) => new Response(JSON.stringify({ error: { message } }), {
      status, headers: { ...cors, 'Content-Type': 'application/json' },
    });
    const path = new URL(request.url).pathname;
    if (path !== '/v1/chat/completions' && path !== '/v1/models') return error(404, 'Use /v1 as the API URL');
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    const method = path === '/v1/models' ? 'GET' : 'POST';
    if (request.method !== method) return error(405, 'Method not allowed');
    const authorization = request.headers.get('Authorization');
    if (!authorization?.startsWith('Bearer ')) return error(401, 'Missing API Key');
    try {
      const upstream = await fetch('https://ark.cn-beijing.volces.com/api/v3' + path.slice(3), {
        method,
        headers: { Authorization: authorization, 'Content-Type': 'application/json' },
        body: method === 'POST' ? request.body : undefined,
        redirect: 'manual',
      });
      const headers = new Headers(upstream.headers);
      for (const [key, value] of Object.entries(cors)) headers.set(key, value);
      headers.set('Cache-Control', 'no-store');
      // 原样传递响应流，保留 SSE、状态码和火山的具体错误信息。
      return new Response(upstream.body, { status: upstream.status, headers });
    } catch {
      return error(502, 'Worker could not reach Volcengine');
    }
  },
};
```

糯米机 API 设置对应填写：

| 项目 | 内容 |
| --- | --- |
| API URL | `https://你的Worker域名/v1` |
| API Key | 自己的方舟 API Key |
| Model | 普通在线推理调用示例中的模型/接入点 ID |

实际链路应当是：糯米机 → `https://你的Worker域名/v1/chat/completions` → `https://ark.cn-beijing.volces.com/api/v3/chat/completions`。不要在设置里加两次 `/v1`，也不要照搬需要 `?target=` 的其他代理用法。直接在浏览器打开 Worker 首页得到 404 是本模板的预期行为，不能用首页是否显示 Hello World 判断聊天代理是否工作。

CF 必须同时处理 OPTIONS、Authorization 和错误响应的 CORS；只给成功响应加 CORS 会把真实的 401/403 隐藏成网络错误。流式模式不能先 `await upstream.json()` 再返回，否则 SSE 会被破坏。若手机连 Worker 域名本身都失败，先解决域名可达性，再调接口参数。

本模板尚未使用用户账号或真实 Key 做付费调用，不能据此声称该用户的具体模型已连通。

## 官方资料

- [火山方舟 Chat API](https://docs.volcengine.com/docs/ark/chat-api?lang=zh)
- [Base URL 与鉴权](https://docs.volcengine.com/docs/ark/base-url-and-authentication?lang=zh)
- [Coding Plan 首次使用](https://docs.volcengine.com/docs/ark/coding-plan-personal-get-started?lang=zh)
- [Cloudflare CORS 代理](https://developers.cloudflare.com/workers/examples/cors-header-proxy/)
- [Cloudflare Streams](https://developers.cloudflare.com/workers/runtime-apis/streams/)
