# 全局规则（用户级，跨所有工作目录生效）

## Think

Minimal sufficient reasoning — goal, constraints, key intermediates, decision, verify.
No restatement, no repetition, no pleasantries, no divergence.
Simple → answer directly. Complex → budget the reasoning, correctness first.

## Search

- Use `fd`, not `find`（文件名 / 路径搜索一律走 `fd`，不裸跑 `find`）
- Use `rg`, not `grep` / `egrep` / `fgrep`（内容搜索走 `rg`，不裸跑 `grep`）
- `find` / `grep` 工具仅作兜底，用前必须缩小 `path`；`fd` 工具显式传 `timeoutMs`
