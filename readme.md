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

> 另：**本地扩展 1 个** `extensions/pi-pet-autostart.ts`，由 `node install-local-extensions.mjs` 同步（§1.2）。
> 扩展的具体版本号不锁、不记在本清单里：安装命令一律不带 `@版本号`（取 npm 最新），要查本机实际版本跑下面那段脚本。

### 1.2 本地扩展（1 个）

仓库 `extensions/` 是 canonical 源，`node install-local-extensions.mjs` 幂等同步到用户目录（`--check` 只体检、有漂移 exit 1）。

| 文件 | 作用 |
|---|---|
| `pi-pet-autostart.ts` | 让 `pi-dsh-pet` **默认常驻且整机只留一只**：TUI 会话一开就派发 `/pet`，已有宠物窗就复用不新开，跨会话/多开 pi 也只一只。不注册工具，只挂 `session_start` + `/pet-auto` 开关。配置见 [配置 §3.3](./docs/配置.md) |

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

> **skills 不走 `pi update`**：`400-duanju-shuangdian` / `short-drama-factory` 是独立 git clone，要更新就在它自己目录 `git pull`（详见 §1.3）。`sync-drama-skills.mjs` 的 `CUSTOM` 已清空，只对旧 drama 线有作用。

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

