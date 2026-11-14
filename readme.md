# Pi 扩展安装配置清单

本手册是一份**可直接照做的安装 + 配置清单**：装哪些、按什么顺序装、每个必做配置写什么、以及每条结论的实测依据。
扩展统一装在 `~/.pi/agent`（Windows：`%USERPROFILE%\.pi\agent`），下文路径均以此计。

**本机基线（所有实测都在这上面做的）**：Pi **1.3.0**（装在 `D:\Agent\pi`）、node **24.16.0**、npm 12、模型走本地代理 `http://localhost:20128/v1`（`openai-completions`，模型 id `1`，窗口 **128K** —— `models.json` 里 `contextWindow: 128000`）。
> ⚠️ node 低于 `pi-agent-browser-native` 声明的 `>=24.21.0`，但该包已卸，本机装/卸扩展时已不再打 `EBADENGINE` 警告。

本 README 只写三件事：**装什么**（§1 清单）、**怎么装**（§2 安装）、**装完去哪看**（底部文档导航）。

- **版本沿革、卸载理由、冲突与实测记录** → [`CHANGELOG.md`](./CHANGELOG.md)
- **必做配置、工具归属、使用纪律、token 优化、体检排障** → 底部导航（`docs/` 各文件）

> 要查某个包为什么被卸、某次体检的原始输出，去 CHANGELOG 找对应日期。

## 1. 清单（在用 9 个扩展 = 6 npm + 3 git）

```
npm: pi-tps · pi-cache-guardian · pi-prefix-stabilizer · @aboutlo/pi-smart-edit
      @xynogen/pix-optimizer · @piotr-oles/pi-reflag
git: github.com/BeYourDreams/pi-lazy-tools · pi-dsh-pet（扩展被屏蔽） · pi-one-ui
```

**本清单以 `pi list` 实数为准**，任何增减都同步改这一节与 §2.1 的安装命令。版本不锁（安装命令一律不带 `@版本号`，取 npm 最新），要查本机实际版本：


```bash
node -e 'const{execSync}=require("child_process"),fs=require("fs");
execSync("pi list",{encoding:"utf8"}).split("\n").filter(l=>/^\s+(npm|git):/.test(l)).map(l=>l.trim())
 .forEach(s=>{const n=s.split(":").slice(1).join(":").replace(/@latest$/,"");
  try{console.log(n,"→",JSON.parse(fs.readFileSync(process.env.USERPROFILE+"/.pi/agent/npm/node_modules/"+n+"/package.json","utf8")).version)}catch{console.log(n,"→ (git)")}})'
```

### 1.1 装什么（先装，装完先跑一次冒烟）

**npm 源 6 个**：

| 包 | 作用 | 装完要做的 |
|---|---|---|
| `npm:pi-tps` | 底部 token/speed 状态栏 | 跑 `fix-tps-theme.ps1` 让配色跟随系统主题 |
| `npm:pi-cache-guardian` | 缓存命中巡检 + 前缀漂移告警 | 无（与 `pi-prefix-stabilizer` 是同一根因的两端，一并用） |
| `npm:pi-prefix-stabilizer` | 系统提示词前缀稳定 + 漂移检测 | 无；**当前无顺序约束**（§2.2） |
| `npm:@aboutlo/pi-smart-edit` | 覆盖内建 `edit`，容忍引号/空白不匹配 | 无；`edit` 归它，匹配走「精确 → NFKC 归一化行」（[配置 §3.6](./docs/配置.md)） |
| `npm:@xynogen/pix-optimizer` | **压缩三合一**：caveman（输出，ASD-STE100 四档）+ ponytail（做法，YAGNI 三档）+ RTK（输入，bash 命令改写） | **写 `~/.pi/agent/pix.json`**（[配置 §3.5](./docs/配置.md)）；本机三档全 ultra。不注册工具，唯一入口 `/optimizer` 交互面板；RTK 首次加载自动下二进制到 `~/.pi/agent/bin` |
| `npm:@piotr-oles/pi-reflag` | 透明把 bash 里的 `find`→`fd`、`grep`→`rg` 改写后执行 | 要求 `fd` / `rg` 在 PATH（[配置 §3.7](./docs/配置.md)） |

**git 源 3 个**（都必须串行 `pi install`，且先 `pi remove` 掉旧的 npm/本地路同源条目）：

| 包 | 作用 | 装完要做的 |
|---|---|---|
| `git:github.com/BeYourDreams/pi-lazy-tools` | 懒加载层，注册 `omnify`（按需代理执行隐藏工具） | 无（fork 已含两个修复，[工具归属 §4](./docs/工具归属.md)）；升完重跑 `fix-lazy-tools-notes.mjs` |
| `git:github.com/BeYourDreams/pi-dsh-pet` | 桌面宠物：Electron 透明浮窗 + 91 个 WebM 动画 | **必须 `pi install`**（光 `npm i -g` 不加载）；上游扩展用 object form 屏蔽（[配置 §3.3](./docs/配置.md)）；**写 `extensions/pi-dsh-pet.json`** |
| `git:github.com/BeYourDreams/pi-one-ui` | 状态栏 / 主题增强（`/colors`、`pi-one-ui.json`） | **走 git 不走 npm**（npm 0.9.1 主题过不了 pi 严格 schema）；**写 `pi-one-ui.json` 的 `colors.cwd`**（[配置 §3.8](./docs/配置.md)） |

> 另：**本地扩展 2 个** `extensions/pi-pet-autostart.ts`、`extensions/codemode-only.ts`，由 `node install-local-extensions.mjs` 同步（§1.2）。
> 扩展的具体版本号不锁、不记在本清单里：安装命令一律不带 `@版本号`（取 npm 最新），要查本机实际版本跑下面那段脚本。

### 1.2 本地扩展（2 个）

仓库 `extensions/` 是 canonical 源，`node install-local-extensions.mjs` 幂等同步到用户目录（`--check` 只体检、有漂移 exit 1）。

| 文件 | 作用 |
|---|---|
| `pi-pet-autostart.ts` | 让 `pi-dsh-pet` **默认常驻且整机只留一只**：TUI 会话一开就派发 `/pet`，已有宠物窗就复用不新开，跨会话/多开 pi 也只一只。不注册工具，只挂 `session_start` + `/pet-auto` 开关。配置见 [配置 §3.3](./docs/配置.md) |
| `codemode-only.ts` | 让 `codemode.mode: "only"` **真的只剩 codemode 一条入口**：`only` 只隐藏声明（`hiddenDeclarations`：active 但不声明 = 仍可调用），模型硬点名 `bash` 照样执行（2026-11-14 实测 43 次直调全成功）。本扩展在 `tool_call` 拦掉直调的内建 8 个名字，回 reason 指回 `tools.x()`；脚本内的嵌套调用带 `parentToolCallId`，放行。不注册工具、0 提示词开销 |

> 同步是双向的：仓库删掉的本地扩展要跑 `node install-local-extensions.mjs --prune` 才能从用户目录清掉，否则残留副本仍然被加载（`--check` 会把孤儿报 `[orphan]` 并 exit 1）。

### 1.3 Skills（可选，非扩展）

本机在装 11 个技能，全部落在 `~/.pi/agent/skills/`（索引已按 §1.4 隐藏，名单在 `config/agent/AGENTS.md`）：

| 技能 | 装法 | 用途 |
|---|---|---|
| `cangjie-skill`（仓颉） | `git clone github.com/kangarooking/cangjie-skill` | 把书 / 长视频 / 播客 / 课程蒸馏成可执行 skills |
| `goutoujunshi`（狗头军师） | `git clone github.com/shengjidaguai-china/goutoujunshi` | 恋爱军师与情绪支持 |
| `short-drama` | 仅全局副本（见下） | 短剧/漫剧项目总控：初始化、下一步、Dashboard |
| `short-drama-develop` | 仅全局副本 | 开发/故事设定/分集地图/导演阐述/画风 |
| `short-drama-novel-analyze` | 仅全局副本 | 长篇小说 → 原著分析 → 分集候选 |
| `short-drama-assets` | 仅全局副本 | 人物/造型、地点、道具的视觉设定 |
| `short-drama-image-prompts` | 仅全局副本 | 人物/场景/道具图片提示词 |
| `short-drama-pro` | 仅全局副本（自建，含 SHT-31 / PAC-01~05 / CON-08 补丁） | 剧本 + 分镜 + 视频提示词一条链 |
| `short-drama-produce` | 仅全局副本 | 确认后跑图/跑视频/配音/配乐 |
| `short-drama-review` | 仅全局副本 | 审稿与跨场连续性检查 |
| `short-drama-edit` | 仅全局副本 | 剪辑/字幕/响度/交付规格 |

> **九件 `short-drama-*` 没有仓库镜像**：`git ls-files skills` 只剩 `UPSTREAM.md`，SKILL.md 与脚本只存在于 `~/.pi/agent/skills/`——改它们等于直接改全局，仓库里没有备份（要留底自己另存）。`sync-drama-skills.mjs` 的 `CUSTOM` 已清空，`check` 恒报无漂移。
>
> **曾计划的换代未落地**：`400-duanju-shuangdian` + `short-drama-factory` + `code-review` 是 2026-11-07 写进手册的目标态，**本机实际没装**（`~/.pi/agent/skills/` 里没有）。要么按表里命令 clone 装上并补名单，要么把这段计划删掉——别照抄当现状。
>
> **新装 skill 四步**：① clone 到 `~/.pi/agent/skills/`；② `node mark-skills-lazy.mjs`（否则索引又常驻）；③ 在 `config/agent/AGENTS.md` 名单补一条 + `node install-project-config.mjs`；④ 开新会话。
>
> **备用加载路径（脚本侧）**：`disable-model-invocation` 只影响提示词，不影响 `options.skills` → `omnify` 仍能按 goal 检索到全部技能（含打标技能）；codemode 沙箱没有 skills API，这是唯一脚本侧入口。
>
> ```js
> const r = await tools.omnify({ goal: "越级反杀 绝境翻盘" }); // goal 用描述里的触发信号词，BM25 才命中
> const p = r.match(/（([A-Za-z]:[^）]*SKILL\.md)）/)?.[1];      // 返回含 `（盘符:\...\SKILL.md）`
> if (p) return await tools.read({ path: p });
> ```

### 1.4 技能索引懒加载（纯配置，2026-11-14）

技能索引（name + description + filePath）由 pi 原生**常驻**注入系统提示词，本机 11 个技能实测 ≈ **2000 tok/请求**；技能正文（≈22k tok）本来就已经是按需读的。纯配置（**0 扩展**）就能把索引压到 ≈ **180 tok**：

1. 给每个 `~/.pi/agent/skills/*/SKILL.md` 的 frontmatter 加一行 `disable-model-invocation: true` —— pi 用 `formatSkillsForPrompt` 过滤该标记，整条技能不再出现在提示词里；`/skill:<name>` 和直接 `read SKILL.md` 都不受影响。
2. 路由改由名单承担：`config/agent/AGENTS.md`（canonical）写「技能名=2~4 字提示」一行到底，`node install-project-config.mjs` 同步到 `~/.pi/agent/AGENTS.md`。**这是模型唯一的路由依据，别省**。

```bash
node mark-skills-lazy.mjs          # 幂等补标记（新装技能后重跑）
node mark-skills-lazy.mjs --check  # 体检，有漏标 exit 1
node install-project-config.mjs    # 名单同步到 ~/.pi/agent/AGENTS.md
```

**实测（同 cwd、`pi --print` 首请求 prompt tokens）**

| 状态 | 首请求 | 说明 |
|---|---|---|
| 默认（索引常驻） | 6724 | `<available_skills>` 全量 |
| **本机现状（frontmatter + 名单）** | **4928** | 省 1796 tok（−27%），代价 = 名单 ≈180 tok |
| 试过的扩展方案（已弃用） | 4747 | `skill` 工具按 goal 搜索；只多省 180 tok，却多一个要维护的扩展 → 弃 |

**注意**
- 生效需新会话或 `/reload`；技能名/路径变了要同步改 `config/agent/AGENTS.md`，否则模型找不到。
- 别指望 `pi-lazy-tools` 代劳：它只把 `<skills>` 段在 **transcript** 里换成一行 `SKILLS_NOTE`，**真实 provider payload 仍是全量索引**（2026-11-14 用 `before_provider_request` 抓 payload 复核，见 [token优化 §6.5](./docs/token优化.md)）。
- 只看名字不够时（比如 7 个 `short-drama-*` 分不清），名单里那 2~4 字提示就是分流依据；宁可长 50 字符也别留空。

## 2. 安装

### 2.1 顺序循环

**`pi install` 一次只写一条注册，绝不能并行**（并行会竞写 `settings.json` 丢包）。照序跑，**目标 = `pi list` 9 条**：

```bash
# ① npm 源 6 个（循环里少一个就少装一个）
for p in pi-tps pi-cache-guardian pi-prefix-stabilizer \
         @aboutlo/pi-smart-edit @xynogen/pix-optimizer @piotr-oles/pi-reflag; do
  pi install "npm:$p" || echo "[失败] $p"
done

# ② git 源 3 个，单独串行装
pi install git:github.com/BeYourDreams/pi-lazy-tools
# 宠物先 remove 旧的 npm 源 / 本地源，否则两份并存各加载一次（[配置 §3.3](./docs/配置.md)）
pi install git:github.com/BeYourDreams/pi-dsh-pet
# pi-one-ui 走 git 不走 npm：npm 包 0.9.1 的内置主题过不了 pi 严格 schema
pi install git:github.com/BeYourDreams/pi-one-ui

# ③ 本地扩展（pi-pet-autostart.ts 宠物默认常驻 + codemode-only.ts 入口守卫）
node install-local-extensions.mjs

# ④ 用户级配置：把仓库 config/agent/ 拷进 ~/.pi/agent/（项目级 settings.json **不**拷：会覆盖顶掉全局）
node install-project-config.mjs

# ⑤ 项目级规则（单条：别写项目级 .pi/settings.json）：仓库根 AGENTS.md 就是模板，按项目拷
# cp AGENTS.md <项目>/AGENTS.md
```
> **④ 补充：用户级 `~/.pi/agent/settings.json` 确保含 codemode 配置**（与 `codemode-only.ts` 配套；只改用户级，勿写项目 `.pi/settings.json`）：
> ```jsonc
> {
>   "defaultTools": ["read", "edit", "write", "bash", "codemode"],
>   "codemode": { "mode": "only", "inlineBudget": 0 }
> }
> ```
> `inlineBudget: 0` = 仅列命名空间、不内联声明（省 token）；直调内建工具名由 `codemode-only.ts` 拦截并回指 `tools.x()`。改完 `/reload` 或新会话生效。

> **别再把历史上卸掉的包装回来**（全部 20+ 个，理由都在 CHANGELOG 对应日期）。本机清了它们是为了「一个 user turn = 一个 provider 请求」，装回前先答一遍这个问题。典型黑名单：`pi-web-access` / `pi-agent-browser-native` / `@chendpoc/pi-memory` / `@arhen/pi-core-subagent` / `pi-test-runner` / `pi-ocr` / `pi-cache-compact` / `@tian.zuo/pi-find` / `@trycedar/pi-mdiff` / `pi-mcp-adapter` / `@henryqw/pi-ask-question` / `@ssk_dev/rpiv-todo-lean` / `@narumitw/pi-lsp` / `@narumitw/pi-plan-mode` / `pi-secret-guard` / `pi-smart-reader` / `pi-budget-guard` / `pi-warm-cache` / `pi-deepseek-cache` / `pi-compaction-cache` / `pi-mono-context-guard` / `@bacnh85/pi-checkpoint` / `pi-meter` / `pi-notify`。

> **GitHub 直连不通（国内出口 443 超时）时走加速源**：先把 git 的 https 改写到可达镜像，再照上面装。实测 `gh-proxy.com` 可用，`ghproxy.com`/`gitclone.com`/`ghproxy.cc` 本机 2026-10-02 均不可达或证书过期。全局设置一次即生效（含 `pi install` 内部的 git clone）：
>
> ```bash
> git config --global url."https://gh-proxy.com/https://github.com/".insteadOf "https://github.com/"
> pi install git:github.com/BeYourDreams/pi-lazy-tools
> pi install git:github.com/BeYourDreams/pi-dsh-pet
> pi install git:github.com/BeYourDreams/pi-one-ui
> # 不想留全局改写就改完装完撤掉：
> git config --global --unset url."https://gh-proxy.com/https://github.com/".insteadOf
> ```
>
> 若 `pi update --extensions` 也超时，同一改写继续生效（git 源的 update 就是 git pull）；装完即可 `/reload`。

**装完自查**：`pi list` 应见 **9 个扩展（6 npm + 3 git）**，且 `git:github.com/BeYourDreams/pi-dsh-pet` 那行带 `(filtered)`（[配置 §3.3](./docs/配置.md)）。不是 9 条就是漏装/多装，回头查。

### 2.2 硬顺序约束

- **当前无顺序约束**（2026-11-04）：唯一的硬要求是「`pi-cache-compact` 必须装在 `pi-prefix-stabilizer` 之后」，而 cache-compact 已卸（[CHANGELOG §7.29](./CHANGELOG.md)），现在没有任何两个扩展抢 `session_before_compact`。日后重装压缩缓存类扩展时，回到历史教训那条来排顺序。
- **历史教训**：`pi-deepseek-cache` / `pi-compaction-cache` / `pi-warm-cache` / `pi-cache-compact` 都抢过（或试图抢）同一个压缩钩子，同场时接管权按装卸顺序互相覆盖 —— 压缩侧只能留一个，且必须排在 `pi-prefix-stabilizer` 之后（[CHANGELOG §7.13](./CHANGELOG.md)）。
- 其余顺序不限（注：`pi-ask` / `rpiv-todo-lean` 本身已于 2026-11-04 晚卸，[CHANGELOG §7.32](./CHANGELOG.md)）。

### 2.3 升级

```bash
pi update --extensions        # 只升扩展，不动 pi 本体（--all 会连 pi 一起升）

# 升完先看谁动了（fork 与 major 变更最容易出兼容问题）
pi list                                # 升完核一遍实际版本
```

**升级禁用 `pi install`**：对已装包会命中 npm 缓存、不升版本。升级一律走 `pi update --extensions`（不带版本号 = 取各包 npm 最新）。升级后跑 [体检与排障](./docs/体检排障.md)。

> **skills 不走 `pi update`**：`cangjie-skill` / `goutoujunshi` 是独立 git clone，要更新就在各自目录 `git pull`；九件 `short-drama-*` 没有仓库镜像，更新靠 `sync-drama-skills.mjs save/install`（`CUSTOM` 已清空，实际等于手工维护，详见 §1.3）。打标技能升级后要重跑 `node mark-skills-lazy.mjs`。

> 首次安装（§2.1）同样不带版本号，npm 自动解析 latest；**本仓库任何位置都不写死扩展版本号**。
> **两个 git 源走同一条命令**

> **升 `pi` 本体（`pi update --all`）或重装依赖会覆盖 `~/.pi/agent/node_modules` 里的补丁**：`fix-proper-lockfile-proxy.mjs`（防 jiti Proxy 崩 pi，[CHANGELOG §7.14](./CHANGELOG.md)）会被冲掉，升完重跑一次即可（`node fix-proper-lockfile-proxy.mjs --check` 只体检）。
> **`pi update npm:<包>` / 重装那个包会连它目录里的补丁一起冲掉**：`fix-pi-one-ui-theme.mjs` 打在 `npm/node_modules/pi-one-ui/themes/*.json` 上的补丁同理（[CHANGELOG §7.26](./CHANGELOG.md)），升完按 [体检与排障 §8](./docs/体检排障.md) 表重跑。

> `pi-dsh-pet` 换 git 源后 **`pi update` 只拉增量**（clone 就带 `assets/thumb`，91 个 WebM）；只有第一次 `/pet` 要下 Electron ≈100MB。

**升完必须验收两件事**：① `node fix-lazy-tools-notes.mjs --check` 与 `node fix-proper-lockfile-proxy.mjs --check` 都是 exit 0（两个补丁都没被冲掉）；② `pi --no-session -p "reply with: ok"` 里 `extension_error` 0、工具集没变（[token 优化 §6.4](./docs/token优化.md) 基线 5 个 / 5664B）。

### 2.4 卸载

```bash
pi remove npm:<包名>
```

卸载后同步删掉只为它存在的配置（例：`pi-footer-template` 卸载时连带删 `~/.pi/agent/pi-one-ui.json`），否则留下死配置。

---

## 文档导航

| 文档 | 内容 |
|---|---|
| [配置](./docs/配置.md) | §3 必做配置（`defaultTools` / 桌宠 / `pix.json` / `pi-one-ui` 等） |
| [工具归属](./docs/工具归属.md) | §4 谁注册了什么、`defaultTools` 闸门、搜文件路径 |
| [使用纪律](./docs/使用纪律.md) | §5 装机前审 active 集、命令超时、不进常驻集硬规则 |
| [token 优化](./docs/token优化.md) | §6 首字 token 优化、`codemode` 常驻与模式 |
| [体检与排障](./docs/体检排障.md) | §8 体检脚本、排障表、磁盘布局速查 |
| [CHANGELOG](./CHANGELOG.md) | 版本沿革、卸载理由、冲突与实测记录 |

---

