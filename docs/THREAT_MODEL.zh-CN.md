# 威胁模型

这个项目演示 AI agent 如何为付费研究 API 进行机器支付。主 demo 默认只使用模拟支付，但一旦接入真实钱包、真实 facilitator 或真实搜索服务，风险会明显上升。

## 需要保护的资产

- 用户预算
- 钱包凭证和支付授权材料
- 商户白名单和支付策略
- 支付收据和 ledger 记录
- 用户研究查询内容
- 搜索 API key
- 付费搜索结果
- 隔离示例中使用的 x402 burner wallet 私钥

## 信任边界

- 用户 prompt 到 agent 策略引擎
- agent 到付费 API 服务
- 付费 API 服务到搜索 provider
- agent 或服务端到钱包/payment facilitator
- 本地 ledger 到生产级会计系统

## 主要威胁

| 威胁 | 风险 | 缓解方式 |
| --- | --- | --- |
| 恶意付款请求 | 假 endpoint 或被攻陷的 endpoint 要求 agent 支付过高金额或付给错误收款人。 | 强制商户白名单、收款人白名单、价格上限、协议检查和签名付款要求。 |
| Prompt injection 导致非预期消费 | 搜索结果或用户输入诱导 agent 忽略预算并继续花钱。 | 预算检查必须放在模型 prompt 外部，用确定性代码执行；超过阈值时要求用户确认。 |
| 付款请求头被重放 | 攻击者复用截获的付款凭证解锁其他请求。 | 将 receipt 绑定到 invoice id、金额、收款人、方法、请求哈希和过期时间；已消费 proof 要原子化记录。 |
| 超额消费 | agent 进行大量小额支付，累计超出预期。 | 设置单请求、单会话、单日、单商户限额；ledger 写入失败时默认拒绝继续支付。 |
| 假商户 endpoint | DNS、配置或 UI 欺骗让 agent 调用仿冒付费 endpoint。 | 固定商户身份，验证 TLS，使用签名付款元数据，并分离 dev/test/prod 配置。 |
| 私钥泄露 | 开发者把生产钱包私钥放进 `.env` 或日志。 | 示例只用 testnet key，隔离签名逻辑，禁止日志输出 secret，优先使用钱包或 facilitator 服务。 |
| 不可信 API 结果 | 付费搜索内容包含错误信息、恶意链接或 prompt injection。 | 把搜索结果视为不可信数据，保留来源，清理渲染内容，并把工具调用策略和内容分离。 |
| Ledger 被篡改 | 本地 JSON 记录被修改或丢失。 | 生产环境使用 append-only 持久化存储、交易 id、对账任务和访问控制。 |
| 搜索 API key 滥用 | 泄露的搜索 key 会产生真实 provider 费用。 | 使用 secret manager，服务端限流，轮换 key，不把 provider key 暴露给客户端。 |
| 真实支付示例误用 | 用户可能把隔离 x402 buyer 跑在 mainnet 或不可信 endpoint 上。 | 默认 dry-run，mainnet 必须传入 `--mainnet --confirm-real-money`，强制 endpoint/network allowlist，私钥只能放 `.env`。 |
| 非预期 bridge 或 swap | agent 可能为了获得所需资产自动 bridge/swap，扩大风险面。 | 不实现自动 bridge 或 swap，要求用户手动给 burner wallet 准备资金。 |

## 当前 demo 已有控制

- 主应用默认只使用 mock payment。
- 主应用不集成真实钱包。
- 真实 x402 buyer 逻辑隔离在 `examples/x402-real-buyer`，默认 dry-run。
- client agent 有单次请求预算检查。
- mock receipt 验证会检查 protocol、amount、currency、invoice id 和 mock signature。
- 本地 ledger 记录支付事件，便于检查。
- 真实搜索 provider 只在服务端调用，并且必须显式配置 API key。

## 生产环境缺口

接入真实资金前，至少需要补齐：

- 把策略执行放进经过审计的确定性代码。
- 为 agent 和商户加入强认证。
- 使用真实签名和真实结算验证。
- 用持久化存储实现防重放。
- 加入商户和收款人白名单。
- 对高金额或新商户加入用户确认。
- 加密和轮换 secret。
- 使用持久化 ledger 和对账流程。
- 增加监控、限流和事故响应流程。
- 保持真实支付示例和主 mock 服务隔离。
