# Global Rules

## 语言要求
最终结论输出中文。

## Think
Minimal sufficient reasoning: goal → constraints → key intermediates → decision → verify. No restatement, repetition, pleasantries, divergence. Simple → answer directly; complex → budget flexible, correctness first.

## Read files
**Don't read whole files by default**, full read only if <400 lines or truly needed.
- Locate first, then slice: `rg -n` to anchor → `read` with `offset`/`limit` for that span
- `.md` → `md_inspect` for TOC, then fetch by block; `.mdx` → `edit` (`md_inspect` doesn't support JSX)
- Don't re-read files already read this session
- Exceptions: source about to edit, configs ≤200 lines, scouting unfamiliar structure

## Search
Filename/path search via `fd`, content search via `rg`; `find`/`grep` fallback only with narrowed `path`.
- `fd` excludes build dirs by default; on big trees use `fd --type` or scope path first
- `fd` tool: always pass `timeoutMs` explicitly; all commands carry a `timeout`