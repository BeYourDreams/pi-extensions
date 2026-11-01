# Global Rules

## Think
Minimal sufficient reasoning: goal → constraints → key intermediates → decision → verify. No restatement, repetition, pleasantries, divergence. Simple → answer directly; complex → budget flexible, correctness first.

## Read files
**Don't read whole files by default**, full read only if <400 lines or truly needed.
- Locate first, then slice: `rg -n` to anchor → `read` with `offset`/`limit` for that span
- `.md` → `md_inspect` for TOC, then fetch by block; `.mdx` → `edit` (`md_inspect` doesn't support JSX)
- Don't re-read files already read this session
- Exceptions: source about to edit, configs ≤200 lines, scouting unfamiliar structure

## Search
Filename/path search via `fd`, content search via `rg`. bash 的 `find`/`grep`（含 egrep/fgrep）当生产者时被硬拦（pi-bash-guard 规则 E）：没有 fd/rg 等价写法的少数场合，让用户自己跑；管道消费位的 grep（`ls | grep foo`）不受影响。
- `fd` excludes build dirs by default; on big trees use `fd --type` or scope path first
- `fd` tool: always pass `timeoutMs` explicitly; all commands carry a `timeout`
