# 真实支付

主项目 `agentpay-researcher` 仍然是 mock-only。它只演示 HTTP 402 风格的支付协商流程，不接触真实钱包或真实资金。

真实支付实验隔离在 `examples/` 目录。

## x402 Real Buyer

真实 x402 buyer 示例位于：

```text
examples/x402-real-buyer
```

它可以发现真实 HTTP 402 付款要求；只有在用户显式传入真实执行参数时，才会尝试使用官方 x402 buyer 包付款。

Dry-run 不会花钱：

```bash
pnpm run x402:buyer -- --query "test query" --budget 0.10 --dry-run
```

Testnet 模式可能消耗测试网资产，并且可能需要 faucet token：

```bash
pnpm run x402:buyer -- --query "test query" --budget 0.10 --testnet
```

Mainnet 模式使用真实资金，必须同时传入两个参数：

```bash
pnpm run x402:buyer -- --query "test query" --budget 0.10 --mainnet --confirm-real-money
```

## 安全规则

- 私钥只能放在 `.env`。
- 永远不要提交 `.env`、助记词、私钥、钱包导出文件、截图或生成的 key 文件。
- 使用 burner wallet。
- 钱包余额保持很小。
- 强制 endpoint allowlist。
- 强制 network allowlist。
- 强制单次请求和单次运行预算。
- 不自动 bridge。
- 不自动 swap。
- 没有交易哈希、facilitator receipt 或 provider response 时，不声称付款成功。

## 手动配置

设置：

```bash
X402_PRIVATE_KEY=0x...
X402_NETWORK=base-sepolia
X402_ALLOWED_ENDPOINTS=https://x402.org/protected
X402_MAX_PER_REQUEST_USD=0.10
X402_MAX_PER_RUN_USD=0.25
```

真实 testnet 执行前，需要你手动给钱包准备 endpoint 要求的 gas 和 token。
