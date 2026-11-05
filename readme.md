# Pi 扩展安装配置清单

本手册是一份**可直接照做的安装 + 配置清单**：装哪些、按什么顺序装、每个必做配置写什么、以及每条结论的实测依据。
扩展统一装在 `~/.pi/agent`（Windows：`%USERPROFILE%\.pi\agent`），下文路径均以此计。

**本机基线（所有实测都在这上面做的）**：Pi **1.3.0**（装在 `D:\Agent\pi`）、node **24.16.0**、npm 12、模型走本地代理 `http://localhost:20128/v1`（`openai-completions`，模型 id `1`，窗口 **128K** —— `models.json` 里 `contextWindow: 128000`）。
> **升级沿革**：0.87.1 →（2026-10-02）**1.0.0** 宿主自带 `buildSessionProjection()` →（2026-10-09）**1.1.0**，安装目录从 `D:\agent\pi-windows-x64` 换成 `D:\Agent\pi`（`where pi.exe`）→（2026-10-16）**1.3.0**（`pi.exe` mtime 为证，上一版留 `pi.exe.old`；§7.22 说的「pi 本体整目录替换」就是这种动法）。§6 的字节数、§7 的旧版本结论都是 0.87.1 快照，未复测；§8 排障表与 §1 清单按 1.3.0 对齐（2026-10-18 复验：全扩展加载 `extension_error` 0，proper-lockfile 与 DOCS_NOTE 补丁都没被升掉）。
> ⚠️ node 仍是 **24.16.0**，低于 `pi-agent-browser-native@0.9.3` 声明的 `>=24.21.0`。npm 每次装/卸都会打 `EBADENGINE Unsupported engine`，**只是警告**，8 个 `agent_browser*` 工具实测正常，不必为它升 node。
> **2026-10-09 体检改动**（根因与验证见 §7.15）：① 上游 `pi-dsh-pet` 扩展改用 `packages` 的 **object form** 屏蔽（此前是纯字符串，上游扩展一直在加载，与本地薄客户端**重复注册 `/pet` `/pet-stop` `/pet-say` `/pet-status`**，还多一条 `session_start` 拉宿主的路）；② `cache-compact.json` 转生产配置（`debug` 关，1.1MB 调试落盘已删）；③ 补记 `bash-prelude.sh`（`shellCommandPrefix`，原文档漏记，照 readme 重建必丢）；④ `allowScripts` 里 better-sqlite3 的版本纠正为树内实际版本（§3.1）。
换版本 / 换 provider 后，下面的数字要重新对账（§6 是 0.87.1 时期的 wire 实测，pi 1.1.0 / 1.3.0 下均未复测，本机也不再复测——按结论用，别按字节抠）。

---

## 1. 清单（在用 9 个扩展 = 6 npm + 3 git）

**实际在用 9 个**（2026-11-05：卸 `@bacnh85/pi-checkpoint` / `pi-meter` / `pi-notify`，见 CHANGELOG）。同日先核 26 条、再 9 连卸（§7.29）、再 6 连卸（§7.32），见下方 changelog）。
> 2026-10-06 增补 3 个：联网（`pi-web-access`）、会话级撤销（`@bacnh85/pi-checkpoint`）、完成通知（`pi-notify`）。PR 插件（`@henryqw/pi-pr`）装后即卸，见 §7.7。
> 2026-10-08 精简：卸 `pi-budget-guard`（与 `pi-meter` 功能三层全重叠，见 §7.12）与 `pi-warm-cache`（本机不生效的死安装，见 §7.12）；补装 `@arhen/pi-core-subagent`、`pi-ocr`（此前清单漂移：列了但实际未装）；新增 `pi-deepseek-cache`（DeepSeek 后端专用，与 §5.5 原判相悳 —— **2026-10-09 已验实并卸载，见 §7.13**）。
> 2026-10-09 压缩侧换血（见 §7.13）：装 `pi-cache-compact`（provider 无关的压缩调用缓存，本机实测命中 68.6%）；卸 `pi-deepseek-cache`（绑定 DeepSeek）与 `pi-compaction-cache`（被 cache-compact 取代，且同抢 `session_before_compact`）。29 → 28。
> 2026-10-10 增补 `@izhimu/pi-caveman`（caveman 输出压缩层，默认 `ultracave`，见 §3.12）：28 → 29。
> 2026-10-12 三层压缩补齐（29 → 30）：装 `pi-ponytail`（懒扩展打法层，默认 `ultra`，见 §3.13）与 `pi-rtk`（输入侧 token 削减，见 §3.14）；卸 `pi-secret-guard`（凭据拦截，已无提交侧闸，见 §7.19）。
> 2026-10-12 压缩层三合一（30 → **28**）：装 `npm:@xynogen/pix-optimizer`（caveman + rtk + ponytail 合成一个扩展，一个 `/optimizer` 面板，见 §3.15），卸当天刚装的 `@izhimu/pi-caveman` / `pi-ponytail` / `pi-rtk`（3 → 1，26 npm + 2 git）。同日新增全局规则文件 `~/.pi/agent/AGENTS.md`（见 §5「全局规则」）—— **该文件 2026-11-04 已清空为 0B 并定案不恢复**。
> 2026-10-12 rtk 二进制修复：`winget install rtk-ai.rtk` 报 `unable to verify the first certificate`（本机 TLS 链被自定义根 CA/代理劫持，winget 的 schannel 不信）。**绕开 winget**，直接 curl release zip 装到查找路径 `~/.pi/agent/bin/rtk.exe`（`--ssl-no-revoke` 破证书问题），checksum 与 release 的 `checksums.txt` 逐位对上，`rtk --version` → 0.51.0 可跑。命令见 §3.15「二进制手动兜底」，排障见 §8。
完整卸装理由与原始记录仍在对应 §3 / §7 小节。
> 2026-10-13 装 `pi-smart-reader`（AST 骨架/符号抽取，27 → **28**：26 npm + 2 git）：**上游「零配置自动优化」是死的**，实测只有 `smart_read` 工具真能用，且 `web-tree-sitter` 必须钉死 0.24.7 才不半残。见 §3.16（必做配置）与 §7.23。
> 2026-10-13 卸 `@narumitw/pi-plan-mode`（28 → **27**：25 npm + 2 git）
原始记录留在 §3.16 / §7.23。⚠ **该卸载只发生在远端 clone，本机当时未执行**：10-18 上午复验 npm 26 仍含 `pi-smart-reader`、`overrides` 钉版在盘、`smart_read` 工具正常加载；本机 10-18 下午已按远端基准补卸（见文末对齐条）。
> 2026-10-14 全局规则 `~/.pi/agent/AGENTS.md` **改中文 + 精简**，并加「读文件」块
> 2026-10-15 例行 `pi update --extensions`（版本仍不锁）：24 npm 里只动了两条 —— `@ssk_dev/rpiv-todo-lean` 2.12.1 → **2.13.9**、`@xynogen/pix-optimizer` 1.3.2 → **1.3.3**（工具归属未变：前者仍只注册 `todo`，后者仍零工具 + `/optimizer` 面板，`pix.json` 三档 ultra 保留）。两个 git 源 `git fetch` 只多了 tag、无新 commit。§8 体检全绿；`fix-browser-native-compat.mjs` 改判缺失的 `lib/tool-surface.js` 为 `[**2026-10-29 上游吸收 v0.9.2**（`dafe80e` → `91fddb2`，16 commits / 83 files）：上游把八个旧 JSON 检查器移进 `tests/legacy/` 并删掉 assets / image-prompts / review 三个技能的整个 `scripts/`——本仓库**不跟这个删除**，因为这些检查器是 pro 三阶段检查器的活跃依赖、且含自加的 SHT-31 上限，跟着删会让检查能力塌掉；三个技能的 `scripts/` 与 `selftest.py` 全部保留。同期收进 `--partial` 局部核对、`profile_notes` 算术冲突提示、`format.episode_count` 与 `multi_shot_containers` 决策写入。吸收明细见 `skills/UPSTREAM.md`。

**2026-11-02 分镜镜长改 4 秒硬顶 + 秒数必须算出来**（本机实测：镜长填了数字但台词装不下，生成出来还是太快）：`short-drama-pro` 的分镜镜长改成「动作 + 对话算出来的秒数」——可发声字 ÷ 该句档位 + 停顿 + 动作拍 × 1 秒。`pro_check.py` 分镜模式不再只读 `时长：N 秒`：按算出来的量判上限（`SHT31_SHOT_EXCEEDS_CAP`）、点名声明装不下的镜（`SHT31_SHOT_TIME_UNDERESTIMATED`）与短于默认 4 秒的声明（`SHT31_SHOT_BELOW_DEFAULT_SECONDS`），没写 `时长` 按 4 秒计（以前静默跳过）。硬顶从 12 秒收到 **4 秒**（`pro_check.SHOT_CAP_SECONDS` 与 `storyboard_check.SHOT_DURATION_CAP_SECONDS` 同步，`--shot-cap` 只能更紧）；单镜容量因此约 5–6 个可发声字（沉缓档 4 个左右），长句一律按语义拆镜、语速不变。落点：pro 的 SKILL 补丁表与工作流 + `references/` 下 `stage-storyboard.md` / `pacing.md` / `delivery-spec.md` / `handoff.md` / `stage-script.md` / `stage-video-prompts.md` / `storyboard/{shot-craft,action-physics,stage-contract}.md` / `video/performance-action-timing.md` / `script/action-physics-screenplay.md`；`pro_check --selftest` 加三例（台词超时、没写时长、短于 4 秒），`selftest_storyboard` 夹具改按 4 秒。

**2026-10-30 加语速规则 PAC-01 / PAC-02**

**2026-10-30 加台词交付规格 PAC-03 / PAC-04 / PAC-05 与人物一致规则 CON-08**（用户要求：语速、停顿、语气、情绪要按剧情逐句设置并被视频模型正确理解；人物站位朝向、衣着跨镜一致）。PAC-01/PAC-02 定了「一句话占多少秒」，本轮管**每句该怎么说**与**人不能漂**：

- 新增 [references/delivery-spec.md](skills/short-drama-pro/references/delivery-spec.md)：**PAC-03** 逐句定语速档（沉缓 1.2–1.5 / 常速 2.0 / 急切 2.5–3.2 / 崩溃 3.2–4.0 可发声字/秒）——2.0 是常速预算值、不是全片统一速率，**改档就按该档重算秒数与镜长**，任何档位都不得落进赶词风险线（H3 ≈4.1 / Wan ≈4.6）以内；**PAC-04** 三根发声杠杆（速度档 / 停顿位 / 音色语气）+ 每句交付四件（谁在说 · 怎么说 · 说什么 · 什么时候说），核心认知是**情绪词不是杠杆，而是三根杠杆的组合结果**：只写「她愤怒地说」，模型自选一种愤怒，通常就是吼出来，而这场戏要的是压着的怒；**PAC-05** 删掉杠杆词后句子里还应剩一个秒数或位置，只剩「自然语速」就是未交付。附 10 种常见剧情状态的情绪→杠杆换算表（含可直接抄进正文的句式）与四方言落点表：杠杆写在逐字围栏**旁边**（前置为默认，后置同句也可），H3 在 `<d>` 外、Seedance 在花括号前那句、Wan 在「说道」前那句；`参考音频` / `音频N` 只锁音色，不携带表演。
- 新增 [references/identity-continuity.md](skills/short-drama-pro/references/identity-continuity.md)：**CON-08** 的根因与模型的行为一致——它不看上一镜、也不读《视觉设定.md》，只看本条正文。四类会漂事实（站位相对锚点 / 胸背朝向 / 衣着主色与形制 / 两手与物件）**逐镜重述**：未变写一句「仍」（「藏青外套仍扣到顶上」），变了写变化 + 落点；按景别筛（手部特写不写全身衣物，`SHT-24` 口径）；图生不重复起始帧已携带的外观，但**只挂 `用途：地理` 时人物外观无人归属，衣着仍得写进正文**；换装/伤情要有可见原因、脱下衣物去哪、`[连续性]` 登记才算批准；多人镜每人一句独立描述，不用「两人」起句，裸写左/右一律指画面左右。与上游 CON-07（逐字锁面）分工明确：锁只盖跨集不变那几件，其余靠逐镜重述，锁面逐字义务高于重述的简洁。
- 机械检查 `pro_check.py` 新增 7 个 warning 码（不新增 error，退出码不变）：`PAC04_DELIVERY_LEVERS_MISSING`（围栏两侧同一句内不足两根杠杆）、`PAC04_EMOTION_WORD_ONLY`、`PAC05_DELIVERY_NOT_CALIBRATED`（含「走。」这类短到不成逐字段的句子，需有说话动词；摄影机「平稳」不误触）、`CON08_LOOK_ANCHOR_MISSING` / `CON08_END_STANCE_MISSING` / `CON08_WARDROBE_LANDING_MISSING`（穿脱写在哪句、落点就得在那句）/ `CON08_LOOK_DRIFT`（同件衣物整档多色）。中英双语词表（H3 正文是英文），回看窗口 200 字。`--selftest` 3 组 → **4 组**：两条合格镜（中文 / H3 英文）、三条典型缺陷，另加两个反向断言（台词后置交付、无人说话镜）不得报错。
- 落点：pro 的 SKILL 补丁表 + 三个 `stage-*.md` + `pacing.md` + `storyboard/shot-craft.md` + `script/script-craft.md` §7.2 表演提示 + `video/{performance-action-timing,production-prompt-grammar,action-physics,minimax-h3,seedance-2.0,seedance-2.5,wan-3.0}` + 两份 `stage-contract.md`（CON-08 入表）+ 剧本模板注释 + `handoff.md` 补丁映射；`$short-drama`（router）说明声明值只是常速基线、逐句按档精算；`$short-drama-produce` 把逐句档位映射到 TTS 情绪/语速参数（同角色不同档不共用一个 `speed` 值）；`$short-drama-assets` 一致性锁文档补「锁之外的部分谁兼顾」；`$short-drama-review` 视觉 rubric 加两条（逐句杠杆、镜内外观重述）。
- 顺带修 5 处断链与一处越界路径：`references/stage-*.md` 把同目录的 `pacing.md` / `delivery-spec.md` / `identity-continuity.md` 写成 `../`，`stage-video-prompts.md` 的方言目录链接也多了一层——链接解析不到文件时模型就读不到该读的参考。
- **能力边界**（不吹）：同轨音画的语速与语气提示词是**生成指导，不是秒级执行保证**；H3 无 `speech_rate` 参数，档位只能靠自然语言靠近，急档仍可能被赶成含混。文本检查只证明「该写的写了」，不证明模型听了。验收在生成后四查：逐字是否完整、语速听着是不是常人说话、停顿在不在写的位置、衣服颜色与站位跟上一镜对不对得上——任一项靠猜就把缺陷回报到写它的那个阶段，不在下游静默修正（已写进 pro 的「完成」节与 rubric）。

**验证**：`node sync-drama-skills.mjs install` 后 `check` 无漂移；pro 四组 `4+17+17+10`、router 17、其余七件（9+5+10+5+8+8+1）全通过；样例剧本 `pro_check` 0 error / 0 warning；`readme.md` 表格列数校验通过。

重建的是中文版（见下两条）
**两处待对齐已按远端基准收口（见下一条）**。
> 2026-10-18 按远端基准对齐执行：① 卸 `pi-smart-reader`——远端 10-14 的动作今天才落本机，本机 **28 → 27（25 npm + 2 git）**；`overrides` 整块删（`web-tree-sitter@0.24.7` 钉版无对象，`pi-impact-analyzer` 条目同样无对象），lock、`pi list`、`node_modules` 零残留，`pi --no-session -p` 冒烟干净。远端当时那两行计数自相矛盾（卸前 26 npm，卸 1 应余 25，却写 24），本机以 `package.json` 实数为准。② `AGENTS.md` 恢复 10-16 **英文 canonical**（1263B，`config/agent/AGENTS.md` 入库 → `install-project-config.mjs` 拷盘），本机今早重建的 590B 中文版作废。

> 2026-10-18 晚 全局规则 `~/.pi/agent/AGENTS.md` **删「Download」块**（现三块：Think / Read files / Search，1263B → 991B）：镜像/证书那套规矩仍留在 §3.15 与 §8 排障表里，规则块不再重复一遍。
> 2026-10-18 晚（同机、清单计数不动）：开机 `[Theme conflicts]`

> 2026-11-02（**28 → 27**：卸 `D:\AI\pi-one-ui` 本地源码条目，改装 `git:github.com/BeYourDreams/pi-one-ui`；计数不变的那次拉齐在 11-01）：本仓 `master` 拉到 `f315550`（6 个 incoming，纯 fast-forward）；`pi-one-ui` / `pi-lazy-tools` / `pi-dsh-pet` 三个 git 源的 owner 从 `qq458249269` 统一成 `BeYourDreams`；`~/.gitconfig` 的全局 7890 代理删掉，git 改走 SSH（详 §7.26 同日两段）。

> 2026-11-04（**27 → 26**：卸 `npm:pi-mono-context-guard`，23 npm + 3 git）

> 2026-11-04 晚（**26 → 17**：9 连卸，14 npm + 3 git）一次清掉九个「自己会多发请求」的包：`@chendpoc/pi-memory` / `@agenticup/pi-loop` / `@arhen/pi-core-subagent` / `pi-cache-compact` / `pi-ocr` / `pi-web-access` / `pi-agent-browser-native` / `@injaneity/pi-computer-use` / `pi-test-runner`。判据、代价与残留清理见 §7.29。
> 2026-11-04 晚（**17 → 11**：6 连卸，8 npm + 3 git）用户要求的「工具卸载」：清掉 `@tian.zuo/pi-find`（`grep`/`find`）/ `@trycedar/pi-mdiff`（`md_inspect`/`md_diff`/`md_edit`）/ `pi-mcp-adapter`（`mcp`）/ `@henryqw/pi-ask-question`（`ask_question`）/ `@ssk_dev/rpiv-todo-lean`（`todo`）/ `@narumitw/pi-lsp`（`lsp_diagnostics`/`lsp_fix`）。`@aboutlo/pi-smart-edit` **保留**（它注册的是 `edit`，不在本次清单）。判据、代价与残留见 §7.32。


> 2026-11-01（清单计数不动）**规则 E 以新形态恢复**
> （只认每条流水线首段首词；管道消费位、`git grep`、`./find-helper.sh` 不拦），替代 2026-10-13 删掉的「按搜索根拦」。
> 同批：`skills/short-drama-edit` 的 `edit_tool.py` 新增 `音乐` 行（sidechain 自动让对白）、`声音：…（原声静音）`、
> 配音相邻句 0.4 秒下限、`字幕：带说话人`（两条渲染路线同步）；详见 §4.2/§5 与技能自身文档。回归：
> `.sc-test/probe-bash-guard.mjs`（重写，不入库）+ `short-drama-edit/scripts/selftest.py`。改完记得 `/reload`。

> 2026-11-03（清单计数不动）**取消拦截/全局指向 find/grep，仅提示词限制优先 fd/rg**：`pi-bash-guard` 移除规则 E；`bash-prelude.sh` 不再把 find/grep 指向 fd/rg；`AGENTS.md` 恢复 fd/rg 提示词限制。改完记得 `/reload`。
> 同日 `e9c4132` 把 `pi-fd` / `pi-bash-guard` / `bash-prelude.sh` 一起删了（2026-11-04 起确认不恢复，§3.9 作废）。

**不锁版本**：安装命令一律不带 `@版本号`（取 npm 最新），本清单不维护版本矩阵。要查本机实际装的版本：

```bash
node -e 'const{execSync}=require("child_process"),fs=require("fs");
execSync("pi list",{encoding:"utf8"}).split("\n").filter(l=>/^\s+(npm|git):/.test(l)).map(l=>l.trim())
 .forEach(s=>{const n=s.split(":").slice(1).join(":").replace(/@latest$/,"");
  try{console.log(n,"→",JSON.parse(fs.readFileSync(process.env.USERPROFILE+"/.pi/agent/npm/node_modules/"+n+"/package.json","utf8")).version)}catch{console.log(n,"→ (git)")}})'
```

### 1.1 核心层（先装，装完先跑一次冒烟）

| 包 | 作用 | 备注 |
|---|---|---|
| `npm:pi-tps` | 底部 token/speed 状态栏 | 装后跑 `fix-tps-theme.ps1` 让配色跟随系统主题 |

| `npm:pi-cache-guardian` | 缓存命中巡检 + 前缀漂移告警 | 与 §6 的 prefix-stabilizer 是同一根因的两端，一并用 |

| `npm:pi-prefix-stabilizer` | 系统提示词前缀稳定 + 漂移检测 | cache-compact 卸掉后**无顺序约束**了，见 §2.2 |
| `npm:@aboutlo/pi-smart-edit` | 覆盖内建 `edit`，容忍引号/空白不匹配 | **已生效**；`edit` 归它，匹配走「精确 → NFKC 归一化行」 |
| `git:github.com/BeYourDreams/pi-dsh-pet` | 桌面宠物：Electron 透明浮窗 + 91 个 WebM 动画，随 agent 状态（思考/写代码/空闲）切换 | **纯命令扩展**（`/pet` `/pet-stop`），零工具、零 wire 开销。**必须 `pi install`**，光 `npm i -g` pi 不加载（见 §3.6）。**2026-09-30 从 `npm:pi-dsh-pet` 换成 git 源**（自己 fork 的仓库，改完 `git pull` 就生效；`pi update --extensions` 也认它）。常驻与「整机只留一只」由本仓库的 `pi-pet-autostart.ts` 接管 |

| ~~`npm:pi-smart-reader`~~ | AST 骨架视图 / 单符号抽取：`smart_read`（`skeleton` 只留签名、`symbol` 抽函数体） | **已卸载 2026-10-14**（同日装同日判断为无用，见 §3.16 / §7.23）。原记录：passive mode 是死代码；wasm 只带 TS/JS 一份语法；还要钉 `web-tree-sitter@0.24.7` 才不半残 |
| `npm:@xynogen/pix-optimizer` | **压缩三合一**：caveman（输出，ASD-STE100 四档）+ ponytail（做法，YAGNI 三档）+ RTK（输入，bash 命令改写） | 2026-10-12 装。**取代**当天先装后卸的 `@izhimu/pi-caveman` / `pi-ponytail` / `pi-rtk`（三者功能被本包重写合并，3 → 1）。不注册任何工具；唯一入口是 `/optimizer`（**只有交互面板，无文本参数形**），状态存 `~/.pi/agent/pix.json` 的 `optimizer` 段。本机全开 **`caveman: ultra` / `rtk: on` / `ponytail: ultra`**，配置见 §3.15。RTK 首次加载时自动下 `rtk` 二进制到 `~/.pi/agent/bin`（带 checksum 校验） |
| `npm:@piotr-oles/pi-reflag` | 透明把 bash 里的 `find`→`fd`、`grep`→`rg` 改写后执行（更快搜索，agent 行为不变） | 2026-11-05 装，取代本仓库已删的 `no-find.ts`/`pi-no-find.ts`（§7.9/§4.2）；要求 `fd`/`rg` 在 PATH |

### 1.2

仓库 `extensions/` 是 canonical 源，`node install-local-extensions.mjs` 幂等同步到用户目录（`--check` 只体检、有漂移 exit 1）。

| 文件 | 作用 |
|---|---|
| `pi-pet-autostart.ts` | 让 `pi-dsh-pet` **默认常驻且整机只留一只**：TUI 会话一开就派发 `/pet`，已有宠物窗就复用不新开，跨会话/多开 pi 也只一只。不注册工具，只挂 `session_start` + `/pet-auto` 开关。配置见 §3.6 |
| ~~`pi-no-find.ts`~~（已删，2026-11-05） | find/grep → fd/rg 改写交由 `npm:@piotr-oles/pi-reflag`；本地扩展不再维护。历史见 §7.9/§4.2 |

> 曾经的 `pi-plan-tools.ts`（把 lazy-tools 剥掉的 `plan_mode_*` 助手工具捞回来）**已删除**：`@narumitw/pi-plan-mode` 2026-10-13 卸载，`/plan` 在本机用不了，这个补锅扩展就没存在意义了（见 §7.21）。
>
> 曾经的 `pi-shell.ts`

### 1.3 Skills（可选，非扩展）

| 技能 | 安装 | 用途 |
|---|---|---|
| `cangjie-skill`（仓颉） | `git clone github.com/kangarooking/cangjie-skill` | 把书 / 长视频 / 播客 / 课程蒸馏成可执行 skills |
| `goutoujunshi`（狗头军师） | `git clone github.com/shengjidaguai-china/goutoujunshi` | 恋爱军师与情绪支持 |
剧本/分镜/视频提示词三阶段由 `short-drama-pro` 负责（内置动作物理补丁 + 镜长按「动作+对话」算秒、默认单镜 4 秒且硬顶 ≤4 秒（SHT-31） + 
| ~~`pimeter`~~ | **已随 `pi-meter` 卸载失效**（2026-11-05） | 花费账单无扩展可查；如需重装 `pi-meter` |

> skill 不再常驻注入系统提示词（见 §6.2），需要时用 `omnify` 检索。实测本机技能清单 = 上述 3 组自装（`cangjie-skill` / `goutoujunshi` / drama 线 9 条 = 源自上游的 `short-drama-*` 8 条 + 本地自建的 `short-drama-pro`（九条全部由本仓库 `skills/` 镜像安装，均含本地定制，2026-10-18 起））+ `pi-meter` 自带 `pimeter`，共 12 条；新装 skill 要开新会话才加载（本会话内装的，omnify 当轮检索不到，2026-10-18 实验）；2026-10-12 后 **pi-caveman / pi-ponytail 自带的 8 条 skill 随包卸载消失**（`pi list`/agent 技能面板可见）。

---

## 2. 安装

### 2.1 顺序循环

**`pi install` 一次只写一条注册，绝不能并行**（并行会竞写 `settings.json` 丢包）。照序跑：

```bash
for p in pi-tps pi-cache-guardian; do
  pi install "npm:$p" || echo "[失败] $p"
done

# 前缀稳定器（cache-compact 2026-11-04 已卸，原来的硬顺序约束随之作废，见 §2.2）
for p in pi-prefix-stabilizer \
         @aboutlo/pi-smart-edit; do
  pi install "npm:$p" || echo "[失败] $p"
done

# git 源单独装（三个都要串行；宠物从 npm 换 git 时先 remove，见 §3.6）
pi install git:github.com/BeYourDreams/pi-lazy-tools
pi install git:github.com/BeYourDreams/pi-dsh-pet
# pi-one-ui 走 git 不走 npm：npm 包 0.9.1 的内置主题过不了 pi 严格 schema（§7.26）
pi install git:github.com/BeYourDreams/pi-one-ui
# pi-checkpoint / pi-notify / pi-meter 2026-11-05 卸载，不再装

# 2026-10-07 增补的 lsp 已于 2026-11-04 晚卸（见 §7.32）；test-runner / ocr / memory / core-subagent
# 2026-11-04 已卸（见 §7.29）。
# PR / ask-permission / no-find / cwd-guard / zvec / budget-guard / warm-cache / deepseek-cache / compaction-cache / pi-find / pi-mdiff / pi-mcp-adapter / pi-ask-question / rpiv-todo-lean / pi-lsp 均勿再装
# ⚠ 8 个 npm 一个都不能漏（见 §1）。

# 钩子层（不注册常驻工具：预算与花费；上下文截断 pi-mono-context-guard 已于 2026-11-04 卸，见 §7.28；
#        凭据拦截 pi-secret-guard 已于 2026-10-12 卸，见 §7.19；
#        只读规划模式 @narumitw/pi-plan-mode 已于 2026-10-13 卸，见 §7.21 —— 勿再装）
# pi-meter 2026-11-05 卸载（花费账单无扩展）

# 2026-10-14 已卸 pi-smart-reader（§3.16 / §7.23），如需重装：pi install "npm:pi-smart-reader" 并补回 web-tree-sitter@0.24.7 的 overrides

# 压缩三合一
pi install "npm:@xynogen/pix-optimizer"   # 取代已卸的 @izhimu/pi-caveman + pi-ponytail + pi-rtk（§7.20）
# 本地扩展（含 pi-pet-autostart.ts，宠物默认启用就靠它）
node install-local-extensions.mjs
# 项目级/用户级配置：把仓库 config/ 拷进 pi 真正读取的位置（`.pi/` 是运行时目录，仓库里整体忽略）
node install-project-config.mjs
```

> **GitHub 直连不通（国内出口 443 超时）时走加速源**：先把 git 的 https 改写到可达镜像，再照上面装。实测 `gh-proxy.com` 可用，`ghproxy.com`/`gitclone.com`/`ghproxy.cc` 本机 2026-10-02 均不可达或证书过期。全局设置一次即生效（含 `pi install` 内部的 git clone）：
>
> ```bash
> git config --global url."https://gh-proxy.com/https://github.com/".insteadOf "https://github.com/"
> pi install git:github.com/BeYourDreams/pi-lazy-tools
> pi install git:github.com/BeYourDreams/pi-dsh-pet
> # 不想留全局改写就改完装完撤掉：
> git config --global --unset url."https://gh-proxy.com/https://github.com/".insteadOf
> ```
>
> 若 `pi update --extensions` 也超时，同一改写继续生效（git 源的 update 就是 git pull）；装完即可 `/reload`。

装完自查：`pi list` 应见 **17 个扩展**（14 npm + 3 git；2026-11-02 把 `pi-one-ui` 从 npm 换到 git 所以是 3 git）

### 2.2 硬顺序约束

- **当前无顺序约束**（2026-11-04）：唯一的硬要求是「`pi-cache-compact` 必须装在 `pi-prefix-stabilizer` 之后」，而 cache-compact 已随九连卸下线（§7.29），现在没有任何两个扩展抢 `session_before_compact`。日后重装压缩缓存类扩展时，回到历史教训那条来排顺序。
- **历史教训**：`pi-deepseek-cache` / `pi-compaction-cache` / `pi-warm-cache` / `pi-cache-compact` 都抢过（或试图抢）同一个压缩钩子，同场时接管权按装卸顺序互相覆盖 —— 压缩侧只能留一个，且必须排在 `pi-prefix-stabilizer` 之后（§7.13）。
- 其余顺序不限（注：`pi-ask` / `rpiv-todo-lean` 本身已于 2026-11-04 晚卸，§7.32）。
它的 `tool_call` 钩子只 `broadcast` 不 block（实测 `extension_error` 0）

### 2.3 升级

```bash
pi update --extensions        # 只升扩展，不动 pi 本体（--all 会连 pi 一起升）

# 升完先看谁动了（fork 与 major 变更最容易出兼容问题）
pi list                                # 升完核一遍实际版本
```

**升级禁用 `pi install`**：对已装包会命中 npm 缓存、不升版本。升级一律走 `pi update --extensions`（不带版本号 = 取各包 npm 最新）。升级后跑 §8 体检。

> **skills 不走 `pi update`**：drama 线的九个技能由本仓库镜像安装与更新——`node sync-drama-skills.mjs install`（详见 §1.3 / §7.27 / `skills/UPSTREAM.md`），不再运行上游 `npx skills add`。

> 首次安装（§2.1）同样不带版本号，npm 自动解析 latest；**本仓库任何位置都不写死扩展版本号**。
> **两个 git 源走同一条命令**：`pi update --extensions` 对它们是 `git pull`（`pi-lazy-tools` 会 `reset --hard` + `clean -fdx`，**`fix-lazy-tools-notes.mjs` 的 `DOCS_NOTE` 路径补丁会被冲掉，重跑即恢复**——脚本靠 `where pi.exe` 定位 pi 根目录，pi 不在 PATH 时它直接跳过并报「未能定位」）。

> **升 `pi` 本体（`pi update --all`）或重装依赖会覆盖 `~/.pi/agent/node_modules` 里的补丁**：`fix-proper-lockfile-proxy.mjs`（§7.14，防 jiti Proxy 崩 pi）会被冲掉，升完重跑一次即可（`node fix-proper-lockfile-proxy.mjs --check` 只体检）。
> **`pi update npm:<包>` / 重装那个包会连它目录里的补丁一起冲掉**：`fix-pi-one-ui-theme.mjs` 打在 `npm/node_modules/pi-one-ui/themes/*.json` 上的补丁同理（§7.26），升完按 §8 表重跑。

> `pi-dsh-pet` 换成 git 源后**不再有「反复重下 48MB 动画」的问题**——clone 就带 `assets/thumb`（91 个 WebM，整仓 202M），`pi update` 只拉增量；只有第一次 `/pet` 要下 Electron ≈100MB。
> **`pi-one-ui` 走 git 源，别再从 `D:\AI\pi-one-ui` 本地装**（本机 2026-11-02；2026-10-27 ~ 11-02 之间曾是 `pi install ./` 本地源码）：上面第一个循环里的 `pi-one-ui` 要跳过（那是 `npm:`，0.9.1 的主题不合规），改装：
>
> ```bash
> pi remove "D:\AI\pi-one-ui"                 # 先摘本地源码那条，否则两份并存各加载一次
> pi install git:github.com/BeYourDreams/pi-one-ui
> ```
>
> 落在 `~/.pi/agent/git/github.com/BeYourDreams/pi-one-ui`，`settings.json` 里不再有 `npm:pi-one-ui` 也不再有绝对路径，`pi update --extensions` 会连它一起拉。源码里主题已合规（§7.26），`fix-pi-one-ui-theme.mjs` 现在是「两份副本都体检」的守门脚本，不是必跑的补丁。

**处理办法见 §3.4；升完必跑一次 bench 确认 wire 工具集没变**（本次实测未变：升完是 8 个工具 / 8317B，`extension_error` 0；随后按「只保留默认工具」收敛为 6 个 / 6010B，2026-09-30 卸 `pi-web-access` 后为 **5 个 / 5664B**）。

### 2.4 卸载

```bash
pi remove npm:<包名>
```

卸载后同步删掉只为它存在的配置（例：`pi-footer-template` 卸载时连带删 `~/.pi/agent/pi-one-ui.json`），否则留下死配置。

---

## 3. 必做配置

### 3.1 ~~批准 install 脚本~~（**2026-11-04 起无对象**：`allowScripts` 里那两条的宿主 `@injaneity/pi-computer-use` 与 `@chendpoc/pi-memory` 随九连卸下线，`~/.pi/agent/npm/package.json` 已无 `allowScripts` 键。以下为历史留档，两者装回来时照做）

```bash
cd ~/.pi/agent/npm          # 必须在含 package.json 的目录里跑
npm install-scripts approve @injaneity/pi-computer-use better-sqlite3
npm rebuild better-sqlite3  # 批完必须重编，批准本身不建原生 binding
```

当下 `~/.pi/agent/npm/package.json` 的 `allowScripts`：

```json
{
  "@injaneity/pi-computer-use@0.5.1": true,
  "better-sqlite3@12.11.1": true
}
```

- **`better-sqlite3` 是 `@chendpoc/pi-memory` 带来的**（`dependencies: {"better-sqlite3": "^12.10.0"}` → 树内 **12.11.1**；`@injaneity/pi-computer-use` 现在**不**依赖它，它的 postinstall 只是 `scripts/setup-helper.mjs` 装原生辅助程序）。用途是 pi-memory 的向量索引：`dist/sidecar/server/vec/store.js:11` 的 `require("better-sqlite3")`。
- ⚠️ **版本号会随依赖重解析漂移**（本机就踩过：`allowScripts` 里写的是 `better-sqlite3@13.0.3`，树里实际是 12.11.1 → npm 视为「未覆盖」→ binding 不建 → 加载 pi-memory 报 `Could not locate the bindings file. Tried:`）。所以：
  1. 批准时**写不带版本号的包名**，让 npm 自己把树内版本写进 `allowScripts`（输出会打 `removed-stale ...@13.0.3` / `added ...@12.11.1`）；
  2. 安装/卸载**任何一个**扩展后（npm 会重解析整棵树）都复验一次：`node -e "console.log(require('better-sqlite3')(':memory:').prepare('select 1 as x').get())"` 应打印 `{ x: 1 }`；报 `Could not locate the bindings file` 就重跑上面两条。
  3. 重编需要 MSVC：本机 `cl.exe` 不在 PATH，但 `C:\Program Files (x86)\Microsoft Visual Studio\2022` 在位，node-gyp 经 vswhere 能找到 → `rebuilt dependencies successfully`。
- `~/.pi/agent/npm/package-lock.json` 会被 npm 重写（本机 68KB → 222KB，npm 12 的 v3 格式更啰嗦），**属正常，不必回滚**。
- **`@chendpoc/pi-memory@0.3.2` 的 postinstall 是有意不批的**（`npm install-scripts ls` 会一直报它 `blocked`）：该脚本只跑 `pi-memory init` + `scheduler sync`，**best-effort、不是加载必需**（实测不批照样加载，`~/.pi/pi-memory-data/` 下有 `MEMORY.md` + `logs`；该目录已于 2026-11-04 随包卸载清理，§7.29），符合「只批必需」的纪律。要批就 `npm install-scripts approve @chendpoc/pi-memory`（会写 `~/.pi/pi-memory-data` 与调度任务，自行取舍）。
- 其余包实测均无 install 脚本。

### 3.2 ~~smart-context~~（已卸载 2026-10-02，配置一并作废）

原配置位置 `~/.pi/agent/config/smart-context-ext-config.json` 已删（包没了，文件是死配置；重装同版本会自动重建）。当时值留档：

```json
{ "enabled": true, "compactModel": { "type": "ref", "ref": "" }, "reminderThresholds": [60000, 75000, 90000], "excludedModels": [] }
```

**卸载理由**（实测，不是猜）：

| 事实 | 证据 |
|---|---|
| 阈值提醒确实触发过 | `~/.pi/agent/sessions/--D--AI-pi-dsh-pet--/2026-10-02T12-29-47-157Z_*.jsonl` 两条 `smart-context:fired`：`{"tiers":[60000,75000],"tokens":89456}`、`{"tiers":[90000],"tokens":91855}`，各跟一条 `custom_message` 提醒（89.5K/128K 69.9%、91.9K/128K 71.8%） |
| `compact_context` 一次没被调 | 全 `sessions/` grep `toolName/name = compact_context`，0 命中（唯一匹配是 system prompt 的工具清单） |
| 所以净收益 = 0 | 多两个包（5 个依赖）+ 一份配置 + 一次提醒往返，换来 0 次压缩 |

**根因**（三条，叠加后基本不可能触发）：

1. 提醒**是数据不是指令**。文案原文：「达阶段边界……时才调用 `compact_context`；**否则忽略本提示继续工作**」。「阶段边界」这个条件模型几乎永不判定成立，于是永远忽略。
2. `compactModel.ref` 是空串 → `pickMode` 只能走 same-model，拿不到 cross-model 的廉价模型收益。
3. 阈值 60K/75K/90K 对 128K 窗 = 47%/59%/70%，**比内建 auto 压缩的触发点还晚**，插件还没等到动手，内建 `/compact` 已经压完了。

**留个教训**：阈值类扩展的价值全在「agent 真的执行」上。提醒送到 ≠ 模型动手。要这类功能，先 grep session 确认 toolCall 真发生过，再决定留不留。

> §2.2 原本那条「compaction-cache 必须在 smart-context 之后」的硬顺序随之作废；2026-10-09 后压缩侧只剩 prefix-stabilizer → cache-compact 一条（§7.13）。

### 3.3 ~~pi-cache-compact~~（**已卸载 2026-11-04，见 §7.29**；`~/.pi/agent/cache-compact.json` 已随卸删除。压缩回到 Pi 内置默认路径，本机默认压缩必 `cacheRead: 0`（§7.13 取证），即重装意义不大。以下为历史留档）

**本机生产配置（2026-10-09 定稿）**：`~/.pi/agent/cache-compact.json` = `{"models": ["1/1"]}`

```json
{ "models": ["1/1"] }
```

- 写白名单而不是不写文件，是为了让**「只对当前 provider/model 生效」这件事显式可见**（本机只有一个 provider「1」、模型 `1`，`1/1` 即命中），避免以后换 provider 后默默全量生效。
- ⚠️ **千万别开 `debug`/`debugPayloads`**：`cache-compact-debug.jsonl` 会 dump 全量 payload（**含完整对话内容**），本机已开过又删（1.1MB）。取证写法见下方「临时取证」，**测完即删**：

```json
{ "debug": true, "debugFile": "C:/Users/yinxuehao/.pi/agent/cache-compact-debug.jsonl" }
```

- **机制**：拦截 `session_before_compact`，把摘要请求拼成活会话的**严格续写**（同 system prompt + tools + 全部 messages + 追加一问 "The messages above are a conversation to summarize. Create a structured context checkpoint summary…"），因此任意支持前缀缓存的服务端都能命中。**手动 `/compact` 与自动压缩同钩子，都走这条路径。**
- **fail-safe 是它最大的优点**：摘要为空 / 被 `length` 截断 / 夹带工具调用 → 返回 nothing，回落 Pi 默认压缩，绝不给出坏摘要。
- 常用选项：`models`（限定 provider/model，默认全放行）、`continuation: true`（前向续写；append-only 缓存会把短前缀当全量重预填，故别关）、`deferAfterCacheMiss: true`（冷 miss 后 15 分钟内把压缩让回 Pi，不烧第二次冷 prefill）、`summaryMaxTokens`（默认取 Pi 自身上限）、`debugPayloads`（dump 全量 payload，**含完整对话，测完即关**）。
- **取证读法**：debug JSONL 里 `"summary": true` 的 `provider_request` / `provider_response` 是扩展的续写请求；命中数看 `summary_result` / `wrote cache-friendly summary` 记录的 `cacheRead`；摘要不可用时终端直接打 `[cache-compact] summary rejected … usage:{…}`。
- ⚠️ **热前缀才可能命中**：上游（mimo 免费端点）缓存几分钟就过期，隔夜压缩必 `cacheRead: 0`（此时 `deferAfterCacheMiss` 自动让位，属正常）。
- ~~原 `pi-compaction-cache` 的必做配置（已随卸载删除，留档）~~：`~/.pi/agent/compaction-cache.json` = `{"models": ["1", "1/1"], "scope": "boundary", "logPath": "C:/Users/yinxuehao/.pi/agent/logs/compaction-cache.log", "debug": false}`，配 `/compaction-cache-status` 与该日志。**勿再写回**（§7.13）。

### 3.4 懒加载常驻集 = `settings.json` 的 `defaultTools`

一个字段两用：pi 用 `defaultTools` 决定「哪些内建工具注册」，`pi-lazy-tools` 用它决定「谁不被懒加载」（项目级整体覆盖用户级）。本机两处写同一份名单：

```jsonc
// ~/.pi/agent/settings.json 与 <项目>/.pi/settings.json
// 本仓库的项目级 canonical 源 = config/pi-project/settings.json（`.pi/` 整体 gitignore）
// 拷进去：node install-project-config.mjs ｜ 体检：node install-project-config.mjs --check
{ "defaultTools": ["read", "edit", "write", "bash"] }
```

> **本机就选 pi 的内置默认 4 个**（`dist/core/sdk.js:140` 的 `defaultActiveToolNames`），一个扩展工具都不加：搜文件名/目录、搜内容全部交给 `omnify` 按需代理执行。换来 `8317B → 5664B`（**−2653B ≈ −689 tok/请求**，见 §6.3），代价是每次搜索多 1–2 个往返轮次。
> **`omnify` 不写进 `defaultTools`**：它由 lazy-tools 在 `session_start` 无条件写进 active 集（`setActiveTools`），写不写都一样。
> **`grep` / `fd` 不写也会注册**（扩展注册不过内建闸），只是被 lazy 隐藏；`omnify` 能把它们搜出来并执行（已实测）。**内建的 `ls` / `powershell` 搜得出、却执行不了**（pi 用内部工厂造它们，`sourceInfo` 是合成标记 `<sdk:ls>`，没有可 import 的源码）→ 这类需求一律 `bash ls`。fork 已把这个原因写进 omnify 的失败文案（见 §7.3）。
> **`~/.pi/lazy-tools.json` 已删除**（2026-09-29，`pi-lazy-tools` 0.4.0 起只告警不读取；旧副本 `lazy-tools.json.bak` / `.bak2` 同日一并删掉，内容已进 `defaultTools`）。新装扩展**不要**往 `defaultTools` 里加（硬规则，见 §5 第 0 条）。
> 改完 `/reload` 生效（不必重启会话）。

### 3.5 工具注册闸：`defaultTools`（项目 + 用户两处都要写）

项目 `.pi/settings.json` 与 `~/.pi/agent/settings.json` 都要写上一节那份名单，否则进了某项目就被整体覆盖成内建默认（`read bash edit write`）。本机两处写的正是这份默认名单，所以项目间切换不会有差异。

> ⚠️ 0.4.0 之前这里确实是「两道闸」（`defaultTools` 管注册 + `lazy-tools.json` 的 `resident` 管常驻），**现在合并成一道**，只查 `defaultTools`。

### 3.6 桌面宠物：独立服务端 + 整机一只（2026-09-30 按上游 0.0.2 重写）

上游 0.0.2 把桌宠改成了**独立应用**（`pi-pet start`，也发单文件 exe）：自带 HTTP + WS 服务、自己选端口、自己管窗与单例锁。于是本机扩展 `extensions/pi-pet-autostart.ts` 从「内嵌宿主 + 托管窗」缩成**薄客户端**：

| 角色 | 谁 | 关键点 |
|---|---|---|
| 生产者（每个 pi 会话一个） | 本扩展 | 只读 `<home>/port`、`GET /health`、`WS /feed`、`POST /control`；`spawn` 只出现在「拉宿主」一处 |
| 服务端（整机一只） | 上游 `bin/pi-pet.cjs` | 单例锁 `<home>/host.lock`（mkdir）、端口写 `<home>/port`、状态写 `<home>/state.json` |
| 窗（整机一只） | 上游 Electron | 由服务端自己拉；`window:false` 时根本不拉 |

**三条铁律**（每条都对应本机真实报障）：

1. `spawn` 只许出现在拉宿主一处，且必须带 `mkdir` 启动锁 + 冷却 + 指数退避 + 每进程上限 —— 上一场「pet 自启动脚本会无限启动 bun 导致电脑卡死」就是这里没有闸。
2. 探活链路**零进程**：只读 `state.json` / `port` + `GET /health`。`process.execPath` **绝不能**当 node 跑 CLI —— 本机 pi 是 Bun 打包单文件（111MB），pi 会把脚本路径当 prompt 的位置参数，然后开一整个 TUI 会话挂在那儿（机器看着像「卡死」）。
3. **永不写** `~/.pi/agent/state/pi-pet-global.json`：上游 `foreignStateFiles()` 会把外部状态文件当成「别的宿主」，于是两个宿主互相认定对方活着 → 谁也不自启、谁也不退。本扩展只读 `<home>/` 下的文件 + `ctrl.json`。

配置 `~/.pi/agent/extensions/pi-dsh-pet.json`（默认启用；**0.0.1 的旧键已迁移**，原件留在同目录 `pi-dsh-pet.json.bak-v0.0.1`）：

```json
{ "autostart": true, "feed": true, "size": "normal", "maxPets": 1, "keepAlive": true, "window": true, "port": 0 }
```

- `autostart: false` → 不自动拉宿主（仍可 `/pet` 手动拉）；**只认显式 `false`**，写错类型（如 `"false"`）仍按启用算，避免宠物莫名消失。
- `feed: false` → 本会话不喂事件（宠物照常自己动）。
- `size` / `maxPets` / `keepAlive` / `window` → 写进上游 `<home>/ctrl.json`（服务端每 2s 读一次当控制通道；`desired:false` 由**服务端自己**关窗退出并放锁，别的进程不伸手 `taskkill`）。`maxPets` 1–8，超界报清范围。
- `window: false` → 拉宿主用 **`serve`**（只起服务不开窗，等价旧的 `start --no-window`）；`true` → `start`（前台带窗，服务端靠 `keepAlive()` 不退出）。
- `port: 0` → 拉宿主**不传** `--port`，由服务端自己挑（默认 47653，被占退随机）。**别把旧版的 `port` 搬过来**：那版指的是扩展自己那个 HTTP 桥的端口，现在归服务端，写死平白多一种「端口被占 → 退出码 4」。
- `startTimeoutMs`（默认 12s）/ `maxStartAttempts`（默认 3）/ `reapStrays`（整机野进程清理，默认开）/ `node`（跑服务端的运行时：config > `PI_PET_NODE` > PATH 上的 node > bun；**绝不是 pi 自己**）/ `home`（覆盖 `<home>`，默认 `%APPDATA%/pi-dsh-pet`）。
- **窗僵死会自己换一扇**：每 20s 读一次 `/health`（零进程），同一扇窗 `windowPid > 0` 而 `clients` 一直是 `0` 满 60s 就 `POST /control restart-window`，本会话最多换 3 次（`PI_PET_WINDOW_REVIVE_POLL_MS` / `_AFTER_MS` / `_MAX`）。为何要客户端兜一层：上游 `needsRelaunch()` 只认「pid 死了才算窗没了」，僵窗（进程活着、渲染进程崩了）落两不管（§7.25）。
- 文件缺失 / 读坏 = 按**启用**处理（读坏会 `notify` 一次），与其他钩子扩展同一套约定。
- 会话内随手切：`/pet-auto on|off|size <档位>|max <只数>|restart|status`，改动写回同一个 json（并同步 `ctrl.json`）。
- 旧键 `delayMs` / `bridge` / `host` / `sweepMs` / `hostRuntime` 随旧架构作废（新扩展读都不读）；`/pet-auto cleanup|host|bridge` 同样作废 —— 单例与数量现在由服务端自己的锁 + `maxPets` 转发闸兜住（§3.6.1）。

#### 3.6.1 「只许一只」现在由谁兜

| 关口 | 归谁 | 怎么拦 |
|---|---|---|
| 两个 pi 会话同时拉宿主 | 本扩展 | `mkdir` 启动锁 `<state>/boot.lock`：抢不到就只等对方公布端口（`waitForHost`），**不 spawn** |
| 宿主之间 | 上游服务端 | `<home>/host.lock`（mkdir + `owner.json`）；主人 pid 活着就安静退出（让位），死了才接管 |
| 一扇窗里 `add_pet` | 上游服务端 | `maxPets<=1` 时转发层直接丢 `add_pet*` 帧，任何会话、任何旧路都绕不过 |
| 没人管时冒出来的野宿主 | 本扩展 | `reapStrays` 每 10 分钟整机扫一次，**只杀命令行含 `pi-pet.cjs` 的 `pi.exe`**（绝不碰当前会话的 pi.exe；判定用 `-match 'pi-pet\.cjs'`） |

本扩展**不再**扫窗（`pet-electron.cjs <port>` 那套 PowerShell/CIM 扫描连同它的四个 bug 一起退休）：窗归服务端管，扩展看不见也不该去动。

**零 token 成本（实测）**：两个扩展都**不注册工具**，不进 `defaultTools`（§3.4 硬规则）。装完跑 bench：system 3026B + tools 2638B（5 个）= **5664B，与装之前逐字节一致**。

**安装路径的坑**：上游 README 写 `npm install -g pi-dsh-pet`，但 **pi 不扫全局 `node_modules`** —— 只全局装的话 `/pet` 根本不存在。必须在 pi 里注册一次。本机 2026-09-30 换成 git 源：`pi remove npm:pi-dsh-pet` + `pi install git:github.com/BeYourDreams/pi-dsh-pet`（两份同时声明会被当两个包各加载一次，必须先 remove；`pi remove` 报 `EBUSY` 说明还有 Electron 窗占着旧目录 —— 先 `/pet-auto off` 或 `taskkill` 掉它）。装完落在 `~/.pi/agent/git/github.com/BeYourDreams/pi-dsh-pet`。

> **上游自带的扩展已禁用** —— 但**写法很关键**：必须在 `settings.json` 的 `packages` 里把 `pi-dsh-pet` 写成 **object form**（`{"source": "git:github.com/BeYourDreams/pi-dsh-pet", "extensions": []}`），**光写纯字符串 `git:github.com/...` 屏不掉上游扩展**（`extensions: []` 只筛 npm 包内的子扩展，对仓库顶层 `pi/extensions/index.ts` 无效 —— docs/packages.md「Select package resources」确认 1.1.0 支持 object form 的 `extensions` 选择）。
>
> | 写法 | 上游扩展 | 症状 |
> |---|---|---|
> | `"git:github.com/BeYourDreams/pi-dsh-pet"` | **照旧加载**（本机踩了一个月才发现） | 重复注册 `/pet` `/pet-stop` `/pet-say` `/pet-status`（本地薄客户端也注册同名 + `/pet-auto`）；多一条 `session_start → ensureHost()` 走 `state.json` 单一来源；终端刷 `[pi-dsh-pet] /feed 连接断开，2s 后重连`，headless 跑不完（§7.13 的 exit 124 噪音一半来自它） |
> | `{"source": "git:...", "extensions": []}` | **不加载** ✅ | 干净：`pi list` 该行显示 `git:github.com/BeYourDreams/pi-dsh-pet (filtered)`，终端只剩本地客户端的 `[pi-pet-autostart]` |
>
> 验证法（改完 `/reload` 后跑）：`timeout 70 pi --no-session -p "reply with: ok"` → 输出里应**不出现** `[pi-dsh-pet]` 前缀的行；`pi list` 应出现 `(filtered)` 且条目数不变（本机 2026-11-02 为 **27**）。上游源码留着做参考（`~/.pi/agent/git/github.com/BeYourDreams/pi-dsh-pet/pi/extensions/index.ts`），本机跑的是本地薄客户端。
>
> **2026-11-02 换 owner（`qq458249269` → `BeYourDreams`）的一个坑**：重 clone 237M 直连撞 `fetch-pack: invalid index-pack output`；两 owner 的 `main` 同一个 HEAD（`git ls-remote` 一致），于是把旧 clone `git/github.com/qq458249269/pi-dsh-pet` 用 **NTFS junction** 指到 `git/github.com/BeYourDreams/pi-dsh-pet`，再在那个 clone 里 `git remote set-url` 到新 URL，避开重下（正在跑的宠物 Electron 占旧目录，`mv` 报 `Device or resource busy`）。`settings.json` 的 object form source 同步改成新 owner，`pi list` 仍是 `(filtered)`。**收尾（下次 `/pet-auto off` 或宠物窗关掉后做）**：删 junction → 真 `mv` 目录到新 owner 路径 → 无需再动 remote。

**首次开窗要下 Electron ≈100MB**（上游在 Windows 自动设 `ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/`）；包里 91 个透明 WebM，`assets/thumb` 解包 48MB。

这一轮重构定下的几条回归约束（历史探针随 `.sc-test/` 一起删除，改本扩展时按这几条自查）：**先打再探**（启动时零能力探测，命令失败才两个只读 GET）、**只有 `home/port` 也能复用宿主**（两宿主互锁的入场券）、**心跳陈旧不再单独判死**（`/health` + pid 才权威，陈旧且探不通才重拉）、**退出码翻译**（2 参数错 / 3 缺依赖 → `cd <pkg> && npm install` / 4 端口）、**一次 `/feed` 连接**（并发重连不许叠连接，见 §7.5）。回退：`pi remove git:github.com/BeYourDreams/pi-dsh-pet` + 删 `extensions/pi-pet-autostart.ts` 与 `pi-dsh-pet.json` 再 `/reload`。



#### 3.6.2 服务端契约（本扩展认的那份，2026-09-30 实测 0.0.2）

动词（`node bin/pi-pet.cjs <verb>`）：`serve`（= `start --no-window`，只起服务）/ `start`（前台带窗，`keepAlive()` 让它不退出）/ `status --json` / `stop` / `restart` / `feed` / `say` / `add` / `port`（**只打印端口，给脚本用**）/ `token` / `config` / `doctor`。退出码：`0` 正常、`1` 没在跑、`2` 参数错、`3` 依赖或资产缺失、`4` 端口问题 —— 扩展把子进程的退出码翻译成人话（并把原话留在 `~/.pi/agent/state/spawn-log.txt`，见下）。

| 文件 | 谁写 | 内容 |
|---|---|---|
| `<home>/port` | 服务端 | **端口真源**：一行数字。上游注释写明「pi 扩展 / dsh 插件 / 外部脚本读这一行就能连上」 |
| `<home>/token` | 服务端 | 鉴权口令，`Authorization: Bearer` 或 `?token=` |
| `<home>/state.json` | 服务端 | 本仓库宿主的额外记账（pid / port / token / windowState / heartbeatAt）；**没有它服务也在跑**，所以端口文件才是契约 |
| `<home>/ctrl.json` | 本扩展 | `desired` / `keepAlive` / `maxPets` / `size` / `window` / `restartNonce` |
| `<home>/host.lock/` | 服务端 | 整机单例锁（`owner.json` 带 pid）；主人死了下个来接管 |
| `~/.pi/agent/state/pi-pet-autostart.json` | 本扩展 | 自己的记账：冷却 `lastStartAt`、失败次数 `startAttempts`、野进程清理 `lastReapAt` |
| `~/.pi/agent/state/spawn-log.txt` | 本扩展 | 每次拉宿主的 stdout/stderr 尾（**落文件而不是管道**：服务端是前台应用，父会话退出后管道读端消失 → 它写 EPIPE 崩掉） |

**能力探测：先打再探，不预判**。`GET /control`（不带 action）只能回答「这个端点在不在」，回答不了「我这个动作行不行」；所以热路径上一次 POST 成功就完事，**失败之后**才做两个只读 GET（`/control` + `/event`，5s 缓存），用来判三种情况：外来/旧宿主**没有控制面**（404）→ `say` 退到事件面 `POST /event {type:"say"}`，其余动作说清「它只支持什么 + 怎么换成新宿主」；`401` → token 认错（多半是 `home` 认错了）；其余 → 把宿主自己的报错原样带出去。

> **上游 `probeCaps()` 在 0.0.2 上会把自己误判**（见 §7.5）：它要求 `GET /control` 回 400 **且 body 里有 hint**，而实测真宿主回的是 400 + **空 body** `{}`（带 hint 的那条只在 POST 分支）。照抄它的判据 = 「`/pet` 永远叫不出窗」，也就是本轮报障里的「拉不起来 pet」。本扩展的判据放宽到「非 404」。

**真机实测（已装副本，2026-09-30 晚）**：

```
session_start → 宿主 658ms 起来：pid 22652 port 47653 windowState=starting
/feed 接上：feeds=1 · {"pi-37780":1}
/pet-status → 宿主：pid 22652 :47653（端口来源 state.json，<home>/port 写的是 47653）· 窗：connected pid 39312 · 换窗 1 次
              生产者：feeds 1 · 能力：控制面 有 · 事件面 有 · 鉴权 通过
              它支持的动作：shutdown | restart-window | add-pet | drop-pets | say | pause | resume | hide-window | show-window
/pet-say → 说：真机验证（一次 POST 成功，零 GET 探测）
pi-pet doctor → ✓ 版本 / ✓ 包根目录 / ✓ 窗脚本 / ✓ 素材目录 …
pi-pet stop → 宿主自己退出，state.json 清掉；整机无 pi.exe 野进程
```

`/pet-status` 会摊开：宿主在不在（pid / 端口 / **端口来源**：`state.json` 还是 `port` 文件）、窗与换窗次数、生产者数（`feeds` + `feedsBySource`）、能力面与可用动作、feed 桥状态（`connecting/open/closed` + 最近错误）、本扩展的冷却与失败次数、spawn 日志路径；子命令 `doctor` 直接转发上游自检（用户主动触发的一次进程，不违反「spawn 只出现在拉宿主一处」的自动链路约定）。

---

### 3.7 ~~`pi-web-access`~~（**已卸载 2026-11-04，见 §7.29**；`~/.pi/agent/web-search.json` 已随卸删除。重装时第一件事必须写回 `toolActivation: "eager"`，否则 `web_enable` 中途掀前缀缓存。以下为历史留档）

```json
{ "toolActivation": "eager" }
```

**只有一个键，但少写就退化成 §7.4 那个坑。** 取值只有三种（写错值扩展启动即抛）：

| 值 | 行为 | 本机为什么用 |
|---|---|---|
| `eager`（本机） | 四工具从会话第一轮就 active，全程**没有** `web_enable` 加载器，也就不会中途改 active 集 | ✅ |
| `auto`（默认） | 看模型：模型没有「会话中途加工具免重算」的 compat 标记 → 走 eager 分支 | 行为随模型/provider 变，不确定 |
| `dynamic` | 永远先给一个 `web_enable` 加载器，模型调它才 `setActiveTools` | ❌ 就是 §7.4 卸掉它的原因 |

**别担心「eager = 每轮多背 11KB」** —— 本机 lazy-tools 会接手（2026-10-06 探针实测）：

| 时点 | active 工具集 |
|---|---|
| `session_start` | 51 个注册工具**全部**在列，含 `web_search` `source_check` `fetch_content` `get_search_content` |
| `before_agent_start`（lazy-tools 跑完） | `read,edit,write,bash,omnify` |

即：eager 保证了**不会出现 `web_enable`**（前缀掀不掀）；lazy-tools 保证它们**不上 wire**（§6.3 的瘦身取向不受影响）；要用时 `omnify` 按名捞回来代理执行。**实测全链路通**：新会话里 `omnify` 搜到 `web_search` 并执行，查 `pi.dev` 返回标题 `Pi.dev`。

**缓存实测（2026-10-06，eager 启用后）**：

| 指标 | 结果 |
|---|---|
| wire 体积（`before_provider_request` 实测） | system 2804B + tools 2490B = **5294B**，tools 只有 `read,edit,write,bash,omnify`，**四个 web 工具一个都不在 wire 上** |
| 中途 active 集变化（transcript `toolsAdded`） | 全会话**仅 1 条**（session_start 那次），用完 `web_search` 之后**没有第二条** |
| cacheRead 序列（read → omnify 搜 nodejs → read，4 个请求） | 143 → 2679 → 2953 → 3640，**单调上升，无塌方**（对比 §7.4 旧版：86016 → 1152） |

结论：eager 模式下缓存**没有**问题——掀缓存需要「会话中途换工具集」，而 eager + lazy-tools 的组合里根本不存在这个动作。

搜索源共 26 个（brave / tavily / exa / kimi / firecrawl / … / duckduckgo），**duckduckgo 无需 key**，其余在同一个 `web-search.json` 里填 key。命令：`/websearch` 走 provider 选择面板、`/search` 直搜、`/curator` 批量检索、`/google-account` 管 Google 登录态。

> ⚠️ **SSRF 与本机 TUN/fake-IP 代理的旧账**（2026-09-30 实测）：fake-IP 把 `github.com` 解析成 `127.0.0.1`，`fetch_content` 直接报 `Blocked internal address for github.com: 127.0.0.1`。要抓这类站需在配置里放 `ssrf.allowRanges`。本机复装后**未复测出网**（只验证了加载不报错）。

### 3.8 ~~`pi-checkpoint`~~（**2026-11-05 卸载**，会话级 `/undo` 不再可用；文件级靠 git）


| 边界 | 后果 | 对策 |
|---|---|---|
| 快照在内存，非 git 里的栈 | 重启 pi 后 `/checkpoint` 栈空（git ref 还在） | 同一 sessionId 恢复会话时编号从最高 ref 续，不会覆盖旧点 |
| `/undo` 走 `git checkout <ref> -- .` | **只还原已跟踪文件**；该轮新增的未跟踪文件会留在原地，该轮新 `git add` 进索引的文件也留在原地 | undo 后自己扫一眼 `git status` |
| ref 按 commit date 剪 | 超过 **30 天**的快照被永久删 | 跨月的事别指望 `/undo` |

非 git 仓库里三个命令静默 no-op + 一条通知。另外它会写 `refs/pi-checkpoints/*`，不碰你的分支、tag、stash —— `git for-each-ref refs/pi-checkpoints` 可见。

### 3.9 ~~`bash-prelude.sh`~~（**已作废**：脚本随 `e9c4132` 于 2026-11-03 `git rm`，`shellCommandPrefix` 本机从未写过；2026-11-04 确认「用不到」后定为**不恢复**。以下为历史留档，勿再照着补）

`~/.pi/agent/settings.json` 里：

```json
"shellCommandPrefix": "source ~/.pi/agent/bash-prelude.sh"
```

~~`~/.pi/agent/bash-prelude.sh`（canonical 在仓库 `config/agent/bash-prelude.sh`，393B）~~ —— **该文件已随 `e9c4132` 从仓库删除、本机也不存在**；下面只是原文留档，不再拷入：

```bash
# pi 的 Bash 工具用 `bash -c` 跑，不加载任何交互式启动文件；cmd.exe 习惯写的
# `cd /d D:/path` 到 bash 里是「内建 cd 收到两个参数」→ bash: cd: too many arguments。
# MSYS/MINGW64 下那个 /d 是 drive-D 挂载点而非 /d 开关，所以丢掉它永远是对的意图。
cd() {
	if [ "$#" -gt 1 ] && [ "$1" = "/d" ]; then
		shift
	fi
	builtin cd "$@"
}
```

- 只处理**独立**的 `/d` token：`cd /d/AI`（真路径）原样不动。
- **双向兼容 cmd 习惯**：既让 `cd /d D:/path` 能用，也不碰 bash 自己的 `cd` 语义（`builtin cd` 转发）。
- ~~**别删**~~ —— **已删且不恢复**。现状：bash 里写 `cd /d D:/x` 报 `bash: cd: too many arguments`，**改用 `cd D:/x` 或 `cd /d/AI/...`**（正斜杠路径一直正常）。原文「必须跟本机 bash-guard 扩展的路径约定配套」的前提也已消失——bash-guard 2026-11-03 一并卸了。
- 写新前缀时的纪律：**保持快、无交互、不输出**（它在**每一条**命令前执行；`cd` 别加 echo）。

### 3.10 关闭内建 MCP：`"extensions": ["-builtin:mcp"]`（**2026-11-04 晚已作废**）

- 历史做法：`"extensions": ["-builtin:mcp"]` 关掉内建 `mcp` 工具，让 `pi-mcp-adapter` 独占 MCP 生命周期。
- **2026-11-04 晚 `pi-mcp-adapter` 已卸（见 §7.32）**，本机不再有任何 MCP 工具，这条禁用也就没有对象了：`settings.json` 已**删除** `extensions` 键（清空后整个键移除）。
- 如果将来重装某个 MCP 适配器，再按原样写回这条；单纯用内建 `mcp` 就不需要它。
- 留档：`~/.pi/agent/mcp-onboarding.json`（内建 MCP 引导向导的完成标记）仍在盘上，**勿手改**，由向导自己维护。

### 3.11 用户级 `settings.json` 备忘（非默认项，2026-10-09 实况）

以下都是本机**有意设的非默认值**，重建环境时漏写就会掉行为（已逐项实测生效）：

| 键 | 值 | 作用 / 备注 |
|---|---|---|
| `defaultThinkingLevel` | `"high"` | 默认思考强度 |
| ~~`shellCommandPrefix`~~ | ~~`"source ~/.pi/agent/bash-prelude.sh"`~~ | **本机从未写过此键**（§3.9 已作废）：脚本 2026-11-03 已 `git rm`，2026-11-04 定为不恢复 |
| ~~`extensions`~~ | ~~`["-builtin:mcp"]`~~ | **2026-11-04 晚已删**：`pi-mcp-adapter` 卸载后无对象（§3.10 / §7.32） |
| `defaultTools` | `["read","edit","write","bash"]` | §3.4 / §3.5（项目级同值） |
| ~~`cacheWarming`~~ | ~~`"streaming"`~~ | **2026-11-04 已删**：它会在每轮之后自己追加一次 warmup 请求（§7.30）。删后首 token 略慢、少一发请求 |
| `compaction` | `{"enabled": true, "reserveTokens": 32768, "keepRecentTokens": 8000}` | 自动压缩开；预留 32K + 保留最近 8K（128K 窗下偏保守，且让 `pi-cache-compact` 有足够摘要空间） |
| `markdown.mermaid` | `"streaming"` | mermaid 流式渲染 |
| `whimsical` | `{"enabled": true, "weights": {A:15,B:10,C:10,D:15,E:0,F:25,G:25}, "spinnerPreset": "sleekOrbit"}` | 思考动画权重（`E:0` 是故意关掉某个效果） |
| `tuiMode` | `"fullscreen"` | 全屏 TUI |
| `doubleEscapeAction` | `"tree"` | 双击 ESC 打开文件树 |
| `httpIdleTimeoutMs` | `0` | 关闭 HTTP 空闲超时（长请求不被砍） |
| `images.blockImages` | `true` | 模型侧不传图 |
| `showHardwareCursor` | `true` / `fullscreenCopyOnSelect` | 光标形状 / 选中即复制 |
| `hideThinkingBlock` | `true` / `quietStartup` | 隐藏思考块 / 安静启动 |
| `showCacheMissNotices` | `true` | 缓存未命中提示 |
| `terminal` | `{"showTerminalProgress": true, "clearOnShrink": true}` | 终端区域进度条 |
| `defaultProjectTrust` | `"always"` | 不逐项目确认信任 |
| `theme` | `"light/dark"` | 跟随系统 |
| `defaultModel` / `defaultProvider` | `"1"` / `"1"` | 本地代理（模型名就是 `1`） |

> `lastChangelogVersion: "1.1.0"`、`collapseChangelog: true`、`treeFilterMode: "default"` 是宿主自维护的，不要手改。
> 改完 `settings.json` 一律 **`/reload`**（本会话不重启）——但注意：**会话中途改 `packages`/`extensions` 会改变已开扩展的加载面**，顺序是先改配置再开新会话（§9.6 教训）。

### 3.12 ~~`pi-caveman`~~（**已卸载 2026-10-12**，能力并入 `pix-optimizer`，见 §3.15）

原输出压缩层，三模式 `caveman` / `ultracave` / `megacave`。两个落盘点 `%APPDATA%\caveman\config.json` 与会话 flag `~/.pi/.caveman-active` **已随卸载删除**。等级语义也在新包里换了名字：现在是 `lite|full|ultra|micro`，不再有 `caveman|ultracave|megacave`。

### 3.13 ~~`pi-ponytail`~~（**已卸载 2026-10-12**，能力并入 `pix-optimizer`，见 §3.15）

原懒扩展打法层，自带 5 个 skill（`ponytail` / `-review` / `-audit` / `-debt` / `-help`）。落盘点 `~/.config/ponytail/config.json` **已删**。新包同名档位 `lite|full|ultra`，但**不再有 skill**，规则是 system prompt 片段。

### 3.14 ~~`pi-rtk`~~（**已卸载 2026-10-12**，能力并入 `pix-optimizer`，见 §3.15）

**两者机制不同，别照搬旧结论**：本包是纯 JS 的「拦 `tool_result` 过滤内容」实现（`~/.pi/agent/rtk-config.json` + `rtk_configure` 工具 + `/rtk-*` 一堆命令），**不依赖 `rtk` 二进制**；`pix-optimizer` 的 RTK 是「注入 prompt + 改写 bash 命令加 `rtk` 前缀」，**用官方 Rust 二进制**。所以「源码去注释导致 `edit` 报 old text 不匹配」「`/rtk-what` 看开关」「`rtk_configure` 应急」那一整套连同它的问题**全部随卸载消失**。仓库 `config/agent/rtk-config.json`（已 `git rm`）与 `~/.pi/agent/rtk-config.json` 均已删（§2.4 纪律）。

### 3.15 `@xynogen/pix-optimizer`：压缩三合一，本机三档全 ultra（2026-10-12）

**本机生产配置**：`~/.pi/agent/pix.json`（**新建文件**，本机此前无）

```json
{
  "optimizer": {
    "caveman": "ultra",
    "rtk": "on",
    "ponytail": "ultra"
  }
}
```

- **一个包顶三个**：上游把 `pi-caveman` 与 `pi-rtk-optimizer`、`ponytail` 规则合成一个扩展（README 自述是 rewritten、非 copy，全 MIT）。一个 `/optimizer` 面板管三档，状态只存 `pix.json` 的 `optimizer` 段 —— `persist.ts` 走 `@xynogen/pix-runtime/config` 的 `updateConfig()`；老版 `optimizer.json` sidecar 会被导入一次后**永不再写**（避免两个真相源互相覆盖）。
- **不注册任何工具**。`/optimizer` **只有交互面板**（←→ 循环改值、↑↓ 移动、esc 关），**没有文本参数形** —— `/optimizer ultra` 这类写法不成立，要切档就开面板；headless 下打印纯文本状态。状态栏一格同时显示 `Cv` / `Rk` / `Pt`，启用=accent、禁用=dim；字形跟全局 `pix-pretty` 模式（`nerd` 默认，无 Nerd Font 就 `/pix` 切 `unicode`/`ascii`，或设 `PRETTY_ICONS`）。
- **档位与默认值**（源码 `pix-runtime/src/sections/optimizer.ts`）：caveman `off|lite|full|ultra|micro` 默认 `off`、ponytail `off|lite|full|ultra` 默认 `off`、rtk `off|on` 默认 `on`。非法值被 section 解析器夹回默认，**不是**报错。**本机三档全开**。
- **caveman 语义与旧包不同**：现在是 [ASD-STE100](https://asd-ste100.org) 两层 —— L1 定词与句（must/only/there is…），L2 定回复形状（下一动作先说、编号步骤、无前言无收尾），**且刻意保留冠词**。所以旧 `ultracave` 的碎句腔不再是它，L3 `micro` 是实验性的 prompt 极简化。
- **ponytail 同理**：只管「**写什么**」——YAGNI 阶梯（该不该存在 → stdlib → 原生平台 → 已装依赖 → 一行 → 最小可用），**验证、错误处理、安全、可访问性永不裁**。与 caveman 正交，一个管写法一个管做法。
- **RTK 两层自动生效**：① prompt 层注入 RTK 规则（叫模型自己给命令加前缀）；② 执行层**改写 `bash` 调用**，给已知首词（`git` `gh` `cargo` `npm` `pnpm` `docker` `kubectl` `ls` `grep` …）加 `rtk` 前缀。**命令链按 `&&` `||` `;` `|` 拆开后逐段加前缀**：`git add . && git push` → `rtk git add . && rtk git push`；引号内的运算符不算，解析不了就原样放行。**`rtk` 二进制缺失时绝不改写**。
- **二进制来源**：查找顺序 `binary.json` → `~/.pi/agent/bin` → `PATH`（`@xynogen/pix-runtime` 的 Binaries）。RTK 开着且找不到时，**pi 首次加载会从 `rtk-ai/rtk` 下最新 release 到 `~/.pi/agent/bin`**，用 release 自带的 `checksums.txt` 校验，footer 打一行版本与来源，**不阻塞启动也不阻塞工具调用**。跳过条件：设了 `PI_OFFLINE` / `/optimizer` 里 RTK 关 / `binary.json` 指的路径不存在。`binary.json` 钉了路径时，改写用的就是那个带引号的路径。
报 TLS 握手失败（证书链问题，见 §8 排障表），直接绕开
- **对前缀缓存的影响**：caveman / ponytail 都往 system prompt 注入规则文本，**切档 = 换一次前缀文本 = 下一轮 `cacheRead` 归 0**（原理同 §2.2 prefix-stabilizer、§7.17）。**定下来就别反复切。**
- **rtk 自己的配置在 `%APPDATA%/rtk/config.toml`**（默认不存在，`rtk config --create` 生成）：`[hooks] suppress_hook_warning = true` 关掉每条 bash 前缀的 `[rtk] /!\ No hook installed` 噪音。**别手写半截小节**——rtk 反序列化缺字段即报 `missing field`，见 §7.24。
- **卸载**：`pi remove npm:@xynogen/pix-optimizer`，再删 `pix.json` 的 `optimizer` 段（§2.4 纪律）。

### 3.16 ~~`pi-smart-reader`~~（**已卸载 2026-10-14**；下面的钉版配置一并作废）

**卸载理由**：唯一能用的 `smart_read` 只支持 TS/JS（只带一份 `tree-sitter-typescript.wasm`），而本机长文任务以 md/配置为主——大 md 走 `md_inspect` + 段落 `read`，源码用 `rg` 定位后按需读，`smart_read` 覆盖不到；passive mode 又是死代码（§7.23）。**留着只是每次安装都要维护 `web-tree-sitter` 钉版**（2026-10-13 → 2026-10-14 共 1 天，净亏）。若日后 TS 大文件确实读不动再装回来，配 `web-tree-sitter@0.24.7` 钉版。

~~`pi-smart-reader` 声明的依赖是 `"web-tree-sitter": "latest"`。0.25 起上游改成**只有具名导出**

```
[pi-smart-reader] Initialization failed: TypeError: _webTreeSitter.default.init is not a function
[pi-smart-reader] Failed to initialize parser. Passive mode disabled.
```

**0.24.7 是最后一个有默认导出的版本**，且实测能吃下它自带的 `wasm/tree-sitter-typescript.wasm`（0.25+ 的 API 能吃、0.24.7 也能吃，grammar ABI 没问题）。修法写进 `~/.pi/agent/npm/package.json` 的 `overrides`（这样 `pi update --extensions` 也带着）：

```json
"overrides": {
  "pi-smart-reader":   { "web-tree-sitter": "0.24.7" },
  "pi-impact-analyzer": { "web-tree-sitter": "0.24.7" }
}
```

生效要三步，**少一步都是 "invalid" 空转**（npm 对已存在的 override 目标不会自己重新解析）：

```bash
cd ~/.pi/agent/npm
# ① 剪掉 lockfile 里这两个条目，否则 npm 报 "up to date"
node -e "const fs=require('fs'),f='./package-lock.json',l=JSON.parse(fs.readFileSync(f,'utf8'));
for(const k of Object.keys(l.packages)) if(/web-tree-sitter\$/.test(k)) delete l.packages[k];
fs.writeFileSync(f,JSON.stringify(l,null,2))"
# ② 删掉盘上的旧副本
rm -rf node_modules/web-tree-sitter node_modules/pi-smart-reader/node_modules/web-tree-sitter node_modules/pi-impact-analyzer/node_modules/web-tree-sitter
# ③ 重装（这棵树必须 --legacy-peer-deps，理由同 §7.11）
npm install --legacy-peer-deps
npm ls web-tree-sitter   # 应为 0.24.7 deduped，无 invalid
```

验收：`pi --no-session -p "reply with: ok"` 输出里**没有** `[pi-smart-reader] Initialization failed`；再让agent 跑一次 `smart_read`（`mode: skeleton`）能返回签名。

> **钉了也不等于它有用**：passive mode 在本机是死代码，详见 §7.23。装它的唯一收益是 `smart_read` 这个工具。

---

## 4. 工具归属（谁注册了什么）

| 扩展 | 工具 |
|---|---|
| 内建 pi | `read` `write` `bash` `powershell` `edit` `grep` `find` `ls`（受 `defaultTools` 闸门控制） |
| `pi-fd`（本地 `extensions/pi-fd.ts`） | `fd`（能力上取代 pi-find 的 `find`，见 §4.1；本机懒加载） |
| `@aboutlo/pi-smart-edit` | `edit`（覆盖内建），匹配走「精确 → NFKC 归一化行」，容忍引号/空白差异 |
| `pi-dsh-pet` | 无工具（`/pet` `/pet-stop`；HTTP+WS 服务只把 agent 事件转发给 Electron） |
| `pi-pet-autostart`（本地 `extensions/pi-pet-autostart.ts`） | 无工具（`session_start` 钩子 + `/pet-auto` 命令） |

| ~~`pi-smart-reader`~~（2026-10-14 卸） | ~~`smart_read`~~（骨架/符号抽取，见 §3.16 / §7.23） |
| ~~`pi-mono-context-guard`~~（2026-11-04 卸） | ~~无工具（拦截钩子 + 命令）~~，见 §7.28 |
| `pi-meter` | 1 个工具 + 预算命令 |

| `pi-lazy-tools`（fork） | `omnify`（0.4.0 起四合一；`load_tools`/`call_tool` 已撤。只代理执行、**不切 active 集**） |
| `pi-prefix-stabilizer` / `pi-cache-guardian` | 无工具（纯事件钩子） |
| `@xynogen/pix-optimizer` | 无工具（纯事件钩子 + `/optimizer` **交互面板**；RTK 改写挂在 bash 工具调用上，见 §3.15） |



**一道闸：`defaultTools`**（0.4.0 前是「`defaultTools` 管注册 + `resident` 管常驻」两道，0.4.0 起合并）：

| 工具 | 在 `defaultTools` 里？ | 后果 |
|---|---|---|
| `read` `write` `edit` `bash` | ✅ 在列 | 纯内建：不在列就不注册；本机就到这四个为止 |
| `grep` `find` | ❌ 未列 → 懒加载 | 2026-11-04 晚 `pi-find` 卸后**回到内建实现**；`omnify` 可搜出并执行 |
| `fd` | ❌ 未列 → 懒加载 | 本地 `pi-fd` 注册，同上 |
| `ls` `powershell` | ❌ 未列 → 懒加载 | 需要时 `omnify` 按名 load 回来（或用 `bash ls`） |
| （原 `todo` / `md_*` / `ask_question` / `mcp`） | ❌ | **2026-11-04 晚起这四个工具的扩展均已卸**（§7.32），本机不再有它们 |
| `omnify` | ❌ 写不写都一样 | pi 核心无条件注册，**不需进名单**，写进去只是读起来清楚 |

漏了的后果（实测）：`defaultTools` 是内建工具的**注册闸**（不在列 → 根本注册），对扩展工具则是**常驻名单**（不在列 → 注册了但被 lazy 隐藏，wire 上看不到；要它时 `omnify` 一步拾回）。

### 4.1 `find` → `fd`（本仓库 `extensions/pi-fd.ts`）

`@tian.zuo/pi-find` 的 `find` **底层本来就是 fd**（`lib/tools.ts` 里 exec `fd`），但只开了 glob 模式的一层薄壳：`pattern` + `path` 两个参数。于是这些都做不到，而它们在 fd 里都是一行参数：

| 需求 | `find`（旧） | `fd`（现） |
|---|---|---|
| 列出全部 `.ts` | 必须编个 glob | `{type:"file", extension:"ts"}`（**pattern 可省略**） |
| 最近改过的 | 做不到 | `{changedWithin:"1d"}` |
| 区分文件/目录/可执行文件 | 做不到 | `{type:"directory"}` 等 |
| 正则匹配路径 | 做不到（只有 glob） | pattern 即正则，且 smart case |
| 限深度 | 做不到 | `{maxDepth:2}` |

**接线**：`fd` 不写进 `defaultTools`（与 `grep` 一样走懒加载，需要时 `omnify` 一步激活）；项目级与用户级两处都只保留内建默认 4 个。~~`pi-find` 仍在装（提供 `grep`），它的 `find` 作为 `fd` 的 glob 版兜底~~ —— **2026-11-04 晚 `pi-find` 已卸（§7.32）**，`grep`/`find` 回到内建，`fd` 只与本机扩展共存。

**超时参数（2026-10-09 加，§5 铁律二）**：`fd` 多一个 `timeoutMs`，默认 30s、硬上限 120s（`resolveTimeoutMs()` 夹取，非法值回落默认）；schema 的 `minimum`/`maximum`、参数描述、`promptGuidelines` 三处都写了「必须显式传」。超时按部分结果处理（kill + 附 `[Search timed out …]` 提示），不静默截断。上游 pi-find 的 `find`/`grep` 是写死 30s，所以三家口径一致。

**常驻 vs 懒加载的代价（实测）**：`fd` 若常驻，单它就 1280B + system 多一行简介与 guideline；若懒加载，0 upfront。**本机选懒加载**（`fd` 与 `grep` 都不在名单里），见 §3.4 / §6.3。

**fd 的两个反直觉点（已踩，代码里有注释）**：

1. **省略 pattern 时必须显式传空串**。否则唯一的 position 会被 fd 当成 pattern（`fd -t d .git` 返回空，`fd -t d "" .git` 才出结果）——「列出全部」是这个工具的主卖点。
2. **`--glob` 是「把 pattern 换成 glob」，不是额外过滤器**。glob 模式下再传位置 pattern 会被 fd 当成第二个搜索路径（报 `Search path 'capture' is not a directory`）。故工具里 `glob` 与 `pattern` 互斥。

**默认排除编译目录（2026-10-10 加）**：`node_modules dist build out target coverage __pycache__ vendor venv Pods DerivedData bower_components cmake-build-debug cmake-build-release`。
起因：fd 默认只做两件事（尊重 `.gitignore`、跳 hidden），而这两条**盖不住编译目录**——它们既不是 hidden，也常常不在 `.gitignore` 里（本仓库的 `.gitignore` 就只写了 `.sc-test/` `.zvec-grep/` `.pi/`），于是照样一层层往下爬。
**实测 28 → 12 条**。新增 `exclude`（追加）与 `noDefaultExcludes`（整体关闭）。
> **正确性保证（已实测）**：`--exclude` **只剪枝遍历、不剪搜索根**——`{path:"dist"}` 仍能搜出 `dist/static/s.css`。所以「进 dist 里找文件」这种正当需求不会被误伤；真要按名字找编译目录本身、或彻底关掉，用 `noDefaultExcludes`。
> **只列非 hidden**：`.next/.nuxt/.venv/.turbo` 这些 fd 本就跳（除非 `hidden:true`），列进来是冗余。

**另建 fd 全局 ignore 文件 `%APPDATA%\fd\ignore`**（`~/.config/fd/ignore` 是 POSIX 写法），内容与上表一致。好处：手工敲的 `fd`、以及 `~/.bashrc` 里 `alias find='fd'` 的交互式 shell 都自动生效，不依赖本扩展。
> ⚠️ 但它**只在 fd 被调用时生效**，且同样**只在 git 仓库内认 `.gitignore`**——家目录 / `C:\Windows` 下依旧无效（这类根已不再硬拦，见 §4.2 末）。

**验证**：`/fd-check`（fd 可执行文件解析）。回归：`.sc-test/probe-fd.mjs`。回退：删 `extensions/pi-fd.ts` 再 `/reload`（`fd` 懒加载与否都不影响其余工具）。

---

### 4.2 ~~全局禁用 `find`~~（**已卸载 2026-10-08**：本机恢复 `find`，4 层封锁全撤；卸载记录见 §7.9，以下为历史留档，勿再照着启用）

> **2026-11-03 更新**：本节四层封锁仍卸着；`find`/`grep` 不再拦截/不全局指向，仅提示词限制优先 fd/rg。口径见 §5 第三类。

**为什么要禁**（⚠️ 下方第一条已被 2026-10-10 实测推翻，保留原文以备查）：本机 `find` 有两个不同的东西，症状都是「卡死」：
- ~~`C:\Windows\System32\find.exe`（cmd/PowerShell 里的 FIND.EXE）：语法与 GNU find 完全不同，`find . -name x` 被当成「pattern + 无文件名」→ **从 stdin 读**，表现就是永远不返回；~~
  > **2026-10-10 实测纠正：本机这条不成立。** PowerShell 的 PATH 顺序是 `C:\Program Files\Git\usr\bin` **排在** `C:\Windows\system32` **前面**，
  > 所以 `powershell` 里的 `find` 解析到的是 **Git 的 GNU find**（`Get-Command find` 实测 `Source = C:\Program Files\Git\usr\bin\find.exe`）。
  > 裸 `find` 实测立即返回（打印 490 行），**不挂 stdin**。真正的真凶是另一个东西——见下方「几小时的真凶」。
- Git Bash 的 `/usr/bin/find`：语法对，但没有 ignore/类型/深度过滤，在大目录树上能跑几分钟（`find .` 从家目录起步就够呛）。

**⚠️ 几小时的真凶（2026-10-10 定位，与上面的猜测不同）**：不是「System32 find 读 stdin」，而是
**`powershell` 工具没有 `timeout` 参数**（§5 表里已记「注入不了」）。裸 `find` = `find .` = 从当前目录
**递归打印整棵树**，无任何剪枝；放到大仓 / 家目录 / 系统盘就是几小时。bash 侧没这问题——守卫会把
`find`/`find.exe` 归入搜索档、30s 默认超时（实测 `judgeBashCommand("find.exe . -maxdepth 6") → 30`）。
**换 fd 也不会自动好**：见 §4.1 尾注——fd 的 ignore 规则在非 git 目录同样失效。**2026-10-13 已撤「按搜索根硬拦」的规则 E**（误伤远多于收益：`cd <项目> && find .` 里 `cd` 的实参被当成搜索根）；**2026-11-01 换成按命令名拦回来**（只认流水线首段首词，管道消费位与 `git grep` 不拦）；**2026-11-03 取消拦截/全局指向**，仅提示词限制优先 fd/rg——见 §5 第三类。30s 超时兜底照旧。

**四层封锁**（前两层管模型，后两层管你自己）：

| 层 | 位置 | 覆盖 | 实测 |
|---|---|---|---|
管道后 `\| find`）
| bash（全局） | 用户环境变量 `BASH_ENV=C:\Users\yinxuehao\bin\no-find.sh`（非交互 `bash -c`）+ `~/.bashrc` 同款函数（交互） | 任何 bash，包括脚本 | `find` → 拒答 + exit 127；`fd` 正常 |
| cmd（交互） | `HKCU\...\Command Processor\AutoRun` 里的 doskey 宏 | 交互式 cmd 提示符 | doskey 宏**只在交互命令行展开**，`cmd /c` 不受影响 |
| PowerShell（交互） | `Documents\WindowsPowerShell\Microsoft.PowerShell_profile.ps1` 里的 `function find` | 交互式 PowerShell | **本机没生效**：执行策略全是 `Undefined`（= 默认 `Restricted`），profile 根本不加载；要生效得 `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned`（安全策略变更，**没擅自改**） |

> `find.cmd`（`~/bin/find.cmd`）也备好了，但**默认盖不住 System32**：Windows 合并 PATH 是「机器 PATH 在前、用户 PATH 在后」，`~/bin` 在用户 PATH 里 → 只有当 `~/bin` 被排到 System32 之前（改机器 PATH，需管理员）才生效。要真在 `cmd /c` 里也拦，只能动机器 PATH 或改 System32 文件，**都没做**。

**判定规则**（`detectFindCommand`，可单测）：按 `;` `|` `&&` `||` 换行切段，递归摊开 `$( )` 与反引号，再剥掉 `sudo` / `env FOO=1` / `xargs` / `nohup` / 前置重定向，看每段**首词的 basename** 是否等于 `find` / `find.exe`。所以 `./find-helper.sh`、`findings.md`、`grep -rn "find me"`、`node scripts/find-them.js`、`fd`、`fdfind` 一律放行。

**开关**：`~/.pi/agent/extensions/no-find.json` → `{"enabled": false}` 整体停用；`{"allow": ["find -name *.go"]}` 按「首词 + 第二个词」前缀放行个别命令。配置坏了按「启用」处理（宁可多拦，不静默失效）。

~~**回退**…~~（已于 2026-10-08 执行：pi 内那层删扩展文件；全局那层按备份还原 `PATH` / `BASH_ENV`，见 §7.9）

**现状（2026-10-09，替代封锁的轻量做法）**：不再拦 `find`，改为 `~/.bashrc` 末尾一行 `alias find='fd'`——交互式 Git Bash 里 `find` 直接走 fd（尊重 `.gitignore`、默认排除 `.git`/`node_modules`，大目录树上快一个量级）。fd 用 pi 自带的 `C:\Users\yinxuehao\.pi\agent\bin\fd`（10.3.0），零安装。真 find 仍可 `/usr/bin/find` 调用；**脚本/CI 不受 alias 影响**（alias 只在交互 shell 展开），要快就在脚本里显式写 `fd`。非交互场景的慢 find 依旧存在——优化靠 `-maxdepth` / `-prune` / `-xdev`（见对话记录），不做全局封锁。

---

## 5. 使用纪律

**铁律：装机前先审「它运行时会不会动 active 工具集」。** 只要扩展在会话中途调 `pi.setActiveTools`（典型是 `pi-web-access` 的 `web_enable` 这类空参激活器），工具集一变，请求前缀从第 0 个 token 起整段作废——本机实测 `cacheRead` 从 86016 掉到 1152，等于每次首次激活都吃一发全量 prefill（§7.4）。所以只接受两种接入方式：① 常驻进 `defaultTools`（前缀恒定）；② 懒加载由 `omnify` 代理执行（只在 `session_start` 隐藏一次，全程不切 active 集，§7.4 尾注）。
- **凡「运行时增删工具」的扩展一律不装、不启用、不写进 `defaultTools`**——哪怕它的工具本身很有用（要联网搜就换 `agent_browser*` / `mcp` / `bash`，别为它掀缓存）。
- 审法：`read` 扩展源码搜 `setActiveTools` / `activeTools`；装完对比首请求的工具字节（口径见 §6），不一致就是它在散缓存。

**铁律二：所有命令都带超时**（2026-10-09 加，防止一条命令把会话卡几分钟）。

pi 内建 `bash` 工具的 `timeout` 参数是**可选且无默认值**，不传就是永远跑。本机用 `extensions/pi-bash-guard.ts`（只挂 `tool_call`，不注册工具）把它变成强制：按命令分档注入上限。

| 档 | 命中什么 | 默认 | 上限 |
|---|---|---|---|
| 搜索 | `find` `grep` `egrep` `fgrep` `rg` `ag` `ack` `fd` `fdfind`（按**流水线生产者**判，`find … \| head` 算搜索、`python x.py \| grep` 不算） | 30s | 120s |
| 构建 | `npm` `pnpm` `yarn` `pip` `cargo` `go` `make` `cmake` `docker` `tsc` `pytest` `jest` … 共约 70 个首词 | 1800s | 3600s |
| 其余 | 兜底一切（`ls` `cat` `git clone` `python x.py` …） | 300s | 3600s |

- **注入的是上限不是等待时间**，所以给大不亏；混合命令取最宽松那档（`npm run build && find dist -type f` → 1800s）。
- 模型自己显式传的 `timeout` 会被尊重，只夹到该档上限（`timeout: 600` 的 `find` → 120；`timeout: 7200` 的 `npm ci` → 3600）。**单位是秒**。
- 整条都被 coreutils `timeout` 包住时守卫不插手（作者自己管了）。要包就写 `timeout -k 2s 30s …`：只 TERM 直接子进程，不 `-k` 可能被抗住，且绕开 pi 的 killProcessTree。
- 搜索类被后台化（`&` / `nohup` / `setsid`）→ **block**：它本该秒回，却能活过超时（见下表最后一行）。

**另一类不是「太久」而是「永远不返回」→ 直接 block**（给 timeout 也只是白等一个上限，期间零输出）：
编辑器（`vim` `nano` `emacs`…）、分页器/监视器（`less` `top` `watch` `tail -f` `journalctl -f`…）、交互客户端（`ssh` `mysql` `psql` `sqlite3`…）、光杆 REPL（`python` / `node` 不带参数）、前台服务（`npm run dev|start|serve|preview`、`python -m http.server`、不带 `-d`/`--rm` 的 `docker run`）。
替代写法：把有产出的部分放前台跑（先 build/test，再查结果）；真需要常驻进程就显式 `… &` 起来、之后用另一条命令轮询。

**第三类：`find`/`grep` 当搜索生产者 → 自动改写成 `fd`/`rg`（`extensions/no-find.ts`，2026-11-04）**。
纯文字纪律（`promptGuidelines` + AGENTS.md）实测拦不住：模型照样写 `find . -name x`。

以前是 block（`LEGACY_SEARCH_BINARIES`，2026-11-01 恢复，2026-11-03 取消），现在是**转译而不是拒答**：`tool_call` 钩子改 `input.command`，find 能翻译的参数映射到 fd，翻不了的**整条原样保留**（让 find 自己报错，不静默猜）。

| 点 | 现在的行为 |
|---|---|
| 改什么 | 每条**流水线首段**的首词（引号感知切段，`\;` 不算分隔符）是 `find` `grep` `egrep` `fgrep` 之一 |
| find → fd | `-name/-iname` → `-g`（`-iname` 加 `-i`）、`-type f/d/l` → `-t`、`-maxdepth` → `-d`、`-mindepth` → `--min-depth`、`-newer` → `--changed-after`、`-print0` → `-0`、`-exec CMD … \;` → `-x CMD`（`{}` 只在末尾时）；位置参数作 path。不认的 flag → 不转 |
| grep → rg | 去掉 `-r/-R/-d/-E/-G`（rg 默认递归、默认扩展正则；`rg -E` 是 encoding 会冲突），组合参数 `-rn` → `-n`，`--include=G` → `-g G`，`--exclude=G` → `-g !G`；其余同名透传 |
| 不改什么 | 管道消费位（`ls -la` 的输出交给 `grep foo`）、`git grep`（首词是 git）、`./find-helper.sh`、`findings.md`、`fd` / `fdfind` / `rg` / `ag` / `ack` |
| 看不看搜索根 | **不看**，只认命令名。根选错交给 `fd` 的 `path` 参数与 §4.1 的超时兜底处理 |
| 出口 | 翻译不了的 find flag 原样保留（不再 block），要 GNU 独占 flag 就自己用 `/usr/bin/find` |
| 拦截 | 无 path 的 `find`，或递归 `grep` 无 file → block（避免整盘/整树扫描）；切段额外处理 `&` / `\|&` |

回归：`.sc-test/probe-no-find.mjs`（`node --experimental-strip-types`，25 例 + 7 条 broad-scan）。回退：删 `extensions/no-find.ts` + 删 `~/.pi/agent/extensions/` 同名副本 + `/reload`。

> 旧版的**量级证据仍然成立**（AppData/Local 194,968 文件、系统盘 345,409 文件 / fd 16.2s、
> `find ~ -maxdepth 6` 60s 跑不完；fd 的 `.gitignore` 规则在非仓库目录同样失效），只是**执法点从
> 「搜索根」挪到了「命令名」**：根选错交给 `fd` 的 `path` 参数与 §4.1 的超时兜底处理，不靠名字之外的判断。

配套实验（§4.1 尾注）证明了另一件事：**`-maxdepth` 不但没加速，还会让 find 答错**。node_modules 嵌 12 层的树上，`find . -maxdepth 6 -name '*.ts'` 返回 **0 条**（深度全花在爬 node_modules），`fd -t f -e ts .` 返回 **50 条**——所以「用 maxdepth 治慢」是饮鸩止渴。

**超时之后命令真的结束了吗（这一层的机制，2026-10-09 实测源码）**：

| 问题 | 答案 |
|---|---|
| pi 超时后会不会 kill？ | 会。`dist/core/tools/bash.js` 在 `timeout` 到点 / `signal` abort 时都调 `killProcessTree(pid)` |
| 杀的范围？ | Windows：`System32/taskkill.exe /F /T /PID`（整棵子进程树，强杀）；POSIX：`kill(-pid, "SIGKILL")`（bash 是 `detached` 的进程组，整组） |
| 默认有超时吗？ | **没有**。`timeout: Type.Optional(... "optional, no default timeout")`——这就是守卫存在的全部理由 |
| 什么会逃掉 kill？ | 只有 `cmd &` / `nohup` / `setsid`：shell 立即返回 → pi 清掉 timeout 计时器并注销 pid 追踪，命令在工具返回后继续跑，没人再管。故搜索类这么写直接 block |
| `fd` 工具超时？ | 自己的 `execFile({timeout})`，无子进程所以 kill 即干净；漏传 `timeoutMs` 时守卫会补 30_000 |
| `powershell` 工具超时？ | **无此参数**，注入不了。里面的 `find` 实测是 Git 的 GNU find（§4.2 纠正），不是 System32 那个读 stdin 的 → **唯一的治法是别裸跑 `find`**，硬约束只能靠文字纪律 |

搜文件的其余三条路（与超时无关，但同一节纪律）：`fd` 工具每次显式传 `timeoutMs`（毫秒，1s–120s，默认 30s，见 §4.1）；`find`/`grep` **2026-11-04 晚起回到内建实现**（`pi-find` 已卸，§7.32），没有 30s 硬超时，**必须自己缩范围**（`path`/`glob`，必要时 `-maxdepth`）；大目录树先 `-maxdepth`/`-prune`/`-xdev`，别裸跑整盘。

回归用例在 `.sc-test/probe-bash-guard.mjs`（**不入库**，`node .sc-test/probe-bash-guard.mjs` 直接跑）：三档默认值与上限、显式值夹取、管道生产者、`sudo`/`&&`/重定向、自带 timeout、永不返回的 block、`docker run --rm` 不误伤，以及规则 E 的正反两组——后台化搜索拦，`git grep` / `./find-helper.sh` / `findings.md` / `awk` / `git status` / 管道消费位的 `grep` 不误伤。


0. **新装扩展一律不进常驻集**（硬规则）
   - 理由：常驻集每轮都进 prompt（`grep`+`find` 就要 +1350B ≈ 350 tok），而多数扩展一天用不到几次。
   - **只有这三类才加常驻**：① 高频工具（见 §6.3 的取舍）；② 覆盖内建工具的（`grep`/`find`/`edit` 需先过 `defaultTools` 闸）；③ 缺失后 agent 会“瘫”的（如 `bash`）。
   - 例外：无。`grep` / `fd` 也只是「需要时 `omnify` 激活」，不进名单（§6.3）。
- 验证新装扩展是否真的零开销：看首请求的工具字节是否与基线一致（口径见 §6）。
1. **首字成本**：常驻集每轮都进 prompt；不在名单的工具靠 `omnify` 检索命中后**代理执行**（不把 schema 注入 active 集，见上面铁律）。
2. **激活往返**：0.86+ 流程是 `omnify`/`load_tools` → `call_tool` → 执行，多 1–2 个模型轮次。搜索类工具建议常驻（见 §6.3）。
3. **大输出工具**（`agent_browser*`，或 bash 直接抓页面）原始 HTML/JSON 全量进历史，会把前缀命中率打崩；用前先想清楚要不要落历史。`mcp` 工具已于 2026-11-04 晚随 `pi-mcp-adapter` 卸载（§7.32）。
4. **改 `.md` 优先用 `edit` 精确替换**：`md_edit` 已于 2026-11-04 晚随 `pi-mdiff` 卸载（§7.32）。现状是散文/列表/代码块一律用 `pi-smart-edit` 的 `edit`（容忍引号/空白差异），改动尽量带足上下文行以锚定位置。
~~`pi-deepseek-cache`（绑定 DeepSeek）~~ **2026-10-09 已卸**（§7.13）：实测遥测半边可用、压缩半边必败（接管条件 `ctx.modelRegistry.find("deepseek", …)` 在本机注册表里根本没有 deepseek provider，代理也拒 `deepseek-flash` 这个模型 ID），按 DeepSeek 价格表换算的「省钱估算」属虚构。**要压缩缓存就装 `pi-cache-compact`**（provider 无关，§7.13 实测命中 68.6%）。
6. **纯 UI 类扩展可以放心装**：`pi-tps` / `pi-one-ui` / `pi-dsh-pet` / `pi-pet-autostart` 这类只挂事件钩子、只注册命令的扩展，**不注册任何工具**，不进 `defaultTools`，wire 字节不变（§3.6 有 bench 实测：装宠物前后都是 5664B）。反过来，任何**注册工具**的扩展都要重新算 §6.3 那笔账。
**全局规则：本机不发任何提示词层规则（2026-11-04 定案）**

`~/.pi/agent/AGENTS.md` 与仓库 `config/agent/AGENTS.md` **都是 0B**（`07f27cf` 2026-11-04 11:33 清空）。**定案：不再恢复**——命令怎么写、文件怎么读，交给模型自己按当下的报错与上下文判断，不靠一段常驻 system 前缀去求它照做。

| 曾经的规则块 | 现在的替代 |
|---|---|
| Think: minimal sufficient reasoning… | 交给模型自己；pix-optimizer 的 caveman 管输出形状（§3.15） |
| Read files: no full reads by default… | 交给模型自己；常驻工具只留 `read edit write bash`（§3.4），长文件整读的代价由上下文窗口自己反馈 |
| Search: 优先 fd/rg | 已经**机器强制**：`extensions/no-find.ts` 在 `tool_call` 上把 `find`/`grep` 转成 `fd`/`rg`（§5），比求模型有效 |

- **canonical 是本仓库 `config/agent/AGENTS.md`，内容 0B**：`node install-project-config.mjs` 仍会把它拷进 `~/.pi/agent/AGENTS.md`，`--check` 比对 0B ↔ 0B。想重新加规则就写这个文件，别手改盘上那份。
- 它进的是**每轮 system 前缀**，所以**空文件本身就是收益**：system 少一段 = 每轮省 token，且少一个会漂的前缀源（原理同 §2.2 / §7.17）。
- 与扩展注入的规则是叠加关系、互不覆盖：现在 system 里只剩 pix-optimizer 的 caveman/ponytail 档位规则（§3.15）。


---

## 6. 首字 token 优化（全部 wire 实测）

测量方式：沙箱（`PI_CODING_AGENT_DIR` 隔离 + junction 复用 npm/git/skills）+ mock OpenAI provider 抓**真实首请求字节**，再用真网关取 token 计数交叉验证。校准：**1 token ≈ 3.85B**。

### 6.1 手册「三步优化」在 0.87.1 上的真实收益

| 场景 | system | tools | 合计 | vs 基线 |
|---|---|---|---|---|
| 基线（5 工具） | 6758B | 4593B | 11351B | — |
| 只上 `pi-lean-prompt` | 6758B | 3043B | 9801B | **−1550B** |
| 只上 `pi-shell`（**已删除**） | 6794B | 4713B | 11507B | **+156B**（反而变大） |
| 手册全套（lean + shell） | 6794B | 3163B | 9957B | **−1394B / −12.3%**（≈ −362 tok/请求） |

- **第一步（压 Guidelines / Pi documentation）是 no-op**：`pi-lean-prompt` 见 `sections` 存在就 return（0.86+ 让路）；且其正则找的是 0.85 版那两个独立段落，0.87 的提示词里已不存在。
- **第三步单独是负收益**：`bash` 543B → `shell` 663B。只在与第二步叠加后才净赚 → **结论：这一步不做**，`pi-shell.ts` 已删（2026-09-28 五次），改用内建 `bash`。
- **真正有效的是第二步**（`edit` 2030→646B、`read` 684→518B），且只改文字不动结构，零副作用。

### 6.2 大头在 system：`<docs>` + `<skills>` 压缩（`pi-lean-sections.ts`）

| 改动 | wire system |
|---|---|
| 基线 | 6897B |
| 压 `<skills>`（2655B → 99B，单行改用 omnify 检索） | 4255B |
| 压 `<docs>`（655B → 256B，从原文抽路径重排） | 5869B |
| **两者都压（本机现状）** | **3556B（−3341B / −48%）** |

> **本机现状（2026-09-30，卸载 `pi-web-access` 后重测）**：常驻集 = pi 内置默认 4 个（§3.4）→ wire 上 **5 个工具** `bash edit omnify read write`，system **3026B** + tools **2638B** = **5664B ≈ 1573 tok/请求**（vs 优化前 11351B ≈ 2948 tok，**累计 −5687B ≈ −1477 tok / −50%**）。`grep` / `fd` 仍注册，按需 `omnify` **代理执行**——omnify 走 jiti 直接执行、**不切 active 集**，所以不会像 `web_enable` 那样掀前缀缓存（§7.4）。

连续 3 轮字节完全一致（轮间稳定，不散前缀缓存）。

**踩过的坑，写在这里免得重蹈**：

- **`before_agent_start` 的 `sections` 只有第一个注册的 handler 改得动。** 实测：先注册的探针看到空对象且它的赋值进 wire；后注册的拿到的是**已填充的独立副本**，改它无效、`return { systemPrompt }` 也无效。`pi-lazy-tools` fork 正占着「第一个」的位置（packages 源先于用户目录加载），所以它写在 `sections` 里的压缩**从未生效**——这就是本机 system 长期 6.9KB 的根因。
- **`before_provider_request` 的 `payload` 是共享可变的**（system 消息就在 `payload.messages` 里，`{role:"system", content:"<整串>"}`），在 wire 上改与加载顺序无关 → 本扩展走这条路。
- **不要压 `<rules>`**：单改 rules 块时落位正确（6897→5536B），但一旦与 docs/skills 同时改，pi 会把 rules 正文挪进 agent 文件段、把工具一行式塞进 `<rules>`，条目与续行错配。基线本身也有块间重排（`<tools>`/`<rules>` 内容逐轮互换、工具一行式本来就混在 agent 段里），属 pi 侧不确定性，不去碰它。
- **不要压 `<tools>`**：那段由 pi 按当前 active 工具动态生成，压它就得自己重建工具表，容易与实际 active 集脱节。

### 6.3 搜索类工具常驻的代价

| 场景 | system | tools | 合计 | vs 同基线 |
|---|---|---|---|---|
| 手册全套 + 常驻 grep/find/ls | 6897B | 4988B（9 个） | 11885B | **+1928B ≈ +500 tok/请求** |
| 常驻 grep+find（`ls` 懒加载，内建 `bash`） | 3050B | 4336B（8 个） | 7386B | vs 本机 **+1722B ≈ +447 tok/请求** |
| 常驻 grep+fd | 3205B | 5112B（8 个） | 8317B | vs 本机 **+2653B ≈ +689 tok/请求** |
| **本机现状**（只留内建默认 4 个） | 3026B | 2638B（5 个） | 5664B | — |

单工具 wire 字节：`grep` 846B、`fd` 1280B、`ls` 472B（`find` 若常驻是 504B）。

- **常驻**：每请求 +473 tok（首请求全价，之后走 cacheRead，本机本地端点基本免费），换搜索工具**直接可调、0 额外往返**。
- **懒加载**：0 upfront；要用时多 1–2 个模型轮次，并把同样的字节永久注入历史。
- **本机取舍（最终：只留内建默认 4 个）**：`defaultTools` 就是 `read edit write bash`，`grep` / `fd` / `ls` / `find` 全部懒加载，搜文件先 `omnify` 一步代理执行。**省 2653B ≈ 689 tok/请求**，代价是每次搜索多 1–2 个往返轮次（本机本地端点，这些轮次几乎不花钱，只花时间）。
  - 曾经选过方案 B（`grep` + `fd` 都常驻，8317B）：那时判断「搜索是编码高频操作，省轮次比省字节值」；现按「只保留默认」收敛，**要回退就把 `"grep"` / `"fd"` 加回两处 `defaultTools` 即可**（+2653B）。
  - `fd` 的能力远胜内建 `find`（§4.1 五项），常驻与否只影响字节与往返，不影响能力。（`pi-find` 已于 2026-11-04 晚卸，§7.32。）

### 6.4 优化后的静态前缀总账

`system 3026B + tools 2638B = 5664B ≈ 1.5k tok/请求`，相比优化前 `6758 + 4593 = 11351B ≈ 2.9k tok`，**累计 −50%**。

> 2026-09-29 装 `pi-dsh-pet` + `pi-pet-autostart` 后重跑 bench：**仍是 3026B + 2984B = 6010B、6 个工具、`extension_error` 0**，字节没动（两者都不注册工具，见 §3.6）。2026-09-30 卸 `pi-web-access` 后复测：**3026B + 2638B = 5664B、5 个工具、`extension_error` 0**（§6.2）。

---

---

## 7. 删改记录

所有卸载/冲突/遗留/体检实录迁移至 [`CHANGELOG.md`](./CHANGELOG.md)（§7 全部 + §9 实录）。本 README 只保留安装清单与必做配置。

## 8. 体检与排障

本机的体检脚本**没有自动化的**，但有几个手跑的（都在仓库根或 `.sc-test/`，`.sc-test/` 属 gitignore、不入库）：

| 脚本 | 干什么 | 结果 |
|---|---|---|
| `node check-readme-tables.mjs` | 体检 readme 表格列数 | 一致 exit 0、不一致 exit 1 |
| `node sync-drama-skills.mjs check` | 本仓库 drama 技能镜像与全局安装是否漂移（更新用 `install`） | 无漂移 exit 0；有漂移列出差异文件 exit 1 |
| `node install-local-extensions.mjs --check` | 本地扩展副本与仓库是否逐字节一致 | 不一致会提示重拷 |
| `node fix-lazy-tools-notes.mjs --check` | DOCS_NOTE 路径补丁是否需要重打 | 基线已修好 exit 0 |
| `node fix-proper-lockfile-proxy.mjs --check` | proper-lockfile 补丁在位 | 一致 exit 0 |
| ~~`node fix-browser-native-compat.mjs`~~ / ~~`fix-subagent-check.mjs`~~ | 两脚本随 2026-11-04 九连卸删除（目标 `pi-agent-browser-native` / `@arhen/pi-core-subagent` 已卸，0 触发即删） | 重装对应包时从 git 历史找回，见 §7.29 |
| `node fix-pi-one-ui-theme.mjs --check` | pi-one-ui 内置主题里是否还有 pi 主题 schema 不认的 `colors` 键；npm 与 git 两份副本一起扫（§7.26） | 本机 2 份 git 副本合规 → `[skip]`/exit 0；`[待修补]` exit 1 时重跑不带 `--check` 即修；两份副本都不存在也 `[skip]` exit 0 |
| `node install-project-config.mjs --check` | `config/` 里的配置/小脚本与 pi 实际读取位置是否一致（行尾 CRLF/LF 归一后再比，不算漂移） | 一致 exit 0 |
| `.sc-test/check-ext-errors.mjs` | 扫会话里的 `extension_error` | 盘上还在，但 `.sc-test/` 是 gitignore、**不入库** → 当一次性探针用，别当长期工具（升级/清理会丢） |
| `.sc-test/probe-bash-guard.mjs` | bash-guard 回归用例（含规则 E 正反两组） | **不入库**；2026-11-01 按 §5 清单重写并跑通 |

改完 `/reload`，看 TUI 有无 `extension_error`；本地扩展与仓库是否漂移跑 `node install-local-extensions.mjs --check`；readme 表格列数跑 `node check-readme-tables.mjs`（编辑手滑插/漏一个 `|` 时靠它兜住）。

| 症状 | 原因 | 处置 |
|---|---|---|
| 扩展报 `Tool "x" conflicts with ...` | 两个扩展抢同一工具名 | 二选一卸载（见 §7.1） |
| 懒加载报 `Cannot find module` | lazy 执行层地基缺失（版本要与 pi 本体一致，别写死） | `npm i --prefix ~/.pi/agent @earendil-works/{pi-coding-agent,pi-tui,pi-ai}@$(pi --version \| grep -oE '[0-9]+\.[0-9]+\.[0-9]+')` |
| 工具调用不到、wire 上也没有 | 内建工具不在 `defaultTools`（不注册），扩展工具不在其中（被 lazy） | 改 `defaultTools`（§3.4），`/reload` |
| `fd` 报 “fd executable not found” | pi 自带副本与 PATH 都没有 fd | 跑 `/fd-check` 看解析结果；或 `npm i -g fd-find` |
| 会话/文件撤销 | `pi-edit-guard` / `pi-checkpoint` 均已卸载 | 文件级靠 git 或改前先 `read`；会话级 `/undo` 不再可用 |
| agent 没有 shell | `defaultTools` 里没有 `bash` | 写 `bash` 进两处 `defaultTools`（§3.4）；若 `extensions/pi-shell.ts` 被装回来，它会在 `session_start` 无条件隐藏 `bash` |
| 宠物没起来 / 凭空消失，`log.txt` 里每行都是 `窗客户端 0` | 窗进程活着但渲染进程崩了 = 僵窗；上游旧版 `needsRelaunch()` 只认「pid 死了」 | 上游已修（§7.25，`b4b779a`）；临时手动 `/pet-auto restart`；扩展那层 60s 后自己换 |
| 压缩后首轮命中低 | 正常现象 | 「命中 0」在本机是常态（内置压缩不走前缀续写，§7.13）；`pi-cache-compact` 已于 2026-11-04 卸（§7.29） |
| 压缩请求 `cacheRead: 0` | 内置压缩的前缀与活会话不续写，必然 0 | 正常（§7.13 实测）；要命中得重装 `pi-cache-compact` 并在刚聊完的会话里立刻 `/compact`（§3.3 已留档） |
| ~~`pi-warm-cache` 没反应~~ | 本地代理属未注册路由 | **已卸载**（2026-10-08 死安装，见 §7.12），此行留档 |
| 装/卸任何包时 npm 打 `EBADENGINE ... node >=24.21.0` | 本机 node 24.16.0 低于某个包声明的 engine | **可忽略**，纯警告。2026-11-04 卸 `pi-agent-browser-native` 后本机已无此警告（§7.29） |
| ~~pi-agent-browser-native 报 `buildSessionProjection is not a function`~~ | 扩展 2026-11-04 已卸 | 重装才可能复发：`pi update npm:pi-agent-browser-native`，补丁脚本在 git 历史（§7.29） |
| 开机 / `/reload` 弹 `[Theme conflicts] Invalid theme "…pi-one-ui\themes\cc-dark.json"`（`/colors/cwd: schema is false` 那四条），`/theme` 里找不到 cc-dark/cc-light | pi ≥1.0 主题 schema 转严格（`colors.additionalProperties=false`），而 pi-one-ui 0.9.1 把自家 `cwd`/`editorModel`/`editorBorder` 写进内置主题 → 整份主题被判非法。详见 §7.26 | `node fix-pi-one-ui-theme.mjs`（幂等，删那 3 个键）后 `/reload`；`pi update npm:pi-one-ui` 会冲掉，复发就重跑 |
| `omnify` 搜不到 `web_search` / 每轮前缀突然被掀 | `pi-web-access` 已于 2026-11-04 卸；重装若忘写 `toolActivation: "eager"` 就退回 `web_enable` 加载器 | 见 §7.29 / §3.7 留档；掀缓存的现场见 §7.4 表 |
| 跑完没通知 | 终端不支持（Terminal.app / Alacritty） | `pi-notify` 只覆盖 OSC 777/9/99 与 Windows Terminal；换终端，或改用 §1.2 桌宠看状态 |
| `/pet` 提示命令不存在 | 只 `npm i -g` 装过，pi 不扫全局 `node_modules` | `pi install git:github.com/BeYourDreams/pi-dsh-pet` → `/reload`（见 §3.6） |
| 宠物窗口不弹 | 首次要下 Electron ≈100MB；或自动启动被关了 | 看启动提示；`/pet-auto status` 看当前开关；`/pet small` 换小号试；关掉了就写回 `{"autostart": true}` |
| pi 整个进程崩，只留 `TypeError: Proxy handler's 'get' result … should be the same value as the target's property`（frame 指向 `proper-lockfile/lib/mtime-precision.js:6:29`） | proper-lockfile 把 mtime 精度缓存挂到 fs 对象上，而 jiti interop 把它包成了 Proxy；同进程第二次加锁即触发 JSC 不变量（原来多由 subagent 跑着跑着踩到，subagent 2026-11-04 已卸） | 跑 `node fix-proper-lockfile-proxy.mjs`（幂等）；pi 升本体后若复发，重跑即可。根因与复现见 §7.14 |
| `pi list` 里某行带 `(filtered)` | 该包在 `packages` 里写成 object form 且注明了要屏蔽的部分 | **预期**（本机只有 `git:github.com/BeYourDreams/pi-dsh-pet (filtered)`，见 §3.6） |
| ~~subagent 调不起来~~ | 插件 2026-11-04 已卸（§7.29），无从报错 | 重装 `npm:@arhen/pi-core-subagent` + 从 git 找回 `fix-subagent-check.mjs`（根因见 §7.16） |
| `pi --no-session -p ...` 不退出（shell 报 exit 124） | 桌宠的 `/feed` 长连接或宿主进程挂着父会话；headless 永远不会自己走完 | 用 `timeout 70 pi ...` 包一层（§7.13 已记录）；屏蔽上游扩展后刷屏的重连日志也会消失（§7.15） |
| ~~装东西后 pi-memory 报 `Could not locate the bindings file`~~ | pi-memory 与 better-sqlite3 都已随九连卸下线（§7.29），树里已无该包 | 重装才复发：`npm install-scripts approve better-sqlite3 && npm rebuild better-sqlite3`（详见 §3.1） |
| 输出突然变碎句 / 忽然变得啰嗦 / 开始掉冠词 | `pix-optimizer` 的 caveman 档位变了（新 caveman 是 ASD-STE100 两层，L1 选词断句 + L2 回复形状，**刻意保留冠词**，与旧 `ultracave` 碎句腔不同） | `/optimizer` 开面板调档（**只有面板，无 `/optimizer <mode>` 文本参数形**）；默认值在 `~/.pi/agent/pix.json` 的 `optimizer` 段，见 §3.15 |
| 切了 caveman / ponytail 档位后本轮 `cacheRead: 0` | 换了 system 前缀文本，首轮必然重算 | **正常现象**，别反复切；第二轮起恢复。原理同 §2.2 的 prefix-stabilizer、§7.17 |
| 输出突然变「懒」/ 突然开始砍功能（YAGNI 口吻） | ponytail 档位生效（本机默认就钉在 `ultra`，§3.15） | `/optimizer` 调档；持久化改 `pix.json` 的 `optimizer.ponytail`。它只管「写什么」，验证/错误处理/安全/可访问性永不裁 |
| bash 命令前莫名多出 `rtk ` 前缀 | RTK 执行层在改写命令（模型忘了加前缀时的兜底） | **预期行为**，省的是回显 token；`/optimizer` 里 RTK 关掉即停止；二进制缺失时它不会改写（§3.15） |
| 每条 bash 命令输出前带 `[rtk] /!\ No hook installed` | rtk 找的是 Claude 风格 `PreToolUse` hook，pi 走 pix 的 `tool_call` 改写，它看不见 | `%APPDATA%\rtk\config.toml` 的 `[hooks] suppress_hook_warning = true`（先 `rtk config --create` 再改，详见 §7.24） |
| 第一次开 pi 时 footer 出现下载 `rtk` 二进制的一行 | RTK 开着且 PATH/`binary.json` 里都找不到 `rtk` | **预期行为**，下到 `~/.pi/agent/bin` 且用 `checksums.txt` 校验过；离线时设 `PI_OFFLINE` 跳过（届时改写也不生效） |
| **浅色终端里 footer 的文件夹名（cwd）发白 / 颜色不对**，而其它段（token、耗时、git 分支）都正常 | **不是 pi-one-ui 写死了白色**，而是 `cwd` 是全包唯一默认用**裸 ANSI 色**的字段：`renderSourceColor(theme, config.colors.cwd, "cwd", "bold cyan", cwd)` → 主题里没有 `cwd` 这个自定义 token → 退到 `bold cyan`（SGR `1;36`，终端调色板 cyan 槽），浅色背景下就是一片惨白。详见 §7.22 | `~/.pi/agent/pi-one-ui.json` 写 `{"colors":{"cwd":"accent"}}` 然后 `/reload`。**别改主题**、别钉 hex（会把 light/dark 自动切换打死） |
GitHub 不通时先走 `ghproxy.net` 镜像 |

**磁盘布局速查**

| 路径 | 内容 |
|---|---|
| `~/.pi/agent/settings.json` | `packages` 注册表 + `defaultTools`（含 dsh-pet 的 object form 屏蔽，见 §3.6） |
| `~/.pi/agent/extensions/` | 本地扩展副本 + 各扩展的全局配置（如 `edit-guard-config.json`、`pi-dsh-pet.json`，**只放这里，放 agent 根下不生效**） |
| ~~`~/.pi/agent/{web-search,cache-compact}.json`~~ | 已随 2026-11-04 九连卸删除（§7.29）；重装对应包才再写 |
| `~/.pi/agent/mcp-onboarding.json` | 内建 MCP 引导向导的状态（见 §3.10），**勿手改** |
| `~/.pi/agent/state/` | 跨会话记账，**2026-10-09 清理后只剩 `pi-pet-autostart.json`**（记「本 pid 已弹过窗 + 落在哪只宠物上」） |
| `~/.pi/agent/git/` | git 源扩展（lazy-tools fork + dsh-pet，后者扩展被屏蔽，见 §3.6） |
| `~/.pi/agent/npm/node_modules/` | npm 源扩展 |
| `~/.pi/agent/npm/package.json` | 14 个 dep（`allowScripts` 键 2026-11-04 起已清空，§3.1） |
| `~/.pi/agent/pix.json` | `@xynogen/pix-optimizer` 的三档状态（`optimizer.caveman` / `.rtk` / `.ponytail`），**2026-10-12 新建**，见 §3.15 |
旧文件留 `pi-one-ui.json.bak.2026-10-18-pre-cwd`**。主题侧那三个越界色键不在这里改，走 `node fix-pi-one-ui-theme.mjs`（§7.26） |
Search fd/rg，见 §5「全局规则」
| `~/.pi/agent/bin/rtk` | RTK 官方二进制（2026-10-12 首次加载自动下载并校验 checksum）；`binary.json` → 本目录 → PATH，见 §3.15 |
| `%APPDATA%\rtk\config.toml` | **rtk 二进制自己的配置**（与 pi 的配置无关）：`[hooks] suppress_hook_warning = true` 掐掉每条 bash 的 hook 提醒，见 §7.24。`rtk config` 可看默认全文 |
| `~/.pi/agent/config/` | **已空**（smart-context 包卸载后配置已删，新装带 `startupConfig` 的包才会写） |
本目录名写死在 `dist/config.js:403`。本仓库这份是**生成物**：canonical 在 `config/pi-project/settings.json`，跑 `node install-project-config.mjs` 拷入 |
| `<仓库>/config/pi-project/*` | **项目级配置的 canonical 源**：`settings.json`（→ 拷进 `<仓库>/.pi/`）、`zvec.json`（留档件，不参与同步，见 §7.11） |
| `<仓库>/config/agent/*` | **用户级配置的 canonical 源**：`AGENTS.md`（0B，§5 定案不发规则）、`settings.snapshot-2025-09-15.json`（历史快照，只留档不拷）。~~`bash-prelude.sh`~~ 已于 2026-11-03 `git rm`（§3.9 作废）。`rtk-config.json` 已于 2026-10-12 `git rm`（§3.14 / §7.20） |
| `~/.pi/agent/sessions/**/*.jsonl` | 会话历史，算命中率的原始数据 |

**生效方式**：改配置或扩展后 `/reload`（不重启会话、不丢历史）。

---
---

## 9. 本轮实录：换包 + 升级 + 环境补齐（2026-09-29，`USERPROFILE=C:\Users\yxh`）

在另一台机器上照本清单完整走一遍。**配置值与 §1–§7 全部一致，唯一差异是路径前缀**（本机 `yxh`，原记录机 `yinxuehao`；`compaction-cache.json` 的 `logPath` 已是本机路径）。

2026-11-04 卸 `pi-mono-context-guard` 后为 **26 项**（23 npm + 3 git，§7.28）；同日再九连卸，最终 **17 项（14 npm + 3 git，§7.29）**。

### 9.1 拉代码：未提交改动先备份再 fast-forward

`git fetch` 后本地落后 17 个提交，工作区有两处未提交改动：

| 文件 | 改动 | 处置 |
|---|---|---|
| `extensions/pi-lean-prompt.ts` | +146 行，在 `before_provider_request` 里压 wire system 的 `<rules>`/`<docs>`/`<skills>` | 还原（已备份） |
| `readme.md` | 旧的 118KB 长版 | 还原（已备份） |

那 146 行不是「还没提交的新活」，而是**已被远端推翻的旧路线**：远端把 wire 压缩拆成独立的 `pi-lean-sections.ts`（只压 `<docs>` + `<skills>`），且 §3.2 明确「**不要压 `<rules>`**」（与 docs/skills 同改会让 pi 把 rules 正文挪位、条目与续行错配）。仓库是 canonical 源，直接还原即正确。备份留在 `/tmp/pi-ext-backup/`（`local-work.patch` + 两个原文件）。`e1758d3 → 16c8951` fast-forward 成功。

### 9.2 照清单换包：卸 3 装 3，仍是 19 个

| 操作 | 包 | 版本 | 依据 |
|---|---|---|---|
| 卸 | `pi-edit-guard` | 0.1.5 | §7.1，与 smart-edit 争 `edit` 槽 |
| 卸 | `pi-undo-redo` | 0.1.2 | 已弃用，连带清 `state/pi-undo-redo/`（22M 影子 worktree） |
| 卸 | `@nguyenquangthai/pi-ask` | 0.2.0 | 换包（`ask_user_question` → `ask_question`） |
| 装 | `@aboutlo/pi-smart-edit` | 0.4.0 | §7.1 独占 `edit` |
| 装 | `pi-dsh-pet` | 0.0.2 | §3.6 桌面宠物 |

`pi list` 实测 **19 项 = 18 npm + 1 git**，`settings.json` 的 `packages` 19 条。全程串行（§2.1 的硬规矩）。

### 9.3 升级：只有 mcp-adapter 动了，fork 带上了两个修复

`pi update --extensions`：

- `pi-mcp-adapter` **3.1.0 → 3.2.0**（唯一升版的 npm 包，其余已是 latest）
- fork `54bf2f2 → e972047` —— §7.3 那两个 omnify 修复已在上游，随 `git reset --hard` 一并带下来

⚠ 代价照旧：`reset --hard` + `clean -fdx` 把 `fix-lazy-tools-notes.mjs` 打的 `DOCS_NOTE` 路径补丁冲掉了，`--check` 报「待修补：docs 路径」，重打即恢复（幂等，复跑 `无需改动`）。实测命中 `D:\agent\pi-windows-x64`。**该机已无 `pi-shell.ts`，脚本第 2 段（bash→shell 措辞）自动跳过。**

### 9.4 配置同步

| 项 | 动作 |
|---|---|
| 本地扩展 | 用 `--prune` 全量重同步（1 个：`pi-pet-autostart`）——仓库删掉的副本（如 2026-11-05 的 `pi-lean-prompt.ts` / `pi-lean-sections.ts`，以及 2026-11-03 的 `pi-fd.ts` / `pi-bash-guard.ts`）会自动清掉，否则残留仍被加载；`--check` 把孤儿报 `[orphan]` 并 exit 1，复跑全 `[ok]` |
| `extensions/pi-shell.ts` | **删**。仓库已删；留在用户目录里会 `setActiveTools` 无条件隐藏 `bash`/`powershell`，与 §3.4 直接冲突 |
| `~/.pi/lazy-tools.json` | **删**（0.4.0 死配置，只触发迁移告警） |
| 用户级 `defaultTools` | 补 `bash`：`["read","edit","write"]` → `["read","edit","write","bash"]`，与项目级对齐（§3.5 两处必须一致） |
| `extensions/pi-dsh-pet.json` | 新建 `{"autostart":true,"size":"normal","delayMs":400,"maxPets":1,"bridge":true}` |
| `smart-context` / `compaction-cache` | 已合规，未动 |
| computer-use | `allowScripts` 早已批准；`setup-helper.mjs --postinstall` → `already up to date` |

> `npm install-scripts approve better-sqlite3` 报 `ENOMATCH` —— **属预期**，该依赖早被两包移除；§3.1 那行命令在本机实际等于只批准 computer-use。

### 9.5 体检结果

| 检查 | 结果 |
|---|---|
| `check-ext-errors.mjs` | `extension_error` **0**、stderr 命中 **0**（smart-edit 与 edit-guard 的 `edit` 冲突已随卸载消失） |
| `install-local-extensions.mjs --check` | 5 个全 `[ok]`，exit 0 |
| `fix-browser-native-compat.mjs` | `[skip]`（双路回退仍在，0.87.1 本就不需要） |
| `fix-lazy-tools-notes.mjs --check` | 重打后 `无需改动` |

### 9.6 本机新发现

**② 中途改 `defaultTools` 而不 `/reload`，等于把自己锁在门外。**
本轮前半段按 §3.4 往 `defaultTools` 补了 `bash`（两处都写好了）。但**本会话是在改之前启动的**，工具集在启动时定死，改完没跑 `/reload`——于是后半段要执行 `git push` 时，手上只剩 `read`/`write`/`edit`/`web_enable`/`omnify`。`omnify` 兜底调 `bash`、`powershell`、`read` 全部被拒：

```
builtin工具（sourceInfo=<builtin:bash>，由 pi 内部工厂生成、
没有可 import 的源码）→ omnify 执行不了
```

这正是 §3.4 那条注记的实测复现（内建工具没有可 import 的源码，jiti 加载器执行不了它们）。但真正的坑在时序：**恢复 shell 的唯一动作 `/reload` 本身就需要 shell 或命令面板**。所以 §3.4「改完 `/reload` 生效」有个隐含前提——别在一个正指着 shell 干活的中途会话里改它。稳妥做法：**改 `defaultTools` 放在会话开头做，或改完立刻 `/reload` 再继续。**

> 收尾：`git push` 最终由人执行。push 前用 `read` 直接读 `.git/refs/heads/master` 与 `.git/refs/remotes/origin/master`，两者同为 `16c8951`，确认是空操作——**没有 shell 也能判断有没有东西要推**。（`packed-refs` 里有条陈旧的 `8e4776b → origin/master`，loose ref 优先，不影响判定。）

### 9.7 增补三扩展：联网 / 会话级撤销 / 完成通知（2026-10-06）

`pi-web-access` + `@bacnh85/pi-checkpoint` + `pi-notify`，17 → **20 个在用**（18 npm + 2 git）。§3.7 / §3.8 是配置与边界，§7.4 记了 web-access 装卸两轮的理由演进，这里只留操作流水。

| 步 | 动作 | 结果 |
|---|---|---|
| 装 | `pi install npm:pi-web-access` / `npm:@bacnh85/pi-checkpoint` / `npm:pi-notify` | **一次只能吃一条参数**（写 `pi install a b c` 报 `Unexpected argument npm:@bacnh85/pi-checkpoint`），已写进 §2.1 |
| 配 | 新建 `~/.pi/agent/web-search.json` = `{"toolActivation":"eager"}` | 值非法扩展启动即抛，只认 `auto`/`dynamic`/`eager` |
| 冒烟 | `pi -p` 无交互跑 | pi-notify 生效（stdout 直接打出 OSC 777 序列 `]777;notify;Pi;Ready for input`）；三个扩展均无 `extension_error` |
| 探针 | 临时扩展打 `getAllTools()` / `getActiveTools()` | 注册表 **51** 个工具（四个 web 工具都在）；`session_start` 时全 active，`before_agent_start` 被 lazy-tools 收到 5 个。探针跑完即删 |
| 全链路 | 让 agent `omnify` 捞 `web_search` 搜 `nodejs` | 通（provider exa），搜完再 read 一次照常 |
| 缓存 | 见 §3.7 表 | wire 5294B、cacheRead 单调、零中途翻转 |
| 清理 | 删仓库里的 `nul` 垃圾文件（69B） | 已删 |

**未实测的**：`/undo` `/redo` 的交互式回合（非 git 仓库与 30 天剪枝路径未走）；`fetch_content` 在本机 TUN/fake-IP 下的 SSRF 表现（§3.7 留注）。
