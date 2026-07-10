# agentpay-researcher

[English README](./README.md) | [中文威胁模型](./docs/THREAT_MODEL.zh-CN.md)

一个最小化的 TypeScript AI 研究代理示例，用 HTTP `402 Payment Required` 风格的流程演示机器到机器支付如何解锁付费搜索 API。

主项目只使用模拟支付。它不会读取真实私钥，不会连接真实钱包，也不会转移真实资金。真实 x402 和 MPP/Tempo 实验放在 `examples/` 目录，并且默认面向 testnet。

## 项目目标

这个仓库演示一个 AI agent 在调用高级搜索接口时，如何处理“先请求、收到付款要求、判断预算、模拟支付、带付款凭证重试”的完整流程。

核心流程：

1. 用户向 agent 输入一个研究查询。
2. agent 调用 `POST /api/premium-search`，第一次不带付款信息。
3. API 返回 HTTP `402`，并给出机器可读的付款要求。
4. agent 检查付款金额是否超过用户设置的最大预算。
5. 如果预算允许，agent 生成一张模拟付款收据。
6. agent 使用 `x-agent-payment` 请求头重试接口。
7. API 验证模拟收据后调用配置的搜索 provider，返回高级搜索结果，并写入本地 ledger。

## 技术栈

- TypeScript
- Express
- Node.js 20+
- pnpm
- 本地 JSON 文件作为模拟 ledger

## 快速开始

安装依赖：

```bash
pnpm install
```

复制环境变量示例：

```bash
cp .env.example .env
```

启动 API 服务：

```bash
pnpm run dev
```

另开一个终端运行 agent：

```bash
pnpm run agent -- "AI agents 如何使用稳定币进行微支付" --budget 0.05
```

查看 ledger：

```bash
pnpm run ledger
```

清空 ledger：

```bash
pnpm run reset:ledger
```

## 真实搜索 Provider

默认 `SEARCH_PROVIDER=mock`，所以不需要任何 API key 就能跑通 demo。如果要把项目升级成“mock payment + real premium search result”，可以在 `.env` 中配置真实搜索 provider。

Tavily：

```bash
SEARCH_PROVIDER=tavily
TAVILY_API_KEY=...
```

Exa：

```bash
SEARCH_PROVIDER=exa
EXA_API_KEY=...
```

Brave：

```bash
SEARCH_PROVIDER=brave
BRAVE_API_KEY=...
```

支持的 provider：

| Provider | 环境变量 | 说明 |
| --- | --- | --- |
| `mock` | 无 | 默认值，不调用外部服务 |
| `tavily` | `TAVILY_API_KEY` | 调用 Tavily Search API |
| `exa` | `EXA_API_KEY` | 调用 Exa Search API |
| `brave` | `BRAVE_API_KEY` | 调用 Brave Search API |

## API 说明

### `POST /api/premium-search`

请求体：

```json
{
  "query": "AI agents 如何使用稳定币进行微支付"
}
```

如果没有付款请求头，接口返回 HTTP `402`：

```json
{
  "error": "Payment required",
  "reason": "missing payment header",
  "paymentRequired": {
    "protocol": "mock-x402",
    "amount": "0.02",
    "currency": "USDC",
    "recipient": "merchant_demo_wallet_do_not_use",
    "invoiceId": "mock_inv_...",
    "expiresAt": "2026-01-01T00:00:00.000Z",
    "paymentHeader": "x-agent-payment",
    "memo": "Premium research for: ..."
  }
}
```

agent 模拟付款后，会使用类似下面的请求头重试：

```http
x-agent-payment: mock-x402 <base64url mock receipt>
```

验证通过后，API 返回高级搜索结果，并写入 ledger。

### `GET /api/ledger`

返回本地模拟支付账本：

```json
{
  "entries": [
    {
      "query": "AI agents 如何使用稳定币进行微支付",
      "amount": "0.02",
      "protocol": "mock-x402",
      "timestamp": "2026-01-01T00:00:00.000Z",
      "invoiceId": "mock_inv_...",
      "txId": "mock_tx_..."
    }
  ]
}
```

## 目录结构

```text
agentpay-researcher/
  src/
    agent.ts        # 模拟 AI agent：处理查询、预算、402、模拟付款和重试
    server.ts       # Express API 服务
    payment.ts      # 付款要求、模拟收据、收据验证
    ledger.ts       # 本地 JSON ledger 读写
    ledger-cli.ts   # 查看和重置 ledger 的命令行工具
    search.ts       # mock/Tavily/Exa/Brave 搜索适配层
    config.ts       # 环境变量配置
    types.ts        # 共享类型定义
  docs/
    THREAT_MODEL.md
    THREAT_MODEL.zh-CN.md
  examples/
    x402-demo/
    mpp-tempo-demo/
  .env.example
  README.md
  README.zh-CN.md
  package.json
  tsconfig.json
```

## 示例目录

- [`examples/x402-demo`](./examples/x402-demo)：独立 Coinbase x402 buyer/seller demo，默认只面向 testnet 钱包配置。
- [`examples/mpp-tempo-demo`](./examples/mpp-tempo-demo)：实验性 MPP/Tempo testnet 集成目录，使用 `mppx`。

## 威胁模型

见 [docs/THREAT_MODEL.zh-CN.md](./docs/THREAT_MODEL.zh-CN.md)。

里面覆盖了：

- 恶意付款请求
- prompt injection 导致非预期消费
- 付款请求头重放
- 超额消费风险
- 假商户 endpoint
- 私钥泄露
- 不可信 API 结果
- ledger 篡改
- 搜索 API key 滥用

## 和 MPP、x402、Tempo、稳定币微支付的关系

### HTTP 402

HTTP `402 Payment Required` 在这个项目里被用作“付款协商”的入口。客户端第一次访问付费资源时，服务端不直接返回内容，而是返回一个结构化的付款要求。

这个付款要求告诉 agent：

- 需要支付多少钱
- 使用什么协议
- 使用什么币种
- 付款给谁
- 用哪个请求头提交付款凭证
- 这次请求对应哪个 invoice

真实生产环境中，这里的模拟收据应该替换为真实的支付证明、签名授权、链上交易证明，或者由 payment facilitator 返回的验证结果。

### MPP

`mock-mpp` 表示 Machine Payments Protocol 风格的机器支付流程。这个 demo 体现的是 MPP 的核心思想：

- 服务端返回机器可读的付款要求。
- agent 根据用户策略和预算判断是否付款。
- agent 通过钱包、支付服务或 facilitator 获取付款证明。
- 服务端验证付款证明后返回付费资源。

主项目没有绑定真实 MPP SDK，而是保留一个清晰的模拟协议层。真实 MPP/Tempo testnet 实验放在 `examples/mpp-tempo-demo`。

### x402

`mock-x402` 模拟 x402 风格的流程：服务端用 HTTP `402` 返回付款要求，客户端付款后用请求头携带付款凭证重试。

真实 x402 实现通常还会加入：

- 更严格的付款要求 schema
- chain id 和 asset id
- facilitator 验证
- 防重放机制
- 真实结算规则

真实 x402 buyer/seller 实验放在 `examples/x402-demo`。

### Tempo

Tempo 可以理解为稳定币支付基础设施的一个相关方向。真实版本可以把本 demo 的“模拟付款”替换为在稳定币网络上的真实小额结算，同时保留同样的应用层流程：

未付款请求 -> `402` 付款要求 -> agent 预算判断 -> 付款证明 -> 带凭证重试。

### 稳定币微支付

高级搜索很适合演示微支付，因为 agent 可能只需要为一次查询、一次数据增强、一次排序或一个高级数据源支付很小的金额。

稳定币的好处是金额稳定、易于预算管理；HTTP 402 风格协议的好处是让付款步骤变成机器可读流程，而不是人工 checkout。

## 环境变量

见 `.env.example`。

| 变量 | 作用 |
| --- | --- |
| `PORT` | Express 服务端口 |
| `API_BASE_URL` | agent 调用 API 时使用的基础 URL |
| `PREMIUM_SEARCH_PRICE` | `/api/premium-search` 的模拟价格 |
| `PAYMENT_PROTOCOL` | `mock-x402` 或 `mock-mpp` |
| `PAYMENT_CURRENCY` | 模拟支付币种 |
| `PAYMENT_RECIPIENT` | 模拟收款地址或账户 |
| `LEDGER_PATH` | 本地 JSON ledger 文件路径 |
| `SEARCH_PROVIDER` | `mock`、`tavily`、`exa` 或 `brave` |
| `SEARCH_RESULT_LIMIT` | 请求的最大搜索结果数 |
| `TAVILY_API_KEY` | Tavily API key，仅在 `SEARCH_PROVIDER=tavily` 时使用 |
| `EXA_API_KEY` | Exa API key，仅在 `SEARCH_PROVIDER=exa` 时使用 |
| `BRAVE_API_KEY` | Brave API key，仅在 `SEARCH_PROVIDER=brave` 时使用 |

## 安全说明

- 不要把真实私钥放进 `.env`。
- 不要把这个 demo 直接连接到生产钱包。
- `x-agent-payment` 只是教学用的模拟付款凭证。
- `examples/` 只应该使用 testnet 凭证。
- 生产环境需要增加认证、防重放、限流、持久化数据库、真实签名验证和经过审计的支付 SDK。

## 常用命令

```bash
pnpm run dev
pnpm run build
pnpm run start
pnpm run agent -- "你的研究问题" --budget 0.05
pnpm run ledger
pnpm run reset:ledger
```

## 参考资料

- [MPP - Machine Payments Protocol](https://mpp.dev/)
- [Stripe MPP payments docs](https://docs.stripe.com/payments/machine/mpp)
- [x402 overview](https://docs.cdp.coinbase.com/x402/welcome)
- [x402 HTTP 402 concept](https://docs.cdp.coinbase.com/x402/core-concepts/http-402)
- [Tempo](https://tempo.xyz/)
- [MDN: 402 Payment Required](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Status/402)

## License

MIT
