# Pi 扩展安装配置清单

本手册是一份**可直接照做的安装 + 配置清单**：装哪些、按什么顺序装、每个必做配置写什么、以及每条结论的实测依据。
扩展统一装在 `~/.pi/agent`（Windows：`%USERPROFILE%\.pi\agent`），下文路径均以此计。

**本机基线（所有实测都在这上面做的）**：Pi **1.3.0**（装在 `D:\Agent\pi`）、node **24.16.0**、npm 12、模型走本地代理 `http://localhost:20128/v1`（`openai-completions`，模型 id `1`，窗口 **128K** —— `models.json` 里 `contextWindow: 128000`）。
> ⚠️ node 低于 `pi-agent-browser-native` 声明的 `>=24.21.0`，但该包已卸，本机装/卸扩展时已不再打 `EBADENGINE` 警告。

**版本沿革、卸载理由、冲突与实测记录全部迁到 [`CHANGELOG.md`](./CHANGELOG.md)**。本 README 只写两件事：**当前装了什么**（§1–§4）与**装完之后要做什么**（§3 必做配置、§5 纪律、§8 体检）。要查某个包为什么被卸、某次体检的原始输出，去 CHANGELOG 找对应日期。

---

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
| `npm:@aboutlo/pi-smart-edit` | 覆盖内建 `edit`，容忍引号/空白不匹配 | 无；`edit` 归它，匹配走「精确 → NFKC 归一化行」（§3.6） |
| `npm:@xynogen/pix-optimizer` | **压缩三合一**：caveman（输出，ASD-STE100 四档）+ ponytail（做法，YAGNI 三档）+ RTK（输入，bash 命令改写） | **写 `~/.pi/agent/pix.json`**（§3.5）；本机三档全 ultra。不注册工具，唯一入口 `/optimizer` 交互面板；RTK 首次加载自动下二进制到 `~/.pi/agent/bin` |
| `npm:@piotr-oles/pi-reflag` | 透明把 bash 里的 `find`→`fd`、`grep`→`rg` 改写后执行 | 要求 `fd` / `rg` 在 PATH（§3.7） |

**git 源 3 个**（都必须串行 `pi install`，且先 `pi remove` 掉旧的 npm/本地路同源条目）：

| 包 | 作用 | 装完要做的 |
|---|---|---|
| `git:github.com/BeYourDreams/pi-lazy-tools` | 懒加载层，注册 `omnify`（按需代理执行隐藏工具） | 无（fork 已含两个修复，§4）；升完重跑 `fix-lazy-tools-notes.mjs` |
| `git:github.com/BeYourDreams/pi-dsh-pet` | 桌面宠物：Electron 透明浮窗 + 91 个 WebM 动画 | **必须 `pi install`**（光 `npm i -g` 不加载）；上游扩展用 object form 屏蔽（§3.3）；**写 `extensions/pi-dsh-pet.json`** |
| `git:github.com/BeYourDreams/pi-one-ui` | 状态栏 / 主题增强（`/colors`、`pi-one-ui.json`） | **走 git 不走 npm**（npm 0.9.1 主题过不了 pi 严格 schema）；**写 `pi-one-ui.json` 的 `colors.cwd`**（§3.8） |

> 另：**本地扩展 1 个** `extensions/pi-pet-autostart.ts`，由 `node install-local-extensions.mjs` 同步（§1.2）。
> 扩展的具体版本号不锁、不记在本清单里：安装命令一律不带 `@版本号`（取 npm 最新），要查本机实际版本跑下面那段脚本。

### 1.2 本地扩展（1 个）

仓库 `extensions/` 是 canonical 源，`node install-local-extensions.mjs` 幂等同步到用户目录（`--check` 只体检、有漂移 exit 1）。

| 文件 | 作用 |
|---|---|
| `pi-pet-autostart.ts` | 让 `pi-dsh-pet` **默认常驻且整机只留一只**：TUI 会话一开就派发 `/pet`，已有宠物窗就复用不新开，跨会话/多开 pi 也只一只。不注册工具，只挂 `session_start` + `/pet-auto` 开关。配置见 §3.3 |

> 同步是双向的：仓库删掉的本地扩展要跑 `node install-local-extensions.mjs --prune` 才能从用户目录清掉，否则残留副本仍然被加载（`--check` 会把孤儿报 `[orphan]` 并 exit 1）。

### 1.3 Skills（可选，非扩展）

本机在装 5 个技能，全部落在 `~/.pi/agent/skills/`：

| 技能 | 装法 | 用途 |
|---|---|---|
| `400-duanju-shuangdian` | `git clone github.com/icooldp/400-duanju-shuangdian` | 《400 个爆款短剧剧本爽点》技能包（26 个子技能，桥段生成 + 爽点校验） |
| `short-drama-factory` | `git clone github.com/wsf73/short-drama-factory` | 短剧工业化编剧系统（情绪契约单元链 + E1~E24 / S1~S8 机检） |
| `code-review` | 手工放入 | 代码审查：只报告带证据的问题与修法，不改源码 |
| `cangjie-skill`（仓颉） | `git clone github.com/kangarooking/cangjie-skill` | 把书 / 长视频 / 播客 / 课程蒸馏成可执行 skills |
| `goutoujunshi`（狗头军师） | `git clone github.com/shengjidaguai-china/goutoujunshi` | 恋爱军师与情绪支持 |

> 技能不再常驻注入系统提示词，需要时用 `omnify` 检索。**新装 skill 要开新会话才加载**（本会话内装的，omnify 当轮检索不到）。
>
> **drama 线已换代**：早期的 `short-drama-*` 九件（含自建的 `short-drama-pro`）已于 2026-11-07 从本仓库与全局删除，改为上面的 `400-duanju-shuangdian` + `short-drama-factory`。因此 `skills/` 目前只剩一份 `UPSTREAM.md`（旧 drama 线的上游快照与吸收流程留档），`sync-drama-skills.mjs` 的 `CUSTOM` 列表已清空（`check` 恒报无漂移）。原九件的定制细节（SHT-31 / PAC-01~05 / CON-08 等）见 CHANGELOG。

---

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
# 宠物先 remove 旧的 npm 源 / 本地源，否则两份并存各加载一次（§3.6）
pi install git:github.com/BeYourDreams/pi-dsh-pet
# pi-one-ui 走 git 不走 npm：npm 包 0.9.1 的内置主题过不了 pi 严格 schema
pi install git:github.com/BeYourDreams/pi-one-ui

# ③ 本地扩展（含 pi-pet-autostart.ts，宠物默认启用就靠它）
node install-local-extensions.mjs

# ④ 项目级/用户级配置：把仓库 config/ 拷进 pi 真正读取的位置（`.pi/` 是运行时目录，仓库里整体忽略）
node install-project-config.mjs
```

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

**装完自查**：`pi list` 应见 **9 个扩展（6 npm + 3 git）**，且 `git:github.com/BeYourDreams/pi-dsh-pet` 那行带 `(filtered)`（§3.6）。不是 9 条就是漏装/多装，回头查。

### 2.2 硬顺序约束

- **当前无顺序约束**（2026-11-04）：唯一的硬要求是「`pi-cache-compact` 必须装在 `pi-prefix-stabilizer` 之后」，而 cache-compact 已卸（CHANGELOG §7.29），现在没有任何两个扩展抢 `session_before_compact`。日后重装压缩缓存类扩展时，回到历史教训那条来排顺序。
- **历史教训**：`pi-deepseek-cache` / `pi-compaction-cache` / `pi-warm-cache` / `pi-cache-compact` 都抢过（或试图抢）同一个压缩钩子，同场时接管权按装卸顺序互相覆盖 —— 压缩侧只能留一个，且必须排在 `pi-prefix-stabilizer` 之后（CHANGELOG §7.13）。
- 其余顺序不限（注：`pi-ask` / `rpiv-todo-lean` 本身已于 2026-11-04 晚卸，CHANGELOG §7.32）。

### 2.3 升级

```bash
pi update --extensions        # 只升扩展，不动 pi 本体（--all 会连 pi 一起升）

# 升完先看谁动了（fork 与 major 变更最容易出兼容问题）
pi list                                # 升完核一遍实际版本
```

**升级禁用 `pi install`**：对已装包会命中 npm 缓存、不升版本。升级一律走 `pi update --extensions`（不带版本号 = 取各包 npm 最新）。升级后跑 §8 体检。

> **skills 不走 `pi update`**：`400-duanju-shuangdian` / `short-drama-factory` 是独立 git clone，要更新就在它自己目录 `git pull`（详见 §1.3）。`sync-drama-skills.mjs` 的 `CUSTOM` 已清空，只对旧 drama 线有作用。

> 首次安装（§2.1）同样不带版本号，npm 自动解析 latest；**本仓库任何位置都不写死扩展版本号**。
> **两个 git 源走同一条命令**

> **升 `pi` 本体（`pi update --all`）或重装依赖会覆盖 `~/.pi/agent/node_modules` 里的补丁**：`fix-proper-lockfile-proxy.mjs`（防 jiti Proxy 崩 pi，CHANGELOG §7.14）会被冲掉，升完重跑一次即可（`node fix-proper-lockfile-proxy.mjs --check` 只体检）。
> **`pi update npm:<包>` / 重装那个包会连它目录里的补丁一起冲掉**：`fix-pi-one-ui-theme.mjs` 打在 `npm/node_modules/pi-one-ui/themes/*.json` 上的补丁同理（CHANGELOG §7.26），升完按 §8 表重跑。

> `pi-dsh-pet` 换 git 源后 **`pi update` 只拉增量**（clone 就带 `assets/thumb`，91 个 WebM）；只有第一次 `/pet` 要下 Electron ≈100MB。

**升完必须验收两件事**：① `node fix-lazy-tools-notes.mjs --check` 与 `node fix-proper-lockfile-proxy.mjs --check` 都是 exit 0（两个补丁都没被冲掉）；② `pi --no-session -p "reply with: ok"` 里 `extension_error` 0、工具集没变（§6.4 基线 5 个 / 5664B）。

### 2.4 卸载

```bash
pi remove npm:<包名>
```

卸载后同步删掉只为它存在的配置（例：`pi-footer-template` 卸载时连带删 `~/.pi/agent/pi-one-ui.json`），否则留下死配置。

---

## 3. 必做配置

### 3.1 懒加载常驻集 = `settings.json` 的 `defaultTools`

一个字段两用：pi 用 `defaultTools` 决定「哪些内建工具注册」，`pi-lazy-tools` 用它决定「谁不被懒加载」（项目级整体覆盖用户级）。本机两处写同一份名单：

```jsonc
// ~/.pi/agent/settings.json 与 <项目>/.pi/settings.json
// 本仓库的项目级 canonical 源 = config/pi-project/settings.json（`.pi/` 整体 gitignore）
// 拷进去：node install-project-config.mjs ｜ 体检：node install-project-config.mjs --check
{ "defaultTools": ["read", "edit", "write", "bash", "codemode"] }
```

> **`codemode` 是唯一允许进常驻集的扩展工具**（2026-11-13 起），例外说明见 §5 第 0 条 / §6.4。它与 `pi-lazy-tools` 的接合点、成本、配置约束都在 §6.4 一并写明。

> **本机 = pi 的内置默认 4 个 + `codemode`**（`dist/core/sdk.js:140` 的 `defaultActiveToolNames`），**唯一加进来的扩展工具就是 codemode**（理由见 §6.4），且 `codemode.mode` = **`"only"`**（§6.4 模式对照）：搜文件名/目录、搜内容交给 `omnify` 按需代理执行；工具表由 codemode 描述 + `searchTools()`/`describeTool()` 动态发现。`"only"` 下 tools 段成本取决于 `inlineBudget`（默认 3000 tok 上限），具体账在 §6.4；`"on"` 下则约 +400 tok/请求。仍是搜索工具常驻（`8317B`）之下。
> **`omnify` 不写进 `defaultTools`**：它由 lazy-tools 在 `session_start` 无条件写进 active 集（`setActiveTools`），写不写都一样。
> **`grep` / `fd` 不写也会注册**（扩展注册不过内建闸），只是被 lazy 隐藏；`omnify` 能把它们搜出来并执行（已实测）。**内建的 `ls` / `powershell` 搜得出、却执行不了**（pi 用内部工厂造它们，`sourceInfo` 是合成标记 `<sdk:ls>`，没有可 import 的源码）→ 这类需求一律 `bash ls`。fork 已把这个原因写进 omnify 的失败文案（CHANGELOG §7.3）。
> **`~/.pi/lazy-tools.json` 已删除**（2026-09-29，`pi-lazy-tools` 0.4.0 起只告警不读取；旧副本 `lazy-tools.json.bak` / `.bak2` 同日一并删掉，内容已进 `defaultTools`）。新装扩展**不要**往 `defaultTools` 里加（硬规则，见 §5 第 0 条）。
> 改完 `/reload` 生效（不必重启会话）。

### 3.2 工具注册闸：`defaultTools`（项目 + 用户两处都要写）

项目 `.pi/settings.json` 与 `~/.pi/agent/settings.json` 都要写上一节那份名单，否则进了某项目就被整体覆盖成内建默认（`read bash edit write`）。本机两处写的正是这份默认名单，所以项目间切换不会有差异。

> ⚠️ 0.4.0 之前这里确实是「两道闸」（`defaultTools` 管注册 + `lazy-tools.json` 的 `resident` 管常驻），**现在合并成一道**，只查 `defaultTools`。

### 3.3 桌面宠物：独立服务端 + 整机一只（2026-09-30 按上游 0.0.2 重写）

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
- **窗僵死会自己换一扇**：每 20s 读一次 `/health`（零进程），同一扇窗 `windowPid > 0` 而 `clients` 一直是 `0` 满 60s 就 `POST /control restart-window`，本会话最多换 3 次（`PI_PET_WINDOW_REVIVE_POLL_MS` / `_AFTER_MS` / `_MAX`）。为何要客户端兜一层：上游 `needsRelaunch()` 只认「pid 死了才算窗没了」，僵窗（进程活着、渲染进程崩了）落两不管（CHANGELOG §7.25）。
- 文件缺失 / 读坏 = 按**启用**处理（读坏会 `notify` 一次），与其他钩子扩展同一套约定。
- 会话内随手切：`/pet-auto on|off|size <档位>|max <只数>|restart|status`，改动写回同一个 json（并同步 `ctrl.json`）。
- 旧键 `delayMs` / `bridge` / `host` / `sweepMs` / `hostRuntime` 随旧架构作废（新扩展读都不读）；`/pet-auto cleanup|host|bridge` 同样作废 —— 单例与数量现在由服务端自己的锁 + `maxPets` 转发闸兜住（§3.6.1）。

#### 3.3.1 「只许一只」现在由谁兜

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
> | `"git:github.com/BeYourDreams/pi-dsh-pet"` | **照旧加载**（本机踩了一个月才发现） | 重复注册 `/pet` `/pet-stop` `/pet-say` `/pet-status`（本地薄客户端也注册同名 + `/pet-auto`）；多一条 `session_start → ensureHost()` 走 `state.json` 单一来源；终端刷 `[pi-dsh-pet] /feed 连接断开，2s 后重连`，headless 跑不完（CHANGELOG §7.13 的 exit 124 噪音一半来自它） |
> | `{"source": "git:...", "extensions": []}` | **不加载** ✅ | 干净：`pi list` 该行显示 `git:github.com/BeYourDreams/pi-dsh-pet (filtered)`，终端只剩本地客户端的 `[pi-pet-autostart]` |
>
> 验证法（改完 `/reload` 后跑）：`timeout 70 pi --no-session -p "reply with: ok"` → 输出里应**不出现** `[pi-dsh-pet]` 前缀的行；`pi list` 应出现 `(filtered)` 且条目数不变（本机 2026-11-02 为 **27**）。上游源码留着做参考（`~/.pi/agent/git/github.com/BeYourDreams/pi-dsh-pet/pi/extensions/index.ts`），本机跑的是本地薄客户端。
>
> **2026-11-02 换 owner（`qq458249269` → `BeYourDreams`）的一个坑**：重 clone 237M 直连撞 `fetch-pack: invalid index-pack output`；两 owner 的 `main` 同一个 HEAD（`git ls-remote` 一致），于是把旧 clone `git/github.com/qq458249269/pi-dsh-pet` 用 **NTFS junction** 指到 `git/github.com/BeYourDreams/pi-dsh-pet`，再在那个 clone 里 `git remote set-url` 到新 URL，避开重下（正在跑的宠物 Electron 占旧目录，`mv` 报 `Device or resource busy`）。`settings.json` 的 object form source 同步改成新 owner，`pi list` 仍是 `(filtered)`。**收尾（下次 `/pet-auto off` 或宠物窗关掉后做）**：删 junction → 真 `mv` 目录到新 owner 路径 → 无需再动 remote。

**首次开窗要下 Electron ≈100MB**（上游在 Windows 自动设 `ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/`）；包里 91 个透明 WebM，`assets/thumb` 解包 48MB。

这一轮重构定下的几条回归约束（历史探针随 `.sc-test/` 一起删除，改本扩展时按这几条自查）：**先打再探**（启动时零能力探测，命令失败才两个只读 GET）、**只有 `home/port` 也能复用宿主**（两宿主互锁的入场券）、**心跳陈旧不再单独判死**（`/health` + pid 才权威，陈旧且探不通才重拉）、**退出码翻译**（2 参数错 / 3 缺依赖 → `cd <pkg> && npm install` / 4 端口）、**一次 `/feed` 连接**（并发重连不许叠连接，CHANGELOG §7.5）。回退：`pi remove git:github.com/BeYourDreams/pi-dsh-pet` + 删 `extensions/pi-pet-autostart.ts` 与 `pi-dsh-pet.json` 再 `/reload`。



#### 3.3.2 服务端契约（本扩展认的那份，2026-09-30 实测 0.0.2）

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

> **上游 `probeCaps()` 在 0.0.2 上会把自己误判**（CHANGELOG §7.5）：它要求 `GET /control` 回 400 **且 body 里有 hint**，而实测真宿主回的是 400 + **空 body** `{}`（带 hint 的那条只在 POST 分支）。照抄它的判据 = 「`/pet` 永远叫不出窗」，也就是本轮报障里的「拉不起来 pet」。本扩展的判据放宽到「非 404」。

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

### 3.4 用户级 `settings.json` 备忘（非默认项，2026-10-09 实况）

以下都是本机**有意设的非默认值**，重建环境时漏写就会掉行为（已逐项实测生效）：

| 键 | 值 | 作用 / 备注 |
|---|---|---|
| `defaultThinkingLevel` | `"high"` | 默认思考强度 |
| ~~`shellCommandPrefix`~~ | ~~`"source ~/.pi/agent/bash-prelude.sh"`~~ | **本机从未写过此键**（CHANGELOG §10 · 原 3.9）：脚本 2026-11-03 已 `git rm`，2026-11-04 定为不恢复 |
| ~~`extensions`~~ | ~~`["-builtin:mcp"]`~~ | **2026-11-04 晚已删**：`pi-mcp-adapter` 卸载后无对象（CHANGELOG §10 · 原 3.10 / §7.32） |
| `defaultTools` | `["read","edit","write","bash","codemode"]` | §3.1 / §3.2（项目级同值）；`codemode` 为唯一常驻扩展工具（§6.4） |
| `codemode.mode` | `"only"` | §6.4；`"on"`（默认）≈+400 tok，`"only"` 顶到 `inlineBudget`（默认 3000 tok） |
| ~~`cacheWarming`~~ | ~~`"streaming"`~~ | **2026-11-04 已删**：它会在每轮之后自己追加一次 warmup 请求（CHANGELOG §7.30）。删后首 token 略慢、少一发请求 |
| `compaction` | `{"enabled": true, "reserveTokens": 32768, "keepRecentTokens": 8000}` | 自动压缩开；预留 32K + 保留最近 8K（128K 窗下偏保守） |
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

> `lastChangelogVersion`、`collapseChangelog`、`treeFilterMode` 是宿主自维护的，不要手改。
> 上表里划掉的三个键（`shellCommandPrefix` / `extensions` / `cacheWarming`）**都已删除且不写回**，留行只为提醒别手滑加回去。
> 改完 `settings.json` 一律 **`/reload`**——但注意：**会话中途改 `packages`/`extensions` 会改变已开扩展的加载面**，顺序是先改配置再开新会话。

### 3.5 `@xynogen/pix-optimizer`：压缩三合一，本机三档全 ultra（2026-10-12）

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
报 TLS 握手失败（证书链问题，见 §8 排障表），直接绕开：

```bash
cd ~/.pi/agent/bin
curl -L --ssl-no-revoke -o rtk.zip https://github.com/rtk-ai/rtk/releases/latest/download/rtk-x86_64-pc-windows-msvc.zip
# 校验：对比 release 的 checksums.txt，逐位对上才用
unzip -o rtk.zip && rtk --version   # 应打版本号（本机基线 0.51.0）
```
- **对前缀缓存的影响**：caveman / ponytail 都往 system prompt 注入规则文本，**切档 = 换一次前缀文本 = 下一轮 `cacheRead` 归 0**（原理同 `pi-prefix-stabilizer`）。**定下来就别反复切。**
- **rtk 自己的配置在 `%APPDATA%/rtk/config.toml`**（默认不存在，`rtk config --create` 生成）：`[hooks] suppress_hook_warning = true` 关掉每条 bash 前缀的 `[rtk] /!\ No hook installed` 噪音。**别手写半截小节**——rtk 反序列化缺字段即报 `missing field`，见 CHANGELOG §7.24。
- **卸载**：`pi remove npm:@xynogen/pix-optimizer`，再删 `pix.json` 的 `optimizer` 段（§2.4 纪律）。

### 3.6 `@aboutlo/pi-smart-edit`：独占 `edit`（无需额外配置）

**零配置**，装完即生效。它覆盖内建 `edit`，匹配走「精确 → NFKC 归一化行」，容忍引号/空白/全半角差异。

- **不能与其他抢 `edit` 的扩展共存**：同时装会报 `Tool "edit" conflicts with ...` 并导致加载失败。本机只留它，`pi-edit-guard` 已卸（CHANGELOG §7.1）。
- **代价**：没有 `undo`、没有越界 cwd / `.env` 提示。**文件级撤销靠 git**，会话级 `/undo` 不可用（CHANGELOG §7.1、§8 排障表）。
- 改 `.md` 时也用它（`md_*` 系列已随 `pi-mdiff` 卸载），**改动带足上下文行以锚定位置**。

### 3.7 `@piotr-oles/pi-reflag`：`find`→`fd`、`grep`→`rg` 透明改写（无需配置文件）

**零配置**，但它依赖外部二进制：

| 依赖 | 确认方式 | 缺失时 |
|---|---|---|
| `fd` | `fd --version` | 改写后的 `find` 不可用；可用 pi 自带副本 `~/.pi/agent/bin/fd` |
| `rg` | `rg --version` | 同上 |

- 它挂在 `tool_call` 上改 `input.command`，**不注册工具、不动 active 集**，零 wire 开销。
- 只改写**流水线首段的首词**；管道消费位、`git grep`、`./find-helper.sh`、`fd`/`rg` 本身不碰。
- 翻译不了的 `find` flag **原样保留**（让 find 自己报错，不静默猜）。要 GNU 独占 flag 就自己写 `/usr/bin/find`。
- 它取代了本仓库已删的 `no-find.ts` / `pi-no-find.ts`（历史见 CHANGELOG §7.9）。

### 3.8 `pi-one-ui`：`cwd` 颜色要手动指定

`pi-one-ui` 的 `cwd` 是全包唯一默认用**裸 ANSI 色**的字段（`bold cyan`），浅色背景上就是一片惨白。修法：

```bash
# ~/.pi/agent/pi-one-ui.json
{ "colors": { "cwd": "accent" } }
```

改完 `/reload`。**别改主题、别钉 hex**（会把 light/dark 自动切换打死）。需要别的非默认项时也写这个文件。

> 它当前的 git 源版本主题已合规，**不需要**再跑 `fix-pi-one-ui-theme.mjs`；那个脚本现在是「两份副本都体检」的守门工具（§8）。

---

## 4. 工具归属（谁注册了什么）

**当前 9 个扩展只有 2 个往工具表里加东西**，其余全是事件钩子 / 纯命令：

| 来源 | 注册的工具 / 命令 |
|---|---|
| 内建 pi | `read` `write` `bash` `powershell` `edit` `grep` `find` `ls`（受 `defaultTools` 闸门控制） |
| `@aboutlo/pi-smart-edit` | `edit`（**覆盖内建**），匹配走「精确 → NFKC 归一化行」，容忍引号/空白差异（§3.6） |
| `git:pi-lazy-tools`（fork） | `omnify`（只代理执行、**不切 active 集**；`load_tools` / `call_tool` 已撤） |
| `@piotr-oles/pi-reflag` | 无工具（`tool_call` 改写 `bash` 命令里的 `find`/`grep`，§3.7） |
| `@xynogen/pix-optimizer` | 无工具（纯事件钩子 + `/optimizer` **交互面板**；RTK 改写挂在 bash 工具调用上，§3.5） |
| `pi-prefix-stabilizer` / `pi-cache-guardian` | 无工具（纯事件钩子） |
| `git:pi-one-ui` | 无工具（状态栏/主题，`/colors` 等命令，§3.8） |
| `git:pi-dsh-pet` | 无工具（`/pet` `/pet-stop`；HTTP+WS 服务只把 agent 事件转发给 Electron，§3.3） |
| `pi-pet-autostart`（本地 `extensions/`） | 无工具（`session_start` 钩子 + `/pet-auto` 命令） |
| `pi-tps` | 无工具（状态栏） |

**一道闸：`defaultTools`**（0.4.0 前是「`defaultTools` 管注册 + `resident` 管常驻」两道，0.4.0 起合并）：

| 工具 | 在 `defaultTools` 里？ | 后果 |
|---|---|---|
| `read` `write` `edit` `bash` | ✅ 在列 | 纯内建：不在列就不注册；本机就到这四个为止 |
| `grep` `find` | ❌ 未列 → 懒加载 | 内建实现（`pi-find` 已卸）；`omnify` 可搜出并执行 |
| `ls` `powershell` | ❌ 未列 → 懒加载 | 需要时 `omnify` 按名 load 回来（或用 `bash ls`） |
| `omnify` | ❌ 写不写都一样 | pi 核心无条件注册，**不需进名单**，写进去只是读起来清楚 |

漏了的后果（实测）：`defaultTools` 是内建工具的**注册闸**（不在列 → 根本注册），对扩展工具则是**常驻名单**（不在列 → 注册了但被 lazy 隐藏，wire 上看不到；要它时 `omnify` 一步拾回）。

### 4.1 搜文件怎么走（当前形态）

本机没有自定义 `fd` 工具（`extensions/pi-fd.ts` 已删），路径是：

1. **`bash` 里写 `find` / `grep`** → `pi-reflag` 在 `tool_call` 上透明改写成 `fd` / `rg`（§3.7），agent 行为不变、拿到的结果更快。
2. **要按名字/内容搜又不想自己拼命令** → `omnify` 捞内建 `grep` / `find` 代理执行（它们只是被 lazy 隐藏，没有卸载）。
3. **`fd` 的全局 ignore**：`%APPDATA%\fd\ignore`（POSIX 写法 `~/.config/fd/ignore`），列 `node_modules dist build out target coverage __pycache__ vendor venv` 等编译目录。⚠️ 它**只在 git 仓库内认 `.gitignore`**，家目录 / `C:\Windows` 下依旧无效。
4. **慢 `find` 的兜底**：`bash` 侧靠 §5 铁律二的 30s 超时；`powershell` 工具**没有 timeout 参数**，别在里面裸跑 `find .`。


## 5. 使用纪律

**铁律一：装机前先审「它运行时会不会动 active 工具集」。** 只要扩展在会话中途调 `pi.setActiveTools`，工具集一变，请求前缀从第 0 个 token 起整段作废——本机实测 `cacheRead` 从 86016 掉到 1152，等于每次首次激活都吃一发全量 prefill（CHANGELOG §7.4）。所以只接受两种接入方式：① 常驻进 `defaultTools`（前缀恒定）；② 懒加载由 `omnify` 代理执行（只在 `session_start` 隐藏一次，全程不切 active 集）。

- **凡「运行时增删工具」的扩展一律不装、不启用、不写进 `defaultTools`**——哪怕它的工具本身很有用（要联网搜就用 `bash` 自己 curl，别为它掀缓存）。
- 审法：`read` 扩展源码搜 `setActiveTools` / `activeTools`；装完对比首请求的工具字节（口径见 §6），不一致就是它在散缓存。

**铁律二：所有命令都带超时。** pi 内建 `bash` 工具的 `timeout` 参数是**可选且无默认值**，不传就是永远跑。本机**没有**守卫扩展（原来的 `pi-bash-guard` 已删），所以靠习惯：

| 命令类型 | 自己传 `timeout` | 备注 |
|---|---|---|
| 搜索（`find` `grep` `rg` `fd`） | `30`–`60` | 大目录先 `-maxdepth` / `-prune` / `-xdev`，别裸跑整盘 |
| 构建 / 装依赖（`npm` `cargo` `docker build`…） | `1800`–`3600` | 给大不亏 |
| 其余 | `300` | 兜底 |
| 编辑器 / 分页器 / REPL / 前台服务（`vim` `less` `tail -f` `ssh` `python` 裸跑 `npm run dev`） | **别跑** | 它们永不返回，给 timeout 只是白等一个上限 |

- 超时后 pi 会 `killProcessTree` 整棵子进程树（Windows `taskkill /F /T`，POSIX `kill(-pid, SIGKILL)`）。
- **唯一会逃掉 kill 的写法**：`cmd &` / `nohup` / `setsid`——shell 立即返回，pi 清掉计时器，命令在工具返回后继续跑、没人再管。所以**别把搜索/构建后台化**。
- `powershell` 工具**没有 `timeout` 参数**，注入不了，里面的 `find` 是 Git 的 GNU find——**别在里面裸跑 `find .`**。

**`find` / `grep` 怎么处理**：由 `@piotr-oles/pi-reflag` 在 `tool_call` 上**透明改写**成 `fd` / `rg`（§3.7），不拒答、不 block。改不了的 `find` flag 原样保留让 find 自己报错。纪律上仍**优先直接写 `fd` / `rg`**——改写只是兜底。

> 原先的守卫（三档超时注入、无 path 的 `find` 直接 block、`find/grep` 转译表）已随 `pi-bash-guard` / `no-find.ts` 删除，细节见 CHANGELOG §12。

**0. 新装扩展一律不进常驻集**（硬规则）
   - 理由：常驻集每轮都进 prompt（`grep`+`find` 就要 +1350B ≈ 350 tok），而多数扩展一天用不到几次。
   - **只有这三类才加常驻**：① 高频工具（见 §6.3 的取舍）；② 覆盖内建工具的（`grep`/`find`/`edit` 需先过 `defaultTools` 闸）；③ 缺失后 agent 会“瘫”的（如 `bash`）。
   - 例外（唯一）：**`codemode`**。它是 pi 内建扩展且 `defaultActive:false`，**必须进 `defaultTools` 才激活**；又因合成 `builtin:` 源码无法被 `omnify` 代理（`nonLoadableSourceReason`），不常驻就没有任何取用入口。故按第三类「缺失即瘫」对待，破例常驻（§6.4）。
   - 其余：无。`grep` 也只是「需要时 `omnify` 激活」，不进名单（§6.3）。
1. **首字成本**：常驻集每轮都进 prompt；不在名单的工具靠 `omnify` 检索命中后**代理执行**（不把 schema 注入 active 集，见铁律一）。
2. **激活往返**：`omnify` → 执行，多 1–2 个模型轮次。搜索类工具建议常驻（见 §6.3）。
3. **大输出**（`bash` 直接抓页面 / 原始 HTML/JSON）全量进历史，会把前缀命中率打崩；用前先想清楚要不要落历史。
4. **改 `.md` 优先用 `edit` 精确替换**（§3.6），改动尽量带足上下文行以锚定位置。
6. **纯 UI 类扩展可以放心装**：`pi-tps` / `pi-one-ui` / `pi-dsh-pet` / `pi-pet-autostart` 这类只挂事件钩子、只注册命令的扩展，**不注册任何工具**，不进 `defaultTools`，wire 字节不变（§3.3 有 bench 实测：装宠物前后都是 5664B）。反过来，任何**注册工具**的扩展都要重新算 §6.3 那笔账。

**全局规则：本机不发任何提示词层规则**（定案，不恢复）

`~/.pi/agent/AGENTS.md` 与仓库 `config/agent/AGENTS.md` **都是 0B**。命令怎么写、文件怎么读，交给模型自己按当下的报错与上下文判断，不靠一段常驻 system 前缀去求它照做。

| 曾经的规则块 | 现在的替代 |
|---|---|
| Think: minimal sufficient reasoning… | 交给模型自己；pix-optimizer 的 caveman 管输出形状（§3.5） |
| Read files: no full reads by default… | 交给模型自己；常驻工具只留 `read edit write bash`（§3.1） |
| Search: 优先 fd/rg | `pi-reflag` 在 `tool_call` 上把 `find`/`grep` 改写成 `fd`/`rg`（§3.7），比求模型有效 |

- **canonical 是本仓库 `config/agent/AGENTS.md`，内容 0B**：`node install-project-config.mjs` 会把它拷进 `~/.pi/agent/AGENTS.md`，`--check` 比对 0B ↔ 0B。想重新加规则就写这个文件，别手改盘上那份。
- 它进的是**每轮 system 前缀**，所以**空文件本身就是收益**：system 少一段 = 每轮省 token，且少一个会漂的前缀源。
- 与扩展注入的规则是叠加关系、互不覆盖：现在 system 里只剩 pix-optimizer 的 caveman/ponytail 档位规则（§3.5）。

---


## 6. 首字 token 优化（结论）

**测量方式**（原手册的做法，需要复核时才跑）：沙箱（`PI_CODING_AGENT_DIR` 隔离 + junction 复用 npm/git/skills）+ mock OpenAI provider 抓**真实首请求字节**，再用真网关取 token 计数交叉验证。校准：**1 token ≈ 3.85B**。

**本机静态前缀基线**：`system 3026B + tools 2638B = 5664B ≈ 1.5k tok/请求`（5 个工具：`bash edit omnify read write`，**未含 codemode**）。含 codemode 后 tools 段取决于 `codemode.mode`：`"on"` ≈6.2KB（+≈400 tok）；`"only"` 最高 3000 tok（§6.4）。

> ⚠️ 这组数字是 **0.87.1 时期的实测**，pi 1.3.0 下**未复测**，按结论用、别按字节抠。完整表格、每步优化（`pi-lean-prompt` / `pi-shell` / `<docs>`+`<skills>` 压缩）、以及为什么第三类工具没有常驻，都在 CHANGELOG §13。

**当前取舍：内建默认 4 个 + `codemode`**（`read edit write bash codemode`），`grep` / `find` / `ls` / `powershell` 全部走懒加载，搜文件用 `omnify` 一步代理执行。

| 做法 | 代价 | 收益 |
|---|---|---|
| 搜索工具常驻（`grep` + `fd`） | tools 8317B，**比本机多 2653B ≈ 689 tok/请求** | 搜索 0 额外往返 |
| **本机：懒加载 + codemode `"only"`** | 每次搜索多 1–2 个模型轮次；codemode 前缀顶到 `inlineBudget`（默认 3000 tok） | **省 2653B ≈ 689 tok/请求**（本地端点，轮次几乎不花钱，只花时间） |

- **别压 `<rules>`**：单改 rules 块时落位正常，但与 docs/skills 同改会让 pi 把 rules 正文挪进 agent 文件段、条目与续行错配（pi 侧不确定性，不去碰）。
- **别压 `<tools>`**：那段由 pi 按当前 active 工具动态生成，压它就得自己重建工具表，容易与实际 active 集脱节。
- **要回退**：把 `"grep"` 加回两处 `defaultTools`（§3.1 / §3.2）即可，`/reload` 生效。
- 单工具 wire 字节：`grep` 846B、`ls` 472B、`find` 504B。
- 原理上**空 `AGENTS.md` 本身就是收益**：system 少一段 = 每轮省 token，且少一个会漂的前缀源（§5 全局规则）。

---

### 6.4 `codemode` 常驻：结论与配置（2026-11-13）

**结论：与 `pi-lazy-tools` 不冲突，可共存；启用方式只有一种（常驻裸名），且 `+` 前缀写法对它无效。本机模式选 `"only"`。**

**为什么 `+codemode` 无效（关键）**：lazy-tools 的 `resolveDefaultTools()` 只 `extractStringArray()`，**原样保留 `+`/`-` 前缀不去符号**，把 `"+codemode"` 当字面量放进 resident 名单，再 `allToolNames.filter(name => !resident.has(name))` 算 lazy 集。而 `allToolNames` 里只有裸名 `codemode`（工具名不带 `+`），`"+codemode"` 永远不命中 → **codemode 照样被隐藏**。pi 侧的 `+name` 相对写法只有 pi 自己解析，lazy-tools 不认。

**所以必须写完整裸名**：`"defaultTools": ["read","edit","write","bash","codemode"]`（绝对写法 = pi 整体替换选择，两边语义一致）。`pi --tools +codemode` 只在单次启动有效，持久配置一律写裸名。

**为什么 codemode 必须常驻、没有第二入口**：
- codemode 是 `builtin:codemode` 扩展，`defaultActive:false`（注册不激活）→ **不写 `defaultTools` 就永远不在 active 集**，模型看不到。
- 它的 `sourceInfo` 是合成 `builtin:` 路径（`getSyntheticPathSource` → `source:"builtin"`），被 lazy-tools 的 `nonLoadableSourceReason()` 判为不可加载 → **`omnify` 代理不了**（同 `ls`/`powershell` 一类）。
- 两条合起来 = 常驻是唯一启用方式（§5 第 0 条破例，按「缺失即瘫」归第三类）。

**模式 `"only"`（本机 2026-11-13 起选此，与 `"on"` 对照）**：
- `"only"`：把全部工具从模型侧隐藏、全列进 codemode 描述，前缀顶到 `codemode.inlineBudget`（默认 **3000 tok**）。**代价最大，但换来「模型只认 codemode + omnify 两条入口」，工具表完全由 codemode 描述与脚本内 `searchTools()`/`describeTool()` 动态发现**，与 lazy-tools「隐藏 + omnify 单入口」方向一致（工具都不直接暴露）。
- `"on"`（默认）：codemode 描述只列 non-direct 工具；被 lazy 藏掉的不在 callable 集 → 不会重复列。每个常驻工具尾部追加一行 `Codemode: tools.x(...) resolves to ...`（约 12 tok × 5）。
- **若嫌 `only` 太贵**（可达 3000 tok），回退到 `"on"`：删 `codemode.mode` 键（保持默认），`/reload` 生效。

**成本（`"only"`，实测 pi.exe 实现）**：取决于 `inlineBudget`（默认 **3000 tok** 上限）。内置工具全量声明实测约 800–1200 tok；有 MCP server 时顶到 3000。而 `"on"` 下仅 ≈+400 tok（工具描述主体 ≈355 + 常驻工具尾部备注 ≈60）。**`"only"` 是把预算从 ~400 放大到最高 3000 tok 的开关，按需取舍。**

**`codemode.inlineBudget` 不写**（保持默认 3000）：改小会截断工具声明列表（改用 `searchTools()`/`describeTool()` 补齐），改大只会更贵；默认即平衡点。

**与 MCP / deferred 的接合点（零成本组合）**：MCP 工具默认 `exposure:"deferred"`，lazy-tools 的 `isAlwaysCallableExposure()` 视 `codemode`/`deferred` 为「注册即可调、与 active 集无关」→ 不隐藏；codemode 脚本可经 `tools.<name>` 直调。这是 codemode + lazy-tools + MCP 唯一零请求侧变化的组合路径，无冲突。

**与 lazy-tools 的接合点**：lazy-tools 的 `isAlwaysCallableExposure()` 把 `codemode`/`deferred` 视为「注册即可调、与 active 集无关」；且 codemode 是 builtin 合成源码（`nonLoadableSourceReason` 判不可加载）→ **lazy-tools 不会隐藏它、omnify 也代理不了它**。故 codemode 只能常驻，与 lazy-tools 无争夺；两者唯一的叠加效应是 token（§6.4 成本）。

## 7. 删改记录

所有卸载/冲突/遗留/体检实录迁移至 [`CHANGELOG.md`](./CHANGELOG.md)（§7 全部 + §9 实录）。本 README 只保留安装清单与必做配置。

## 8. 体检与排障

### 8.1 体检脚本（都在仓库根，手跑）

| 脚本 | 干什么 | 期望 |
|---|---|---|
| `node check-readme-tables.mjs` | readme 表格列数（编辑时插/漏 `\|` 靠它兜住） | 一致 exit 0 |
| `node install-local-extensions.mjs --check` | 本地扩展副本与仓库是否逐字节一致；孤儿报 `[orphan]` | 一致 exit 0 |
| `node install-project-config.mjs --check` | `config/` 与 pi 实际读取位置是否一致（CRLF/LF 归一后再比） | 一致 exit 0 |
| `node fix-lazy-tools-notes.mjs --check` | lazy-tools 的 DOCS_NOTE 路径补丁是否被 `pi update` 冲掉 | 基线已修好 exit 0 |
| `node fix-proper-lockfile-proxy.mjs --check` | proper-lockfile 补丁在位（防 jiti Proxy 崩 pi） | 一致 exit 0 |
| `node fix-pi-one-ui-theme.mjs --check` | pi-one-ui 内置主题里是否还有 schema 不认的 `colors` 键；npm 与 git 两份副本一起扫 | 合规 → `[skip]` / exit 0；`[待修补]` exit 1 时不带 `--check` 重跑即修 |
| `node sync-drama-skills.mjs check` | 旧 drama 线镜像是否漂移（`CUSTOM` 已清空，现在恒无漂移，仅为历史保留） | 无漂移 exit 0 |

> `.sc-test/` 目录（`check-ext-errors.mjs` 等一次性探针）属 gitignore、**不入库**，升级/清理会丢，别当长期工具。

**改完必做**：`/reload` → 看 TUI 有无 `extension_error` → `pi --no-session -p "reply with: ok"` 冒烟 → 跑上表前三个 `--check`。

### 8.2 排障表

| 症状 | 原因 | 处置 |
|---|---|---|
| 扩展报 `Tool "x" conflicts with ...` | 两个扩展抢同一工具名 | 二选一卸载（CHANGELOG §7.1） |
| 懒加载报 `Cannot find module` | lazy 执行层地基缺失（版本要与 pi 本体一致，别写死） | `npm i --prefix ~/.pi/agent @earendil-works/{pi-coding-agent,pi-tui,pi-ai}@$(pi --version \| grep -oE '[0-9]+\.[0-9]+\.[0-9]+')` |
| 工具调用不到、wire 上也没有 | 内建工具不在 `defaultTools`（不注册），扩展工具不在其中（被 lazy） | 改 `defaultTools`（§3.1），`/reload` |
| `fd` / `rg` 报找不到 | `pi-reflag` 改写后依赖这两个二进制 | `npm i -g fd-find ripgrep`，或确认 pi 自带的 `~/.pi/agent/bin/` 在 PATH |
| 会话/文件撤销 | `pi-edit-guard` / `pi-checkpoint` 均已卸载 | 文件级靠 git 或改前先 `read`；会话级 `/undo` 不再可用 |
| agent 没有 shell | `defaultTools` 里没有 `bash` | 写 `bash` 进两处 `defaultTools`（§3.1 / §3.2） |
| 宠物没起来 / 凭空消失，`log.txt` 里每行都是 `窗客户端 0` | 窗进程活着但渲染进程崩了 = 僵窗 | 上游已修（CHANGELOG §7.25）；临时 `/pet-auto restart`；扩展那层 60s 后自己换（§3.3） |
| `/pet` 提示命令不存在 | 只 `npm i -g` 装过，pi 不扫全局 `node_modules` | `pi install git:github.com/BeYourDreams/pi-dsh-pet` → `/reload`（§3.3） |
| 宠物窗口不弹 | 首次要下 Electron ≈100MB；或自动启动被关了 | 看启动提示；`/pet-auto status` 看开关；关掉了就写回 `{"autostart": true}` |
| `pi list` 里某行带 `(filtered)` | 该包在 `packages` 里写成 object form 且注明了要屏蔽的部分 | **预期**（本机只有 `pi-dsh-pet (filtered)`，§3.3） |
| 压缩后首轮命中低 / `cacheRead: 0` | 内置压缩的前缀与活会话不续写，必然 0 | **正常现象**（CHANGELOG §7.13） |
| 切了 caveman / ponytail 档位后本轮 `cacheRead: 0` | 换了 system 前缀文本，首轮必然重算 | **正常**，别反复切；第二轮起恢复（§3.5） |
| 输出突然变碎句 / 掉冠词 | caveman 档位生效（ASD-STE100 两层，含 L1 选词断句） | `/optimizer` 开面板调档（**无 `/optimizer <mode>` 文本参数形**）；值在 `pix.json`（§3.5） |
| 输出突然变「懒」/ 开始砍功能（YAGNI 口吻） | ponytail 档位生效（本机默认 `ultra`） | `/optimizer` 调档；只影响「写什么」，验证/错误处理/安全不裁 |
| bash 命令前莫名多出 `rtk ` 前缀 | RTK 执行层在改写命令 | **预期行为**；`/optimizer` 里关掉即停；二进制缺失时不改写（§3.5） |
| 每条 bash 输出前带 `[rtk] /!\ No hook installed` | rtk 找的是 Claude 风格 hook，pi 走 pix 的 `tool_call` 改写 | `%APPDATA%\rtk\config.toml` 的 `[hooks] suppress_hook_warning = true`（先 `rtk config --create`，CHANGELOG §7.24） |
| 第一次开 pi 时 footer 出现下载 `rtk` 二进制 | RTK 开着且 PATH / `binary.json` 都找不到 `rtk` | **预期**，下到 `~/.pi/agent/bin` 并校验 checksum；离线设 `PI_OFFLINE` 跳过 |
| **浅色终端里 footer 的 cwd 发白** | `cwd` 是 pi-one-ui 唯一默认用裸 ANSI 色的字段，退到 `bold cyan` | `pi-one-ui.json` 写 `{"colors":{"cwd":"accent"}}` 后 `/reload`（§3.8）。**别改主题、别钉 hex** |
| 开机 / `/reload` 弹 `[Theme conflicts] Invalid theme …` | pi ≥1.0 主题 schema 收严，旧 pi-one-ui 内置主题非法 | `node fix-pi-one-ui-theme.mjs` 后 `/reload`（§8.1） |
| pi 整个进程崩，只留 `TypeError: Proxy handler's 'get' result …`（frame 指向 `proper-lockfile/lib/mtime-precision.js`） | jiti interop 把 mtime 缓存包成 Proxy，第二次加锁触发 JSC 不变量 | `node fix-proper-lockfile-proxy.mjs`（幂等）；升 pi 本体后复发就重跑（CHANGELOG §7.14） |
| `pi --no-session -p ...` 不退出（shell 报 exit 124） | 桌宠的 `/feed` 长连接或宿主进程挂着父会话 | 用 `timeout 70 pi ...` 包一层（§3.3 已屏蔽上游扩展，刷屏的重连日志也没了） |
| 装/卸包时 npm 打 `EBADENGINE` | 某包声明的 engine 高于本机 node 24.16.0 | **可忽略**（引警告）；本机当前 9 个包都不触发 |
| GitHub 不通 / TLS 握手失败 | 国内出口或自定义根 CA 劫持 | 走 `gh-proxy.com` 镜像（§2.1）；rtk 二进制用 `curl --ssl-no-revoke`（§3.5） |

### 8.3 磁盘布局速查

| 路径 | 内容 |
|---|---|
| `~/.pi/agent/settings.json` | `packages` 注册表 + `defaultTools`（含 dsh-pet 的 object form 屏蔽，§3.3）+ §3.4 的备忘项 |
| `~/.pi/agent/extensions/` | 本地扩展副本 + 各扩展的全局配置（`pi-dsh-pet.json` 等；**只放这里，放 agent 根下不生效**） |
| `~/.pi/agent/state/` | 跨会话记账，现只剩 `pi-pet-autostart.json` + `spawn-log.txt` |
| `~/.pi/agent/git/` | git 源扩展：`pi-lazy-tools` / `pi-dsh-pet`（扩展被屏蔽）/ `pi-one-ui` |
| `~/.pi/agent/npm/node_modules/` | npm 源扩展 |
| `~/.pi/agent/npm/package.json` | **6 个 dep**（无 `allowScripts` 键，CHANGELOG §10 · 原 3.1） |
| `~/.pi/agent/pix.json` | `@xynogen/pix-optimizer` 三档状态（§3.5） |
| `~/.pi/agent/pi-one-ui.json` | pi-one-ui 覆盖项（`colors.cwd`，§3.8） |
| `~/.pi/agent/bin/` | RTK 官方二进制（§3.5）+ pi 自带 `fd` |
| `%APPDATA%\rtk\config.toml` | **rtk 二进制自己的配置**（与 pi 无关），见排障表 |
| `~/.pi/agent/config/` | **空**（新装带 `startupConfig` 的包才会写） |
| `~/.pi/agent/mcp-onboarding.json` | 内建 MCP 引导向导状态，**勿手改** |
| `<仓库>/config/pi-project/settings.json` | 项目级配置 canonical 源（生成物 `.pi/settings.json` 由此拷入） |
| `<仓库>/config/agent/AGENTS.md` | 用户级规则 canonical 源（**0B**，§5 定案不发规则） |
| `~/.pi/agent/sessions/**/*.jsonl` | 会话历史 |

**生效方式**：改配置或扩展后 `/reload`（不重启会话、不丢历史）。
