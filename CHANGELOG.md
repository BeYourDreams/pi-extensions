## 2026-11-22 技能更新检测并发化

- `extensions/skill-updater.ts`：启动检查把 3 个配置仓库 + `gitRoots` 的远端 ref 并发取回（原来串行 5 次 `git ls-remote`），实测同一台机 7.2s → 3.3s；失败按仓库记账，不影响其他仓库。
- 实测确认镜像生效：5 次远端查询都带 `-c url.https://ghfast.top/...insteadOf=...`，直连 `github.com` 约 20s（且常失败），SSH 4.6–7s，镜像 1–2s —— 进程列表里显示 `github.com` URL 是 `insteadOf` 改写前的原始参数，不代表走直连。
- `skill-updater.check.mjs` 加并发断言（峰值并发 ≥3）并跑通；同步仓库副本到 `~/.pi/agent/extensions/`（`/reload` 生效）。

## 2026-11-21 技能自动更新扩展纳入仓库

- 昨天只装在用户目录的 `~/.pi/agent/extensions/skill-updater.ts` 与 `~/.pi/agent/skill-updater.json` 收进仓库 canonical（`extensions/`、`config/agent/`），由两个 install 脚本幂等同步；否则 `install-local-extensions.mjs --prune` 会把它当孤儿删掉。
- 实测有效：临时把 `checkIntervalHours=0` 起一次 `pi --no-session -p ok`，`skill-updater-state.json` 的 `lastCheck` 前移，配置已还原。`/skill-update` 只在交互 TUI 有效，print 模式吞掉 slash 命令。
- `config/agent/settings.json` 的 `lastChangelogVersion` 1.5.2→1.6.0（对齐用户级实际值，防止同步后 changelog 重播）。
- `readme.md` §1.2 本地扩展 2→3 并补配置/验证说明；§2.3 区分技能自动更新与 `pi update --extensions`。
- 执行 `pi update --extensions`：`npm:pi-prefix-stabilizer` 0.3.0 → 0.4.1（其余 7 个未变，`pi list` 仍 8 条）。验收：`fix-proper-lockfile-proxy.mjs --check`、`fix-pi-one-ui-theme.mjs --check`、两个 install 脚本 `--check`、`mark-skills-lazy.mjs --check` 全 exit 0，冒烟无 extension_error。

## 2026-11-19 codemode：inlineBudget 400→0（隐藏工具声明）

- 用户级 `~/.pi/agent/settings.json` 与仓库 canonical `config/agent/settings.json`：`codemode.inlineBudget` `400 → 0`（`mode: "only"` 不变）。
- 效果：codemode 描述只列命名空间、不内联工具声明；工具靠脚本内 `searchTools()`/`describeTool()` 发现；无直调拦截器（`only` 只隐藏声明、不改 active 集，硬点名直调仍可能执行）。
- 同步 `readme.md`、`docs/配置.md`、`docs/token优化.md`；`/reload` 或新会话生效。

## 2026-11-15 卸载 omnify（pi-lazy-tools）

- **卸载**：从全局 `~/.pi/agent/settings.json` 与仓库 `config/agent/settings.json` 的 `packages` 移除 `git:github.com/BeYourDreams/pi-lazy-tools`（该包注册 `omnify` 懒加载代理工具）。
- **文档同步**：`README.md` 清单 9→8（6 npm + 2 git），移除安装/镜像/升级验收中的 lazy-tools 与 `fix-lazy-tools-notes.mjs` 相关项；`docs/工具归属.md`、`docs/配置.md`、`docs/token优化.md` 标记 omnify/pi-lazy-tools 已卸。
- **注意**：未执行 `pi remove` 清理 git 包缓存目录（当前环境无可用 shell）；如需彻底清理残留，手工运行 `pi remove git:github.com/BeYourDreams/pi-lazy-tools` 或删除对应 git 包目录后重启/`/reload`。

# Pi 扩展安装配置 — 删改记录 / 冲突与遗留 / 实录

## 7. 已知冲突与遗留

### 7.1 `edit` 工具槽位：已定为 `@aboutlo/pi-smart-edit`

`pi` 不允许两个扩展注册同名工具。`pi-edit-guard` 与 `@aboutlo/pi-smart-edit` 都想覆盖内建 `edit`，同时装必报：

```
Error: Failed to load extension ".../@aboutlo/pi-smart-edit/src/index.ts":
Tool "edit" conflicts with ".../pi-edit-guard/dist/index.js"
```

**决定：卸载 `pi-edit-guard`，由 `@aboutlo/pi-smart-edit` 独占 `edit`。**

| | `pi-edit-guard`（已卸） | `@aboutlo/pi-smart-edit`（在用） |
|---|---|---|
| 匹配策略 | 14 趟分级匹配 + 锚点窗口 + 自修复 | 精确 → NFKC 归一化行匹配 |
| 附加能力 | 注册 `undo`、越界 cwd 提示、`.env`/secret 提示、锚点与诊断报告 | 无 |
| 代价 | edit 描述更长（+59B/请求） | **失去 `undo` 与全部 guard 提示** |

`undo` 的替代：文件级靠 git（或改前先 `read` 留底）。会话级的 `pi-undo-redo` 也已卸载（2026-09-29），暂缺替代。这与本机「有 git、改动走 `md_edit`/`edit` 精确替换」的习惯相容。卸载连带清了 `~/.pi/agent/state/pi-undo-redo/`（13 个 worktree、52MB 死数据）。

> 若哪天要回退：装回 `pi-edit-guard` 并卸 smart-edit 即可；或给 edit-guard 写 `~/.pi/agent/extensions/edit-guard-config.json` 的 `{"editOverrideEnabled": false}`（**必须是 `extensions/` 子目录，放 `~/.pi/agent/` 根下不生效**——已实测），让它只让出 `edit`、保留 `undo`。

### 7.2 其它遗留

**已清理的死配置/死数据**（细节都在 git 历史里）：`~/.pi/lazy-tools.json`（含 `.bak`/`.bak2`，常驻名单已进 `settings.json` 的 `defaultTools`）、`settings.json` 里的 `alps-pi` 块、`~/.pi/agent/pi-hermes-memory/`（19MB）、`.backup-20250915/`（105 个文件，要找回：`git checkout bb9a6ae -- .backup-20250915`）、`settings.json.bak-*`、`state/pi-undo-redo/`（52MB）、`pi-better-toolcalls-undo-store.jsonl`（4MB）。共约 76MB。

**2026-10-09 本轮体检又清一批**（`config/` 已清空、`state/` 只剩 `pi-pet-autostart.json`）：

| 死物 | 为什么是死的 |
|---|---|
| `config/smart-context-ext-config.json` | 包已于 2026-10-02 卸载（§3.2），文件没人再读 |
| `settings.json.bak-160608` | 手写备份 |
| `pi-tidy-tools.pi-fff.json` | fff / pi-fff 卸载后的残留 |
| `fff/`、`pi-fff/`（缓存） | 同上 |
| `state/pi-undo-redo/` | pi-checkpoint 接手 undo/redo 后残留 |
| `state/pi-pet-host.cjs`(+`.lock/`) / `state/pi-pet-host.exe`（**89MB**） / `pi-pet-ctrl.json` / `pi-pet-global.json.electron.json` | 旧架构（0.0.1 内嵌宿主）的宿主脚本/镜像 exe/控制与全局状态文件，现由上游 `bin/pi-pet.cjs` + `<home>/ctrl.json` 接管（§3.6.2）；其中 `pi-pet-global.json.electron.json` 正是铁律 3 警告的「写它会让两个宿主互相认定对方活着」的那类文件 |
| `.pi-hermes-locks.sqlite{,-shm,-wal}`（4.1MB） | `pi-hermes-memory` 卸载后的 WAL 残留 |

> 删前建议先 `node -e` 列出路径确认（删除不可逆）。`config/` 空了不是异常：**只有某些包会往 `~/.pi/agent/config/` 写 `startupConfig`**（本机清空后仍只服务上述几个已卸包）。

**故意保留**：

- `~/node_modules/@earendil-works*@0.85.1`：一棵自洽的 0.85.1 生态，`@wolido/pi-lazy-tools` 依赖它，删了会连带坏掉。pi 自身的扩展从 `~/.pi/agent/npm/node_modules`（Pi 1.1.0）解析，**不会走到家目录那份**。

### 7.3 `omnify` 的两个 fork 修复（2026-09-29，`e972047`，已 push）

本地 clone `D:\AI\pi-lazy-tools`（remote = 你的 fork）改完直接 commit + push，`pi update --extensions` 就会带上；改前先看 `npm test`（`node --import tsx --test`）。

1. **内建工具执行不了却说「执行定义加载失败」**：pi 内建工具由内部工厂生成，`sourceInfo` 是合成标记（`agent-session.js:2502` `createSyntheticSourceInfo('<sdk:ls>', { source: "sdk" })`），jiti 没法 import。新增纯函数 `lazy-tools/core.ts` 的 `nonLoadableSourceReason()`，**先判后 import**，直接给「内建工具 omnify 执行不了，请用 bash / powershell」的可执行原因。
2. **非指名模式下静默执行错工具（假成功）**：旧代码候选失败后无条件 `continue`；schema 宽松的 `mcp`（`Record<string, unknown>`）会照单全收，返回 `MCP: 0/0 servers, 0 tools` 冒充成功。改为：**候选一旦通过参数校验并开始执行，它就是最佳匹配，失败即最终失败**（`break`）；校验不符时仍按原逻辑（非指名继续试下一个，指名立即返回要求）。
   - **BREAKING**：不再有「首个候选失败后自动换一个工具」。
   - 回归：`npm test` 76 passed（新增 4 条），`tsc --noEmit` 干净；改动同步到已装副本 `~/.pi/agent/git/github.com/BeYourDreams/pi-lazy-tools/`，`check-ext-errors` 的 `extension_error` 0。

### 7.4 `pi-web-access`：卸过一次又装回来了（2026-09-30 卸 → 2026-10-06 复装）

**历史决策（当时是对的）**：`pi remove npm:pi-web-access`，连带删掉两个只为它存在的缓存目录 `~/.pi/web-search-cache/`、`~/.pi/agent/web-search-cache/`（§2.4 纪律）。卸载后重跑 bench：**5 个工具 / system 3026B + tools 2638B = 5664B**。

**当时的卸载理由：`web_enable` 会在会话中途切 active 工具集，把前缀缓存整段掀掉。** 这是它的加载器设计：模型调空参 `web_enable` → `pi.setActiveTools([...现有, 4个])` → 工具集一变，请求前缀从第 0 个 token 起全部作废。本机实测（会话 `--D--AI-LLMlocal--/2026-09-30T00-55-59-851Z_01a0efcf…`）：

| 轮次 | input | cacheRead |
|---|---|---|
| 调 `web_enable` 前 | 3291 | 86016 |
| 调完（`toolsAdded` 四工具） | 92007 | **1152** |
| 下一轮 | 2233 | 91008 |

即激活那一轮把整段 89K 上下文按新 token 重算了一遍，下一轮才恢复。

**复装理由 + 上游修没修**：0.37.0 把激活策略提成配置项 `toolActivation`（`auto`/`dynamic`/`eager`，`registerWebToolActivation(pi, tools, mode)`；`eager` 时压根不注册加载器）。写 `eager` 后掀缓存的**机制不存在了** —— 旧的卸载结论已被新版本推翻，保留本节只作决策记录。现按 §3.7 配置，且 lazy-tools 又把四工具收进懒加载集：前缀既不掀、也不长胖。

> 顺带回答「懒加载工具会不会掀缓存」：**不会**。`omnify` 只在 `session_start` 调一次 `setActiveTools` 做隐藏（`D:\AI\pi-lazy-tools\lazy-tools.ts:487`），执行隐藏工具走 `findToolDefinition` + jiti 直接调 `definition.execute`（同文件 :349），**全程不动 active 集**；`load_tools`/`call_tool` 自 0.4.0 起已撤销。只有像 `web_enable` 这样主动 `setActiveTools` 的加载器才会掀 —— 且现在只在你主动配 `toolActivation: "dynamic"` 时才存在。内建工具（`ls` 等）omnify 根本执行不了（`nonLoadableSourceReason` 先判后 import），更不存在「激活」一说。

---

### 7.5 pi-dsh-pet 0.0.2 的两个上游坑（本机实测，2026-09-30）

1. **`probeCaps()` 把自己的宿主误判成「没有控制面」**。判据是「`GET /control` 不带 action → 400 **且 `body.hint` 非空**」，但 v0.0.2 的宿主回的是 **400 + 空 body `{}`**（带 hint 的那条分支只在 POST 上）。后果：照抄它的扩展会把 `say` / `show-window` 全拦下来 —— 表现就是**「宠物在跑，但 `/pet` 怎么都叫不出窗」**。判据放宽到「非 404」即可（400 本身就说明端点在、只是不接受空 action）。
2. **每 2s 探一次宿主能力会把服务端日志刷屏**（上游自己在 `app/server.cjs` 里为此专门加了注释）。本扩展改成「动作失败才探」+ 5s 缓存，热路径一个 GET 都不发。

**顺带修掉的一个自造 bug**：`connectFeed()` 先 `await findHost()`（一次 HTTP）才建 socket，这段 await 里 `sock` 还是 null —— 看门狗、会话事件、重连定时器撞在一起时会各开一条，`sock` 只留最后一条，前面的**没人关**（`close` 回调还会误杀活着的那条），宿主那边 `feeds` 只增不减（本机实测 15s 涨到 18）。开着是真连接泄漏，长会话必拖垮宿主。已加 `feedPending` 在途闸 + `close` 只认自己那条，探针有对应用例（`B2b`：整个会话只建一条 `/feed`）。

**旧路遗留的死文件**（架构换了，**已清**，本机 `state/` 下只剩 `pi-pet-autostart.json`）：`~/.pi/agent/state/pi-pet-host.cjs`（内嵌宿主源码，已不再落盘）、`pi-pet-global.json*`、`pi-pet-ctrl.json`、`pi-pet-host.cjs.lock/`、`pi-pet-host.cjs.boot.lock/`。新架构只认 `<home>/`（`%APPDATA%/pi-dsh-pet`）里的 `port` / `token` / `state.json` / `ctrl.json` / `host.lock` + `state/pi-pet-autostart.json` + `state/spawn-log.txt`。

### 7.6 `pi-session-memory` 加载即败

`pi install npm:pi-session-memory` 后 `pi list` 直接报：

```
Failed to load extension ".../pi-session-memory/extensions/index.ts":
ResolveMessage: No such built-in module: node:sqlite
```

Pi 内嵌运行时缺 `node:sqlite` 内建模块。已 `pi remove`，跨会话记忆换 `@chendpoc/pi-memory`（deps 无 sqlite：chalk/dayjs/dotenv/es-toolkit/execa/lru-cache/proper-lockfile），`pi list` 加载正常。

### 7.7 `@henryqw/pi-pr` 卸载 + `pi-zvec` Windows 补丁（2026-10-07）

**pi-pr**：装后报 `Error: PR status refresh failed: status unavailable` —— 它依赖 `gh` CLI，本机未装。已 `pi remove npm:@henryqw/pi-pr`。备选 `@narumitw/pi-github-pr` 自述「Requires `gh`; there is no direct GitHub API or `GITHUB_TOKEN` fallback」。结论：**不装 gh CLI 就没有 PR 插件**，PR 需求用 `mcp`/`bash`+git 绕。要装 gh：`winget install GitHub.cli` + `gh auth login`，之后重新装 pi-pr。

**pi-zvec**：两处需知（**已卸载 2026-10-08，见 §7.11**；下为历史留档）。

1. `zg` 二进制：pi 内嵌 npm 装 `@zvec/zvec-grep` 时 install 脚本被 `allowScripts` 拦（`install failed`）；已手动 `npm i -g @zvec/zvec-grep`（§3.1 的 `allowScripts` 名单未加它，靠手动装）。`zg index` / `zg query` 实测通（本地 potion-code-16m-v2 embedding，256 维）。
2. **Windows spawn 补丁**：上游 `env.ts` / `zg.ts` 裸 `spawn(ZG_BIN, ...)` 无 `shell:true`，Windows 上解析不到 `zg.cmd`（node 对 `.cmd` 裸 spawn 直接 `EINVAL`）。本机已 patch：两处 spawn 加 `shell: true`（env.ts 的 `--version` 探测、zg.ts 的执行入口）。**`pi update --extensions` 会冲掉此补丁**（同 fix-lazy-tools-notes.mjs），重装后重打：

```bash
sed -i 's/spawn(ZG_BIN, \["--version"\], { stdio: \["ignore", "pipe", "pipe"\] })/spawn(ZG_BIN, ["--version"], { stdio: ["ignore", "pipe", "pipe"], shell: true })/' ~/.pi/agent/npm/node_modules/pi-zvec/env.ts
sed -i 's/spawn(ZG_BIN, args, { cwd: opts.cwd, stdio: \["ignore", "pipe", "pipe"\] })/spawn(ZG_BIN, args, { cwd: opts.cwd, stdio: ["ignore", "pipe", "pipe"], shell: true })/' ~/.pi/agent/npm/node_modules/pi-zvec/zg.ts
```

症状若再现：`could not run zg: not found on PATH`。验证：`node -e 'const{spawn}=require("child_process");spawn("zg",["--version"],{shell:true}).stdout.on("data",d=>console.log(String(d).trim()))'`。


**`indexMode: "auto"` 与 `index reported not ready after a successful build`**：

- 自动模式：`<项目>/.pi/zvec.json` 写 `{"indexMode":"auto","disabled":false,"coach":true,"verify":true,"gitignore":true}`（本仓库已写；**`.pi/` 已 gitignore（2026-10-08），不再随 repo** —— fresh checkout 需手写该文件才有 auto 索引；本机副本保留）。默认 `ask` 每次开仓弹选择框，`auto` 后台建/更新不弹。
- 该 warning = **良性竞态**：auto 后台建完 → 紧接着 `zg status --check-ready` 判 `stale`（构建期间文件被改，本机即 readme 刚编辑过）。非构建失败，下次 `/zg:index` 或下个会话 auto 追上。实录：`--check-ready` 报 `not ready (state: stale)` → 重跑 `zg index`（7s，1 modified）→ `--check-ready` exit 0。

### 7.8 `pi-ask-permission` 卸载（2026-10-30 前后）

替代 gate 靠 secret-guard 等钩子组合（**注**：secret-guard 已于 2026-10-12 卸载，见 §7.19；现在提交侧无拦截闸）。

### 7.9 `no-find` 全局卸载（2026-10-08）

本机恢复 `find`，撤掉「禁用 find」全部 4 层封锁（§4.2 留档为历史）：

- 仓库：`git rm extensions/no-find.ts`；已装的 `~/.pi/agent/extensions/no-find.ts` 同步删除（同步脚本只拷不删，需手工）。
- 系统层回退到 `~/.pi/agent/no-find-global.json` 备份的原值：
  - 用户 `PATH` 去掉 `C:\Users\yinxuehao\bin`（该目录只剩 find 桩，已一并删除）；
  - 用户 `BASH_ENV` 还原为未设置；
  - `~/.bashrc` 里 `find()` 拒答函数与注释删除；`~/bin/no-find.sh` / `~/bin/find.cmd` 删除。
- 备份 `~/.pi/agent/no-find-global.json` 已删（还原完即无用）。

生效无需 `/reload`（没动 pi 的扩展加载）；`find` 回到系统原样（System32 FIND.EXE / GNU find 并存，按 PATH 顺序命中）。

> 2026-11-03：`find`/`grep` 不再拦截/不全局指向，仅提示词限制优先 fd/rg。口径见 §5 第三类。

### 7.10 `pi-cwd-guard` 卸载（2026-10-08）

`.env` 防误写改回常规默契；提交侧凭据拦截曾由 `pi-secret-guard` 兜底 —— **该包已于 2026-10-12 卸载**，提交侧现无拦截（§7.19）。

### 7.11 `pi-zvec` 卸载（2026-10-08）

卸载与残留清理（`zg`/索引数据可由重装重建）：

- `npm uninstall pi-zvec --legacy-peer-deps`（在 `~/.pi/agent/npm/`；裸 `npm uninstall` 报 ERESOLVE）→ package.json/lock/node_modules 全清。
- `~/.pi/agent/settings.json` packages 移除 `"npm:pi-zvec"`。
- `npm uninstall -g @zvec/zvec-grep` → 全局 `zg` 二进制删（79 包）。
- 项目索引与配置全删：`<项目>/.zvec-grep/` + `<项目>/.pi/zvec.json`（本仓库 6.1M、TUIProjectManager 12M、狗头军师 349K）。
- Windows spawn 补丁（§7.7）随包删除作废。替代：`grep`/`fd`/`omnify`，需要语义搜索再重装（重装需重打 §7.7 补丁 + 重写 `zvec.json` auto 模式）。

### 7.12 预算/缓存去重 + 清单漂移补装（2026-10-08）

装 `@xynogen/pix-optimizer` 前做全量重叠排查的副产物，一并处理：

- **卸 `pi-budget-guard`**：与 `pi-meter` 在「花费追踪 → 预算告警 → 超限拦截」三层完全重叠，meter 另有 auto-downshift、跨会话 JSONL 账本、CLI 报表，是超集。原 §1 里「budget-guard 拦截、meter 降级」的分工说法不成立——meter 自带硬拦截。留 meter 卸 guard。
- **卸 `pi-warm-cache`**：§1 自己标注「本机不生效（本地代理属未注册路由），纯静默待命」。按本仓库 0 触发即卸的判据（同 zvec/smart-context）早就该卸。`pi remove npm:pi-warm-cache` 一条即净。
- **补装 `@arhen/pi-core-subagent`、`pi-ocr`**：清单/安装循环里都列了、实际 `pi list` 里没有（清单漂移）。2026-10-08 重装，并把 subagent 补进 §2.1 安装循环（此前循环里就没有它，重装复现不了）。
后端不是 DeepSeek 时三重叠全是白挂的钩子。**→ 2026-10-09 实测结论已出（已卸），见 §7.13**。

### 7.13 压缩侧换血：`pi-deepseek-cache` / `pi-compaction-cache` → `pi-cache-compact`（2026-10-09）

**先验 `pi-deepseek-cache`（装一天，判死）**：DeepSeek 绑定三处——① 省钱估算读 DeepSeek 官方价格表（本机全是虚构）② 压缩调用打 `deepseek-flash`（本机代理对它返回 400 "not a valid model ID"）③ 接管条件 `ctx.modelRegistry.find("deepseek", …)` 在本机注册表里根本没有 deepseek provider → 必失败。只剩遥测半边真实：headless 会话落盘 `~/.pi/agent/extensions/deepseek-cache/stats.json`，实测 `cacheRead:1664 / input:3856 / turns:1` ≈ 30.1% 命中——这同时证明**代理确实返回 `prompt_tokens_details.cached_tokens`，pi-ai 会归一化**。按本仓库 0 触发即卸的判据 → `pi remove npm:pi-deepseek-cache`。

**换 `pi-cache-compact` 0.2.0**（源码 0 处 "deepseek"，provider 无关）。fork 排查留档：上游 `ruanbw/pi-deepseek-cache` 只有 2 个 0-star 陈旧 fork（zzddk / fchaix），不值得。**同时卸 `pi-compaction-cache`**：两者抢同一个 `session_before_compact`，只能留一个。

**端到端实测（本机代理，provider `1` / 模型 `1`，非 DeepSeek）**：

| 场景 | 结果 |
|---|---|
| 自动压缩（89K 陈旧会话，冷前缀） | 扩展发出 128 条消息的续写请求 → `cacheRead: 0` → **拒绝接管**，让位 Pi 默认压缩（`deferAfterCacheMiss` 随后 15 分钟内继续让位），不烧第二次冷 prefill ✅ fail-safe 生效 |
| **手动 `/compact`（本会话，前缀热）** | `summary_start` → `provider_request msgs:162` → `200` → **`wrote cache-friendly summary`，`cacheRead: 81920`** → 压缩落地，会话缩到 54 条消息 ✅ |

命中账：`{cacheRead: 81920, cacheWrite: 0, input: 37576, output: 10084}` → 总 prompt ≈ 119.5K，命中 **68.6%**。对照 Pi 默认压缩：它发的是截断改写后的全新 prompt，同一 119.5K 前缀**必然 0 命中、全量重算**。（`81920` 恰好是 80×1024，说明上游按块记账、只读不写。）

**取舍结论（留 `pi-cache-compact`，不留 `pi-compaction-cache`）**：cache-compact 是唯一在**本机后端**跑完「命中 → 压缩落地 → 会话继续」全闭环的（compaction-cache 的 98.8% 是更早、不同后端的旧数据，恢复它要重走一遍今天的取证流程）；且它有 `deferAfterCacheMiss` 这个别的扩展没有的止损设计。代价：全文续写的摘要很重（本次 output 10084 tok、耗时 **227s**）——长会话压缩本来就慢，可接受。

**验证方法可复现**（供以后复测）：临时把 `models.json` 的 `contextWindow` 压到 9000 制造真实压缩场景 → headless `pi --session <id> -p "…"` 连打两轮大文本焐热前缀 → 手动 `/compact`；想把“手动”与“自动”分开取证，就把窗口调回 128000 排除自动压缩干扰（此时只剩手动一条路径）→ 读 `cache-compact-debug.jsonl` 里 `"summary": true` 记录的 `cacheRead`。坑：headless `pi -p` 会因 pi-dsh-pet 的 `/feed` 重连循环不退出，必须用 `timeout` 包裹（exit=124 属预期噪音）；`-c` 会续上**别的**旧会话（测到过 89K 的），要精确定位就 `--session <id>`。

### 7.14 subagent 把 pi 带崩：`proper-lockfile` 撞 jiti 的 interop Proxy（2026-10-09）

**症状**：subagent 跑着跑着整个 pi 进程死掉，控制台只留一行（没有扩展名、没有 TUI 堆栈）：

```
TypeError: Proxy handler's 'get' result of a non-configurable and non-writable
property should be the same value as the target's property
    at probe (C:\Users\yinxuehao\.pi\agent\node_modules\proper-lockfile\lib\mtime-precision.js:6:29)
```

（`6:29` 正是 `const cachedPrecision = fs[cacheSymbol];` 里 `fs` 的位置。行尾那串 `[13;5u[57442;1:3u` 是崩前 TUI 刷屏留下的转义残渣，不是错误的一部分。）

**根因（已本地复现，非猜测）**：`proper-lockfile@4.1.2` 的 `lib/mtime-precision.js` 把探测到的 mtime 精度用 `Object.defineProperty(fs, cacheSymbol, { value })` 挂在 **fs 模块对象**（= `graceful-fs` 的 exports）上，之后每次加锁都读 `fs[cacheSymbol]`。而 pi 用 **jiti 加载扩展**（`moduleCache:false` + `interopDefault:true`），jiti 的 interop 会把 CJS exports 包一层 **Proxy**：get 陷阱把每次取值缓存进 `Map`，对 target 上不存在的键（含 Symbol）返回并**缓存** `undefined`。于是：

1. 第 1 次 probe：`fs[sym]` → `undefined`（顺带被 trap 缓存）→ 继续；`defineProperty` 落到 Proxy 的 **target** 上，该属性变成 non-writable + non-configurable；
2. 第 2 次 probe：`fs[sym]` 命中 trap 缓存 → 仍返回 `undefined`，与 target 里的 `'ms'` 不等 → **JSC 抛 Proxy 不变量 TypeError** → 未捕获 → pi 死。

**为什么「像 subagent 的锅」**：subagent 只是在运行期触发落盘（settings/auth/trust、子代理状态），真正的雷是**同进程内第二次及以后**的加锁。fs 是不是 Proxy 与锁本身无关，jiti 只是让 `proper-lockfile` 内部的 `require('graceful-fs')` 拿到了 interop Proxy。

**处置**：缓存从 fs 对象挪进模块级 `WeakMap`（以 fs 对象为键），完全不再改写 fs——语义等价（仍是「每个 fs 对象只探测一次」），对 Proxy 免疫。`node fix-proper-lockfile-proxy.mjs`（幂等，`--check` 只体检）会把 `~/.pi/agent` 下**所有** proper-lockfile 副本一起改掉（本机 2 份：`agent/node_modules` + `agent/npm/node_modules`），写后回读校验。**pi 升本体/重装 node_modules 会冲掉补丁，重跑即恢复**（§2.3 已加提醒）。

验证：补丁前用 jiti 复现脚本抛的是同一行 frame（`at probe (...mtime-precision.js:6:29)`）；补丁后同一脚本在 bun 与 node 下、两个副本共 4 组全部通过（两次 probe 正常回调，无不变量错误）。

> 上游真修要看两处：jiti interop 的 get 陷阱（对非 own key 不该缓存 `undefined` / 该走 `Reflect.get`），或 proper-lockfile 别往外来对象上挂属性。本仓库只做后者，幂等且不动语义。

### 7.15 全机体检实录（2026-10-09）：清单没漂，漂的是「必做配置层」

对照 readme 与本机逐项过了一遍，**28 个扩展本身零漂移**（`pi list` = `settings.json` 的 `packages` = §1 表，26 npm + 2 git；本地扩展与仓库逐字节一致）。问题全在清单之外的层：

| # | 发现 | 根因 | 修法 | 验证 |
|---|---|---|---|---|
| 1 | **上游 `pi-dsh-pet` 扩展一直在加载**，与本地薄客户端重复注册 `/pet` `/pet-stop` `/pet-say` `/pet-status`（铁律 1 的事故源） | `extensions: []` 只筛 **npm 包内的子扩展**，对 git 仓库顶层 `pi/extensions/index.ts` 无效；以前一直以为「写了 extensions:[] 就算屏蔽」 | `packages` 里改成 object form：`{"source": "git:github.com/BeYourDreams/pi-dsh-pet", "extensions": []}`（§3.6） | `pi list` 该行显示 `(filtered)`；headless `pi --no-session -p "reply with: ok"` 里**再没有** `[pi-dsh-pet] /feed 连接断开，2s 后重连`，只剩本地客户端的 notify OSC 777 + `ok`；条目数仍 28 |
| 2 | `cache-compact.json` 是 debug 配置，会 dump 全量 payload（1.1MB） | 当初为取证开后忘关 | 改生产白名单 `{"models": ["1/1"]}`，删 `cache-compact-debug.jsonl`（§3.3） | 文件 23B，`debug` 键没了 |
| 3 | 一批死数据/死配置 | 旧架构 + 已卸包的遗留 | 列在 §7.2 表格，一律删 | `config/` 空、`state/` 只剩 `pi-pet-autostart.json` |
| 4 | **better-sqlite3 binding 丢了**（pi-memory 的 vec 索引用不了，报 `Could not locate the bindings file. Tried:`） | `npm uninstall` 触发整棵树重解析：`allowScripts` 里钉的 `better-sqlite3@13.0.3` 与树内实际的 `12.11.1`（pi-memory 的 `^12.10.0`）对不上 → npm 当「未覆盖」→ `node-gyp rebuild` 被挡 | `npm install-scripts approve better-sqlite3`（**不带版本号**）+ `npm rebuild better-sqlite3`（§3.1） | `node -e "require('better-sqlite3')(':memory:')"` OK；`npm install-scripts ls` 只剩 pi-memory 的 postinstall（有意不批） |
| 5 | `fix-lazy-tools-notes.mjs` 补的 DOCS_NOTE 路径**大小写错了半角** | 脚本做**精确字符串替换**，`D:\agent\pi\docs` 与实机 `D:\Agent\pi` 不符就不匹配 | 重跑脚本（幂等），并同步到已装副本 | `--check` exit 0；已装副本 `git status` 显示 ` M lazy-tools.ts` |
| 6 | readme 的必做配置层漏了 3 样东西 | 一边改一边没补文档 | §3.9 `bash-prelude.sh`（`shellCommandPrefix`，**2026-11-04 已作废，不恢复**）、§3.10 `-builtin:mcp`、§3.11 用户级 settings 备忘 | 照另两条即可从零复现 |
| 7 | readme 安装循环漏了 4 个包 | 清单加了但循环没加（§7.12 同一类错） | §2.1 补 `pi-secret-guard` / `pi-mono-context-guard` / `pi-meter` / `@narumitw/pi-plan-mode` | 循环数 = 26 npm + 2 git |

**顺序纪律（本次最贵的经验）**：先备份 → 改 `settings.json` → 验证 → 清死数据 → 补文档，**不要**在会话开着的时候边走边改（§9.6）。本轮全程用 headless `pi -p` 做验证，不碰自己这条交互会话。

**留个教训**：`extensions: []` 是「只筛 npm 包内子扩展」的语义，不看文档只信直觉，会让上游扩展在机器上多跑一个月都没人发现。**凡是屏蔽类配置，改完必须用 headless 实测**（只看 `pi list` 有 `(filtered)` 才行——那才是真屏蔽）。

---

### 7.16 子代理调不起来：不是插件坏了，是**一个 agent 定义都没有**（2026-10-10）

**症状**：子代理坏掉时**不报错、不崩、不进 `crashes.json`**，只是安静地调用失败或什么都不返回。表面看像插件坏了，实际是**配置文件一个都没装**。

**根因**：`@arhen/pi-core-subagent` 的 `src/agentfile.ts:20` 写死了发现目录：

```ts
const AGENT_DIRS = [".agents/agents", ".claude/agents", ".pi/agents"] as const;
```

它只从这三个目录读 `.md`（frontmatter 的 `description` 参与按描述匹配）。本机实测**三个全不存在**，`~/.pi/agents` 也没有 → 没有 agent → `agent` 参数无值可填。

**复现链（每一步的报错都指向同一处，很有迷惑性）**：

| 尝试的 args | 实际报错 |
|---|---|
| `{task}` | `Provide one subagent mode: agent+task (single), tasks: [...]…` |
| `{agent:"default", task}` | `2 model(s) available — this session has no model scoping…`（要求先定 model） |
| `{task, autoAwait}`（漏 goal） | `Validation failed for tool "omnify": goal: must have required properties` |
| `autoAwait: "true"`（字符串） | `参数不符（autoAwait: expected boolean, got "true"）` |

**修法**：建 `~/.pi/agents/default.md`（带 `description` frontmatter）。装完实测 `1/1 succeeded`，子代理正常返回。已固化为 `node fix-subagent-check.mjs`（幂等 + `--check`）。

> 冒烟测试默认**不跑**：rpc 没有「直接调工具」的命令，只能让模型发一次 tool call，受模型行为影响（会漏 `goal`、会把布尔值写成字符串）。故默认只做确定性静态检查（0.2s、不花 token）；需要确认「此刻真能调」时显式加 `--smoke`。

#### ⚠️ 一条已被实测推翻的诊断（勿再照抄）

当时另有诊断称：
> `pi.exe` 是 `bun build --compile` 单文件可执行；子代理从 `~/.pi/agent/node_modules` 动态加载 `pi-ai` **0.87.1**；该文件 `dist/utils/json-parse.js` 首行是 bare specifier `import … from "partial-json"`；而 Bun 编译版解析外部 bare specifier 时只看自身 bundle、不回落到 importer 的 `node_modules` → 即使磁盘上有 `partial-json` 也报找不到。

**三条前提实测全部不成立**：

| 诊断前提 | 实测 |
|---|---|
| exe 动态加载 `~/.pi/agent/node_modules` 的 0.87.1 | ❌ `pi.exe --version` = **1.1.0**，而 `~/.pi/agent/node_modules` 里是 0.87.1；且 `D:\Agent\pi\dist\` **不存在** → exe 是自包含 bundle，根本不读磁盘那份 |
| `json-parse.js` 首行是 bare specifier | ❌ 磁盘 0.87.1 那份首行是**相对路径** `"../../../../partial-json/dist/index.js"`；且 `fd -t f json-parse D:\Agent\pi` **零结果**——该文件不在 1.1.0 里 |
| Bun 不回落 `node_modules` 所以报找不到 | ❌ 实测在 `pi.exe` 下跑 subagent **1/1 succeeded**，无任何 `partial-json` 报错 |

**教训**：诊断里出现具体版本号与文件路径时，先跑 `pi.exe --version` 和 `fd` 确认它们对当前 exe 成立，再动手改代码。跨版本的旧结论会被当成现状（那个 `json-parse.js` 是 0.87.1 的，exe 早已是 1.1.0）。

### 7.17 `@xynogen/pix-optimizer`：唯一会**改写 system 前缀文本**的扩展（2026-10-10 首记，2026-10-12 换包）

与本清单里其它 17 个扩展不同

| 关注点 | 结论 |
|---|---|
| 对 wire 工具集 | **零影响**。它不注册任何工具，`tools` 部分字节数与装之前完全一致 |
| 对 skill 常驻注入 | **不适用**：新包**不带 skill**，规则本身就是 system prompt 片段（§3.15）。与本机「skill 不常驻注入 system」（§6.2，`pi-lean-sections.ts` 压 `<skills>` 块）没有交集 |
| 对前缀缓存 | **切档必然让下一轮 `cacheRead: 0`**（system 文本变了）；同档位内连续对话不影响。**档位定下来就别反复切**，切多了等于反复自毁缓存 |
| 与 `pi-prefix-stabilizer` | 不抢钩子（它只 hook `session_start`/`before_agent_start`/`input`/`turn_end`，压缩侧那个钩子是 `session_before_compact`），**不构成新的硬顺序约束**（§2.2 无需改） |
| 与 `pi-cache-compact` | 同上，两者互不干扰 |
| RTK 那层 | 只改写 **bash 命令前缀**，不碰 system 文本，故**与前缀缓存无关**；代价是首次加载可能下 `rtk` 二进制（§3.15） |

**使用纪律**（与本手册「少切、少动」倾向一致）：

1. 档位**只切一次**，切完长期驻留；要查当前值就 `/optimizer` 开面板（**没有 `status` 文本命令**）。
2. 觉得输出变得难读、影响定位问题时，先确认是不是它干的（面板里调档或关掉），而不是怀疑别的扩展。
3. **省 token 的数字全是上游口径，本机未复测**；输出侧压缩不影响缓存命中与输入侧成本。

---

### 7.18 配置源外迁 `config/`：`.pi/` 回到「纯运行时目录」（2026-10-10）


**起因**：`~/.pi/agent/settings.json` 在 2026-10-10 20:38 被写回旧快照——`packages` 退回 10-08 之前的 30 条（多出 `pi-compaction-cache`/`pi-warm-cache`/`pi-budget-guard`/`pi-zvec`/`pi-cwd-guard`，少了 `pi-cache-compact`/`@tian.zuo/pi-find`/`@narumitw/pi-lsp`），§3.11 的 13 个非默认键整段消失。机器侧按 readme 校正后（卸 5 装 3 + 补键），顺手把**配置与仓库的关系**改成不会丢的形态。

**问题**：pi 的项目级配置只认 `<cwd>/.pi/settings.json`（`docs/configuration.md`，目录名写死 `dist/config.js:403`），而 `.pi/` 是运行时目录（索引/阶段数据会 churn），在仓库里被整体 `.gitignore` → 配置无处可存，只能靠「单独放行一个文件」这种脆做法。

**改法**：配置的 canonical 源放仓库 `config/`（不被忽略、可 review、可 diff），由 `node install-project-config.mjs`（幂等 + `--check`）拷进 pi 实际读取的位置。

| 层 | canonical 源（入库） | 落到哪 | 怎么装 |
|---|---|---|---|
| 项目级 | `config/pi-project/settings.json` | `<仓库>/.pi/settings.json` | `node install-project-config.mjs` |
| 项目级留档 | `config/pi-project/zvec.json` | 不落（`pi-zvec` 已卸，§7.11） | 手动（重装 zvec 时） |
| 用户级规则 | `config/agent/AGENTS.md` | `~/.pi/agent/AGENTS.md`（**两边都是 0B**，2026-11-04 定案不发规则，§5） | 同上 |

| 用户级快照 | `config/agent/settings.snapshot-2025-09-15.json` | 不落（脚本对 `settings.snapshot-*` 一律跳过） | — |

- **恢复来源**：`.pi/settings.json`、`.pi/zvec.json` 取自 git 历史（`15c714b` 删除前）；~~`bash-prelude.sh` 取自 §3.9 全文~~（2026-11-04 起不再恢复，§3.9 已作废）；用户级快照取自 `.backup-20250915/settings.json`（`51e457d` 删除前，含 §3.11 多个键的取值）。
- `.pi/` 重新**整体忽略**（不再放行 `settings.json`）：配置是生成物，clone 后跑一次同步脚本即可；索引/churn 照样不入仓。
- **根目录放 `settings.json` 无效**（pi 不读它）→ 是「源放 `config/` + 脚本拷进 `.pi/`」，不是「把文件挪到仓库根」。
- 机器侧同时补回：`~/.pi/agent/settings.json` 的 §3.11 十三键（备份留 `settings.json.bak.2026-10-10-pre-config-restore`）、`bash-prelude.sh`（2026-11-04 起不再补，§3.9）、`~/.pi/agents/default.md`（§7.16）与 proper-lockfile 补丁 ×2（§7.14）。两个 fix 脚本 `--check` 全绿。
- 顺手修的两处 readme 失真：§5 与 §8 表引用的 `.sc-test/probe-bash-guard.mjs`（从未入库、现不存在）。

### 7.19 `pi-secret-guard` 卸载 + 压缩层补齐（2026-10-12）

> **压缩部分已于当晚作废**：本节装的 `@izhimu/pi-caveman`（10-10）/ `pi-ponytail` / `pi-rtk` 三包当天换成单个 `@xynogen/pix-optimizer`，见 §7.20 / §3.15。下面除 secret-guard 外的一切命令与配置点**仅作当日记录，勿照抄**。`pi-secret-guard` 那一半仍然有效。

一轮做完（顺序：`pi remove` → `pi install` → 写两个 config → 同步 → `/reload`）：

```bash
pi remove npm:pi-secret-guard        # 凭据拦截钩子，本机不再需要
pi install npm:pi-ponytail           # 做法层压缩（YAGNI），默认 ultra
pi install npm:pi-rtk                # 输入层 token 削减
# 默认模式两个 config（均非 settings.json）：
mkdir -p ~/.config/ponytail && echo '{ "defaultMode": "ultra" }' > ~/.config/ponytail/config.json
printf '%s\n' "$APPDATA/caveman/config.json"   # 已存在，defaultMode=ultracave，不用动
node install-project-config.mjs      # config/agent/rtk-config.json → ~/.pi/agent/
```

结果：29 → **30 个扩展**（28 npm + 2 git；当晚即改成 28，见 §7.20）。§1.1 / §1.3 / §2.1 / §3.13 / §3.14 / §4 / §9 同步。

**卸载代价（明说）**：提交 API key / 凭据到 git 的拦截**没了**，且 `pi-cwd-guard` 早已卸（§7.10），所以 `.env` 写保护与提交侧**都没有闸**了。规矩回落到纪律层：`.env` / 密钥文件不手改、不 `git add`，提交前自己看 `git diff --cached`。再想装回来：`pi install npm:pi-secret-guard`。

**新装两个的坑**（**三条都已随卸载消失，仅作历史记录**）：

- `pi-ponytail` 与 `pi-caveman` **都改写 system 前缀**（`before_agent_start` 注入，§7.17 同类风险）：两者都只追加、不改前段结构，实测共存无冲突；但**任一换模式 = 换一次前缀文本**，切完第一次 `cacheRead` 归 0。日常别来回切。
- `pi-rtk` 会**滤掉源码里的注释与空白**，导致 `edit` 报 old text 不匹配。扩展自带应急提示 + `rtk_configure` 工具：关 `sourceCodeFiltering` → 重读 → 改 → 开回来。真要常用编辑就别开 `sourceCodeFiltering`，改用 `/rtk-toggle-truncation` 之外的其余技术（§3.14）。
- `pi-rtk` 的 `tool_result` 过滤与 `pi-mono-context-guard` 的 `tool_call` 注入是**两层叠加不是冲突**（§3.14 已对账）；若怀疑多砍了什么，`/rtk-what` 看开关、`/rtk-off` 一键关。（rtk 与 guard 都已卸，此条仅留档，guard 见 §7.28）

### 7.20 压缩层三合一：`@izhimu/pi-caveman` + `pi-ponytail` + `pi-rtk` → `@xynogen/pix-optimizer`（2026-10-12）

上游把三个包的功能合成一个扩展，装它等于同时装了那三个（README 自述是 rewrite 而非 copy，全 MIT）。故当天先装后卸，3 → 1：

```bash
pi install "npm:@xynogen/pix-optimizer"
pi remove npm:@izhimu/pi-caveman
pi remove npm:pi-ponytail
pi remove npm:pi-rtk
# 死配置清理（§2.4 纪律）
rm -rf "$APPDATA/caveman" ~/.config/ponytail
rm -f  ~/.pi/agent/rtk-config.json
git rm config/agent/rtk-config.json     # 不删的话 install-project-config.mjs 每次同步又拷回去
# 档位写 pix.json（本机三档全 ultra，§3.15）
```

结果：30 → **28 个扩展**（26 npm + 2 git）。§1.1 / §1.3 / §2.1 / §3.12–3.15 / §4 / §5 / §8 / §9 同步。

**为什么是「换实现」而不是「装重了」**：三处机制都变了，**旧结论一律作废**。

| 层 | 旧实现（已卸） | 新实现（`pix-optimizer`） |
|---|---|---|
档位 `lite`/`full`/`ultra`/`micro`，单一 `pix.json` |
| RTK | 纯 JS 拦 `tool_result` 过滤内容，**不依赖二进制** | prompt 注入 + **改写 bash 命令加 `rtk` 前缀** + 官方 Rust `rtk` 二进制 |
| ponytail | 自带 5 个 skill，逐档过滤后注入 | 无 skill，整份规则是 system prompt 片段 |

- **新代价**：RTK 开着时 pi 首次加载会**联网下 `rtk` 二进制**到 `~/.pi/agent/bin`（有 `checksums.txt` 校验，不阻塞启动）；设 `PI_OFFLINE` 则跳过下载且命令改写不生效（§3.15）。
- **顺手消掉的老坑**：`rtk_configure` + `sourceCodeFiltering` 那套「`edit` 报 old text 不匹配 → 关过滤 → 重读 → 改 → 开回来」的应急流程整条作废；`/rtk-what`、`/rtk-stats` 等记忆型统计命令不再有。
- **入口变了**：三个命令家族收成**一个 `/optimizer` 交互面板**，且**没有文本参数形**（§3.15）——写自动化脚本时要注意这条。

### 7.21 `@narumitw/pi-plan-mode` 卸载（2026-10-13）

`/plan` 只读规划模式在本机用不了，连带收拾掉它的补锅件。

```bash
# 1) settings.json 的 packages 去掉 "npm:@narumitw/pi-plan-mode"
# 2) npm 树里清掉（在 ~/.pi/agent/npm/；裸 npm uninstall 报 ERESOLVE，见 §7.11）
npm uninstall @narumitw/pi-plan-mode --legacy-peer-deps
# 3) 本地补锅扩展：仓库与用户目录两份都删，再 /reload
rm extensions/pi-plan-tools.ts ~/.pi/agent/extensions/pi-plan-tools.ts
```

**为什么连带删 `pi-plan-tools.ts`**：那个本地扩展的**全部**作用就是 `session_start` 里把 lazy-tools 剥掉的 `plan_mode_question` / `plan_mode_complete` 捞回 active 集——包没了，`pi.getAllTools()` 里根本没有这两个工具，扩展变成空转（只会刷一行无意义的 notify）。

**代价（明说）**：没有只读规划模式了。想装回来：`pi install npm:@narumitw/pi-plan-mode` + 把 `extensions/pi-plan-tools.ts` 加回本仓库（git 历史里有，§7.21 前一版）。规划纪律交给模型自己（`AGENTS.md` 2026-11-04 起已清空为 0B，那条 Think 段落的提示词不再存在，§5），不靠工具。

### 7.22 浅色终端里 footer 的文件夹名发白：`cwd` 是唯一用裸 ANSI 色的字段（2026-10-13）

**现象**：浅色终端（浅背景）里 footer 的**文件夹名**发白 / 颜色不对，token、耗时、git 分支等其它段都正常。切 `light` / `cc-light` / `system` 都一样。

**根因**（`pi-one-ui@0.9.1`，footer 与 minimalist-editor 共用同一条路）：

```ts
// extensions/shared/style.ts:439
renderSourceColor(theme, spec, themeToken, themeDefault, text)
// 1) 配置了 colors.cwd        → 按配置走
// 2) 主题定义了 colors.cwd     → theme.fg("cwd")
// 3) 都没有                    → renderThemeStyle(theme, themeDefault)
// extensions/layouts/footer/footer.ts:326
renderSourceColor(theme, config.colors.cwd, "cwd", "bold cyan", formattedCwd)
```

第 3 步的 `"bold cyan"` 是**裸 ANSI 色**：`renderThemeStyle` 见到终端色名就不查主题，直接吐 `\x1b[1;36m`。而 `cwd` 是**全包唯一**默认落到裸 ANSI 色的字段——其余同类字段的默认都是主题 token（`editorModel` → `syntaxKeyword`，`editorBorder` → `borderMuted`），所以只有文件夹名会翻车。SGR 36 取的是**终端调色板的 cyan 槽**，浅色背景下那个槽往往是很浅的青，叠上 `bold` 就是一片惨白。

**排除过的猜测**（都错，别再走一遍）：

- ❌ “pi-one-ui 写死了白色”：全包唯一的 `#fff` 在 `themes/cc-light.json` 的 `panel` **背景**变量里，footer 文本路径无白色字面量。
- ❌ “主题 token 查不到就退回终端默认 fg（于是白字）”：退回的是 `bold cyan`，不是终端默认色；真正的终端默认 fg 回退只发生在 `safeThemeFg` 抛异常时。

**修法**（一行配置，2026-10-13 已写入 `~/.pi/agent/pi-one-ui.json`）：

```json
{ "colors": { "cwd": "accent" } }
```

然后 `/reload`。`accent` 是 theme schema 的 46 个 `required` 色之一，`light`/`dark`/`cc-light`/`cc-dark` 全都定义，所以这一行**跟着主题自动切换**。

**为什么升级不会被覆盖 / 为什么别走别的路**：

- 配置文件在 agent 目录（不在 `node_modules` 里），pi 升级不动它；pi-one-ui 自己的 `ConfigStore` 只写它自己管的字段（`components` / `renderer`），`colors` 保留，官方也明说“不重写文件”。
- pi 自带的 `light`/`dark` 跟着 pi 本体整目录替换（同目录有 `pi.exe.old` 为证），值会变但名字不变；`settings.json` 里存的是名字，所以 `"theme": "light"` 一直有效。
- ❌ **别把 footer 配色钉成字面 hex**（本节踩过）：那会绕过主题，`light/dark` 自动切换直接死掉，而且对浅色终端**一点用没有**——那些字段本来就没坏。
- 想让 `cwd` 颜色也由主题控制（而非配置），以前是「在 `~/.pi/agent/themes/` 放一份自己的主题并加 `colors.cwd`」——**这条在 pi ≥1.0 已作废**：用户主题走同一条严格校验，`colors` 里加自造键会把整份自定义主题打死（§7.26）。要调 pi-one-ui 专属色就只写它的配置 `colors`（配置优先级最高）；本机继续用 `{"colors":{"cwd":"accent"}}`。

### 7.23 ~~`pi-smart-reader`~~（2026-10-14 已卸载；以下为卸载前的实测记录，留档）

装上、钉版（§3.16）、parser 正常加载之后，唯一真能用的是 `smart_read` 工具。另外三个卖点全部落空：

**1）自动优化大文件（passive mode）：永远不触发。** 它挂 `tool_result` 后连过三道闸就`return`，而这三道闸按 pi 1.1.0 的真实事件形状全不过：

```ts
// pi-smart-reader/extensions/index.ts（原文）
const toolName = event?.toolName || event?.name;          // ✅ 这条对
const content  = event?.content || event?.result;
if (!content || typeof content !== "string") return;      // ❌ content 是 block 数组
const filePath = event?.path || event?.args?.path;        // ❌ 字段叫 event.input.path
```

对照本机 `pi-mono-context-guard`（同一个钩子、实际能用；2026-11-04 已卸，§7.28，留档时看源码即可）的写法就一目了然

> 实测：headless 读一个 367 行的 `pi-fd.ts`，输出里没有它本该打的 `Large file optimized: ... (367 → N lines, R% reduction)`。所以**别指望它自动省 token**，它既不改 `read` 的返回，也不碰 `pi-mono-context-guard` 的截断职责（无冲突，但也没协同）。

**2）`ctx.setContext(...)` / `impact_detected` / 上下文 70% 自动优化**：前者不是 pi 的公开 API（被 `if (ctx.setContext)` 护着，无报错、无效果）；`impact_detected` 需要另装 `pi-impact-analyzer` 扩展才有人发（本机没装）；`context` 钩子里的 `findLargeFilesInContext()` **直接 `return []`**（源码注释写着 "This is a heuristic - in practice, we'd need to check Pi's actual context"）。三条全空转。

**3）多语言支持：只有 TS/JS。** `wasm/` 目录里**只有** `tree-sitter-typescript.wasm` 一个语法，README 宣传的 Python / Rust / Go / Java 没有对应 wasm（`parser.ts` 里也只 load 这一个）。非 TS 文件要么解析报错被 catch 吞掉，要么得到无意义的树。

**能用的部分**：`smart_read` 两个模式实测正常（`skeleton` 保留签名、隐函数体；`symbol` 抽指定符号），wasm 与 `web-tree-sitter@0.24.7` 兼容（§3.16）。

**`/smart-reader` 命令**：只有 `on|off|status|threshold <n>|clear` 五个子命令，且全部改**内存里的 `config` 常量**、**不落盘** —— `/smart-reader threshold 500` 重启即丢。想关掉 passive mode 只能重启前设，说白了它反正也不触发。

**（2026-10-14 更新：因只覆盖 TS/JS、passive mode 又是死代码，已整体卸载，见 §3.16。）**

### 7.24 每条 bash 命令都带 `[rtk] /!\ No hook installed` 噪音（2026-10-14 已修）

**症状**：`bash` 工具每次执行，`ls` / `rg` / `git` 等命令的输出**前面**都缀一行

```
[rtk] /!\ No hook installed — run `rtk init -g` for automatic token savings
```

不是报错，是 rtk 0.51.0 自己往 **stderr** 打的提醒，混进工具输出被当回显读进来。

**根因**：`pix-optimizer` 的 RTK 档开着（§3.15 `pix.json` 的 `optimizer.rtk: "on"`），它在 `tool_call` 里给已知首词加 `rtk` 前缀；而 rtk 检查的「hook 装没装」指的是 **Claude Code 风格的 `PreToolUse` hook**（`~/.claude/settings.json` + `hooks/rtk-rewrite.sh`，另有 cursor/codex/gemini 各一份）。**pi 不走那条链路**，pix 的改写发生在工具调用之前，rtk 看不见 → 每次都判定「没装 hook」。所以照它提示跑 `rtk init -g` 只会给 pi 多装一份重复改写器。

**处置**（rtk 自己的开关，二进制里只有这个）：

```toml
# %APPDATA%\rtk\config.toml
[hooks]
suppress_hook_warning = true
```

等价的环境变量是 `RTK_SUPPRESS_HOOK_WARNING=1`（值不是 `off` 就算开），**但别用**——pi 的 Bash 工具走 `bash -c`、不读 `~/.bashrc`（§3.9），环境变量挂不上；配置项是唯一能跟着进程走的旋钮。

**配这个文件的坑**：

- 文件**默认不存在**（`rtk config` 显示 `(default config, file not created)`）。手写一个 `[display]` 小节会报 `rtk: missing field 'colors'`——rtk 的反序列化**没有默认值兜底，缺字段即失败**。要手改先 `rtk config --create` 生成全量，再改那一行。
- 小节名是 **`[hooks]`**，不是 `[display]`/`[filters]`。从二进制字符串表里能看出 `suppress_hook_warning` 与 `exclude_commands`、`transparent_prefixes` 同属 hooks 段；`[display]` 只有 `colors`/`emoji`/`max_width`。
- 顺带确认：`rtk init -g --agent pi` 装的是 `~/.pi/agent/extensions/rtk.ts`（**每次 bash 调用多 fork 一个 `rtk rewrite` 子进程**），与 pix 的正则改写重复，**本机已删**。真要留就别让 pix 再改写一遍。

**没做的**：没去装真正的 Claude hook（pi 用不上那条链路）；没关 RTK 档（省 token 的部分照常生效，关掉反而亏）。

---

### 7.25 桌面宠物僵窗：上游 `needsRelaunch()` 只认「pid 死了」，僵窗没人管（2026-10-16 已修，上游 `b4b779a` 已 push）

**现场**：pi 开着、`log.txt` 还在刷状态，屏幕上却没宠物。查下来宿主（`node bin/pi-pet.cjs start`）在跑、窗进程（`electron.exe … pet-electron.cjs 47653 --pi-pet-window`）也活着，但 `log.txt` 连续 13 分钟每行都是 `窗客户端 0`，`state.json` 里 `windowState` 永远是 `starting`。手动 `POST /control {"action":"restart-window"}` 后 0.7s 就 `窗接上了` —— 窗进程还在，只是渲染进程崩了（`tasklist` 里同一时刻只有 main + gpu-process + utility，**没有 `--type=renderer`**）。

**根因**（上游 `app/window.cjs`）：文件头写着「窗在不在以有没有 WS 客户端为准，不是 pid」，代码却是

```js
const childGone = !child || child.exitCode !== null || !pidAlive(pid);
return childGone && pastGrace && pastLost && …;
```

`pidAlive` 这道闸把「pid 活着但渲染进程崩了」的僵窗整个排除了 ⇒ 宿主 tick 每 2s 判一次「不用重拉」，一直判到天荒地老。**修**：判据抽成纯函数 `windowDecision()`，只看客户端（连上过又丢了按 `lostMs`、从没连上过按 grace 的 `graceMs` 判，`gapMs` 节流仍在）—— 真连不上时每 max(grace, gap) 换一扇，不是拉起洪水。

**配套**（`app/host.cjs`）：重拉路径 `win.launch()` → `win.restart()`。僵窗的 pid 还活着，直接再拉一只就是**新旧两只抢同一个 electron profile**（新的那扇连页面都加载不出来 = 现场那个「窗客户端一直 0」），必须先 `taskkill` 掉旧的。回归：`test/fused.mjs` +7 条断言，含「判据里不许再出现 `pidAlive`」；`npm test` 400 + 27 + 8 + 9 全过。

**客户端也兜了一层**（本仓库 `extensions/pi-pet-autostart.ts`，见 §3.6 那条）：宿主被硬杀 / 跑了旧版 exe / 上游哪天又改回去，`/health` 的 `clients` 还是 0，客户端 60s 后就自己叫它换窗。

**顺带发现（未改）**：`npm run sync` 的「把宿主那份检出收干净」那步其实收不干净 —— 同步写完文件后 `git merge --ff-only` 会以「有本地改动」拒绝（现场：`origin/main` 已快进到远端，那份检出的 HEAD 还停在旧提交）。要收干净得手动 `git checkout -- <被同步的文件>` 再 `merge --ff-only`（内容已在远端时这俩合起来等价，且不丢东西）。

### 7.26 `[Theme conflicts] Invalid theme cc-dark.json`：pi 收紧主题 schema，把 pi-one-ui 内置主题整体打死（2026-10-18 已修，`fix-pi-one-ui-theme.mjs`；2026-10-27 上游源码层已修）

**现象**：开机 / `/reload` 在已加载资源区弹两段（标题就是 `[Theme conflicts]`，`interactive-mode.js` 拿主题 diagnostics 渲的）：

```
Invalid theme "…\\npm\\node_modules\\pi-one-ui\\themes\\cc-dark.json":
Other errors:
  - /colors/cwd: schema is false
  - /colors/editorModel: schema is false
  - /colors/editorBorder: schema is false
  - /colors: must not have additional properties
```

`cc-light.json` 紧跟一份一模一样的。**代价不是「少三个颜色」**：整份主题被判非法 → 不注册（`theme.js`：「Invalid themes are ignored here; the resource loader reports them」），`/theme` 列表里 cc-dark / cc-light 直接消失。本机 `settings.json` 是 `light/dark`，平时看不出来，但 `/theme` 一开就露。


[Showing lines 1-512 of 1329 (50.0KB limit). Use offset=513 to continue.]