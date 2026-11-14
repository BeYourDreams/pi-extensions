> 🔙 返回 [README](../readme.md) · 相关：[CHANGELOG](../CHANGELOG.md)

---

## 6. 首字 token 优化（结论）

**测量方式**（原手册的做法，需要复核时才跑）：沙箱（`PI_CODING_AGENT_DIR` 隔离 + junction 复用 npm/git/skills）+ mock OpenAI provider 抓**真实首请求字节**，再用真网关取 token 计数交叉验证。校准：**1 token ≈ 3.85B**。

**本机静态前缀基线**：`system 3026B + tools 2638B = 5664B ≈ 1.5k tok/请求`（5 个工具：`bash edit omnify read write`，**未含 codemode**）。含 codemode 后 tools 段取决于 `codemode.mode`：`"on"` ≈6.2KB（+≈400 tok）；`"only"` 最高 3000 tok（§6.4）。

> ⚠️ 这组数字是 **0.87.1 时期的实测**，pi 1.3.0 下**未复测**，按结论用、别按字节抠。完整表格、每步优化（`pi-lean-prompt` / `pi-shell` / `<docs>`+`<skills>` 压缩）、以及为什么第三类工具没有常驻，都在 CHANGELOG [§13](../CHANGELOG.md)。

**当前取舍：内建默认 4 个 + `codemode`**（`read edit write bash codemode`），`grep` / `find` / `ls` / `powershell` 全部走懒加载，搜文件用 `omnify` 一步代理执行。

| 做法 | 代价 | 收益 |
|---|---|---|
| 搜索工具常驻（`grep` + `fd`） | tools 8317B，**比本机多 2653B ≈ 689 tok/请求** | 搜索 0 额外往返 |
| **本机：懒加载 + codemode `"only"` + `inlineBudget 0`** | 每次搜索多 1–2 个模型轮次；codemode 前缀只列命名空间（无内联声明，其余走 `searchTools()` 动态发现） | **省 2653B ≈ 689 tok/请求 + 省 codemode 声明（预算压到 0）**（本地端点，轮次几乎不花钱，只花时间） |

- **别压 `<rules>`**：单改 rules 块时落位正常，但与 docs/skills 同改会让 pi 把 rules 正文挪进 agent 文件段、条目与续行错配（pi 侧不确定性，不去碰）。
- **别压 `<tools>`**：那段由 pi 按当前 active 工具动态生成，压它就得自己重建工具表，容易与实际 active 集脱节。
- **要回退**：把 `"grep"` 加回两处 `defaultTools`（[§3.1](配置.md) / [§3.2](配置.md)）即可，`/reload` 生效。
- 单工具 wire 字节：`grep` 846B、`ls` 472B、`find` 504B。
- 原理上**空 `AGENTS.md` 本身就是收益**：system 少一段 = 每轮省 token，且少一个会漂的前缀源（[§5](使用纪律.md) 全局规则）。

---

### 6.4 `codemode` 常驻：结论与配置（2026-11-13）

**结论：与 `pi-lazy-tools` 不冲突，可共存；配置一律写完整裸名（`+codemode` 也能让 codemode 上场，但不会 pin 其余工具）。本机模式选 `"only"`。**

**`+codemode` 的真实行为（2026-11-13 二次实测更正）**：lazy-tools 的 `resolveDefaultTools()` 只 `extractStringArray()`，**原样保留 `+`/`-` 前缀不去符号**，把 `"+codemode"` 当字面量放进 resident 名单，再 `allToolNames.filter(name => !resident.has(name))` 算 lazy 集；`allToolNames` 里只有裸名，`"+codemode"` 命中 0 个。**但它不会把 codemode 隐藏**——codemode 是合成 `builtin:` 源码，进 `nonOmnifiable` 集合，`session_start` 里 `resident = {omnify, ...resolved.resident, ...baselineFallback, ...nonOmnifiable}` 无条件常驻、不进 lazy 集，pi 侧再用 `+name` 激活它，故照常可用（本机实测正是在这种配置下跑通的）。**真实代价**：resident 命中 0 个 → `edit`/`write` 这些可代理的扩展工具全落 lazy 集被隐藏，只剩 `omnify` 一条路（实测 `ALL_TOOLS` 退化为 `read, bash, omnify`）。

**所以要写完整裸名**：`"defaultTools": ["read","edit","write","bash","codemode"]`（绝对写法 = pi 整体替换选择，两边语义一致）。`pi --tools +codemode` 只在单次启动有效，持久配置一律写裸名。

**为什么 codemode 必须常驻、没有第二入口**：
- codemode 是 `builtin:codemode` 扩展，`defaultActive:false`（注册不激活）→ **不写 `defaultTools` 就永远不在 active 集**，模型看不到。
- 它的 `sourceInfo` 是合成 `builtin:` 路径（`getSyntheticPathSource` → `source:"builtin"`），被 lazy-tools 的 `nonLoadableSourceReason()` 判为不可加载 → **`omnify` 代理不了**（同 `ls`/`powershell` 一类）。
- 两条合起来 = 常驻是唯一启用方式（[§5](使用纪律.md) 第 0 条破例，按「缺失即瘫」归第三类）。

**模式 `"only"`（本机 2026-11-13 起选此，与 `"on"` 对照）**：
- `"only"`：把全部工具从模型侧隐藏、全列进 codemode 描述，前缀顶到 `codemode.inlineBudget`（**本机 0**；默认 **3000 tok**）。**代价最大，但换来「模型只认 codemode + omnify 两条入口」，工具表由 codemode 描述列出；`searchTools()`/`describeTool()`/`ALL_TOOLS` 只见 **active 集**——被 lazy 藏掉的扩展工具（`edit`/`write` 等）从 codemode 视角不存在，只能经 `omnify` 发现并代调（2026-11-13 实测：`describeTool("edit")` → `undefined`，而 omnify 名单里明列可代调）**，与 lazy-tools「隐藏 + omnify 单入口」方向一致（工具都不直接暴露）。
- `"on"`（默认）：codemode 描述只列 non-direct 工具；被 lazy 藏掉的不在 callable 集 → 不会重复列。每个常驻工具尾部追加一行 `Codemode: tools.x(...) resolves to ...`（约 12 tok × 5）。
- **若嫌 `only` 太贵**（可达 3000 tok），回退到 `"on"`：删 `codemode.mode` 键（保持默认），`/reload` 生效。
- **`only` + `inlineBudget 0`（本机当前）**：只列命名空间、不内联任何声明——省到底，但模型看不到工具名会硬点名 `bash`（声明仍在 active 集会被执行），兜底靠 [`codemode-only.ts`](../readme.md) 拦直调、回指 `tools.x()`。其余工具走 `searchTools()`/`describeTool()` 动态发现（脚本内消化，不额外产请求）。**`searchTools` 与 `omnify` 是两条路**：前者在 codemode 沙箱本地算（0 额外轮次），后者是模型侧工具（+1–2 轮）。

**成本（`"only"`，实测 pi.exe 实现）**：取决于 `inlineBudget`（**本机 0**；默认 **3000 tok** 上限）。内置工具全量声明实测约 800–1200 tok；有 MCP server 时顶到 3000。而 `"on"` 下仅 ≈+400 tok（工具描述主体 ≈355 + 常驻工具尾部备注 ≈60）。**`"only"` 是把预算从 ~400 放大到最高 3000 tok 的开关，按需取舍。**

**`codemode.inlineBudget`：本机写 `0`**。仅列命名空间、不内联任何声明——省到底，但模型看不到工具名会硬点名 `bash`（且被 pi 执行），由 `codemode-only.ts` 拦直调兜底。若要可见声明可改为 `400`（内建四件 ≈304 tok 的最小可用值）或更高（默认 3000）。

**与 MCP / deferred 的接合点（零成本组合）**：MCP 工具默认 `exposure:"deferred"`，lazy-tools 的 `isAlwaysCallableExposure()` 视 `codemode`/`deferred` 为「注册即可调、与 active 集无关」→ 不隐藏；codemode 脚本可经 `tools.<name>` 直调。这是 codemode + lazy-tools + MCP 唯一零请求侧变化的组合路径，无冲突。

**与 lazy-tools 的接合点**：lazy-tools 的 `isAlwaysCallableExposure()` 把 `codemode`/`deferred` 视为「注册即可调、与 active 集无关」；且 codemode 是 builtin 合成源码（`nonLoadableSourceReason` 判不可加载）→ **lazy-tools 不会隐藏它、omnify 也代理不了它**。故 codemode 只能常驻，与 lazy-tools 无争夺；两者唯一的叠加效应是 token（§6.4 成本）。

**codemode 内按需加载技能（lazy 路径，2026-11-13 实测）**：codemode 沙箱**没有** skills API（Globals 仅 `searchTools`/`describeTool`/`describeNamespace`/`ALL_TOOLS`/`models`），技能检索唯一入口是 `tools.omnify`（omnify 在 active 集，`mode:"only"` 也不砍掉）。技能全文不注入，按需 `read SKILL.md`：

```js
const r = await tools.omnify({ goal: "越级反杀 绝境翻盘" }); // goal 用触发信号词，BM25 才命中
const p = r.match(/（([A-Za-z]:[^）]*SKILL\\.md)）/)?.[1];      // 返回含 `（盘符:\\...\\SKILL.md）`
if (p) return await tools.read({ path: p });
```

- `goal` 太泛会返"未找到"，用技能描述里的触发信号词（如"越级反杀"）最稳。
- 技能清单（name+desc+path）由 pi 原生常驻注入。**lazy-tools 的剥离只落在 transcript，真实 payload 里仍是全量**（2026-11-14 复核，见 §6.5）；codemode 只管工具呈现，与技能注入无关。


---

### 6.5 技能索引懒加载：纯配置（2026-11-14）

**结论：不写扩展。`disable-model-invocation: true` + 一行名单，首请求 6724 → 4928 tok。**

**先纠正一条旧结论**：`pi-lazy-tools` 在 `before_agent_start` 里把 `sections.skills` 换成一行 `SKILLS_NOTE`，但那只改了 **transcript 里记的 section**，**provider payload 仍是全量 `<available_skills>`**。证据：`before_provider_request` 抓 payload，system 段 9242 字符、`available_skills` 命中；同一次运行的 session jsonl 里 section 却是 67 字符的 shim。反之清空 `options.skills` 或给技能打 `disable-model-invocation` 都能真让 payload 变小——也就是说，只查 jsonl/transcript 会被骗，必须抓 payload 或看 token 计数。

| 方案 | 首请求 prompt | 组成 | 判断 |
|---|---|---|---|
| 默认（索引常驻） | 6724 tok | `<available_skills>` 11 条，≈2000 tok | — |
| **frontmatter `disable-model-invocation: true` + `~/.pi/agent/AGENTS.md` 名单** | **4928 tok** | 名单 ≈180 tok，索引 0 | **采用**（0 扩展、0 新工具，`/skill:name` 与 `read` 不变） |
| 自写扩展：清 `options.skills` + `skill(goal)` 按需检索 | 4747 tok | 一行提示 + 名单 | 弃用（只多省 180 tok，却多一个要维护的扩展；已存 `~/.pi/agent/extensions/.disabled/lazy-skills`） |

**维护成本**：新装/改名技能要跑一次 `node mark-skills-lazy.mjs`，并在 `config/agent/AGENTS.md` 名单里补一条。要恢复常驻索引：删掉各 SKILL.md 的这行标记即可。

**为什么名单不能省**：`disable-model-invocation` 是「对模型不可见」，不是「可检索」。名单里那 2~4 字提示（如 `short-drama-pro=剧本+分镜+视频提示词`）是唯一路由信号；7 个 `short-drama-*` 只靠名字会串味。
