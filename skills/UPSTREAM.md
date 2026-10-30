# drama 技能：上游快照与吸收流程

## 结论先说

**本仓库 `skills/` 是 drama 技能的唯一更新源。不再运行上游安装器。**

```bash
node sync-drama-skills.mjs install   # 安装 / 更新到 ~/.pi/agent/skills/（精确镜像）
node sync-drama-skills.mjs check     # 体检漂移
node sync-drama-skills.mjs save      # 抢救：把全局侧的手改回收进本仓库
```

**禁止** `npx skills add zenstory-ai/drama-skills -y -g`：它按技能整目录覆盖全局目录，会
（1）把本地补丁静默盖回上游版本，（2）重新装回我们已卸载的三件
`short-drama-write` / `short-drama-storyboard` / `short-drama-video-prompts`。
`install` 会把这三件当"退役技能"自动删掉，但不必主动制造这次冲突。

## 上游快照

| 项 | 值 |
| --- | --- |
| 仓库 | `github.com/zenstory-ai/drama-skills` |
| 本机正本 clone | `D:\AI\drama-skills`（**只作参考，不用于安装**） |
| 快照版本 | `v0.9.2`（`VERSION` 文件） |
| 快照 commit | `91fddb2`（`feat(storyboard,video-prompts): 打戏按回合拆镜，打到人的一下用同侧机位遮住接触点 (#230)`） |
| 记录日期 | 2026-10-29 |

## 本仓库相对快照的定制

| 技能 | 定制 |
| --- | --- |
| `short-drama-pro` | **新增**。复刻并取代原 write / storyboard / video-prompts 三件：生成就绪五问、动作因果链与朝向绑定（SCR-23 / SHT-30 / VID-28）、单镜 ≤12 秒上限（SHT-31，含机械检查）、**正常语速 2 个可发声字/秒且停顿另计的台词预算（PAC-01 / PAC-02，`references/pacing.md`）**、全部深度参考、三阶段检查器与 `pro_check.py` |
| `duration_estimate.py`（pro） | 本仓库定制：未声明语速时返回 `proposed_pacing_starting_point`（2.0 字/秒）；声明 `format.pacing.pause_seconds_per_punctuation_mark` 时按标点个数累加 `pause_seconds`（`selftest_write` 17 项） |
| `short-drama`（router） | 路由表、`knowhow-index`、`creator-workflow` 改指 `$short-drama-pro` |
| 其余七件 | 内部引用改指 `$short-drama-pro`（共 55 处） |
| `storyboard_check.py` | 自维护。上游 v0.9.2 把旧 JSON 检查器移出技能（改存 `tests/legacy/`，只服务历史回归），本仓库保留并继续用，含 SHT-31 单镜 ≤12 秒上限 |
| `container_check` / `motion_timing_check` / `music_spec_check` / `voice_sheet_check` | 同上：上游已移出技能，本仓库保留在 pro 供三阶段检查器调用 |
| `screenplay_index.py` | 修上游消息缺陷：裸写 `[转场]`（标签无正文）原报「不支持生产标签」，现报 `production_tag_missing_body`（`selftest_write` 15 项） |
| 已卸载 | `short-drama-write` / `-storyboard` / `-video-prompts`（内容并入 pro；备份在 `~/.pi/agent/skills-backup/*.uninstalled-20261018-204641`） |

## 人工吸收上游新版本（可选，不进 CI）

1. `cd D:\AI\drama-skills && git pull`，记下新 `VERSION` 与 commit，更新本文件的快照表；
2. 看上游改了什么：`git diff 91fddb2..<新 commit> -- skills/`（分页读，按技能过）；
3. **只挑有价值的改动手工落到本仓库 `skills/`**，注意两点：
   - 上游若改了老名字的 write / storyboard / video-prompts，改动要落到 `short-drama-pro` 对应阶段
     （`references/stage-*.md` 或 `references/{script,storyboard,video}/`）；
   - 上游若动了 `storyboard_check.py`、`screenplay_index.py` 等脚本，先 diff 出上游那几行，
     再在本仓库副本上重放（本仓库副本已含 12 秒上限与 bare-tag 修复，别整文件覆盖）；
4. 自检：`short-drama-pro/scripts` 四组（`pro_check` / `selftest_write` / `selftest_storyboard` /
   `selftest_video`）+ router `selftest.py`，再 `node sync-drama-skills.mjs check`；
5. `node sync-drama-skills.mjs install` 应用到全局，`git commit` + `git push`。

## 吸收记录

### v0.9.0 → v0.9.2（2026-10-29，`dafe80e` → `91fddb2`，16 个 commit / 83 文件）

按"能否直接覆盖"分三类处理：

**A. 脚本：直接覆盖（本仓库零定制，已验证 diff 为 0）**

`creator_markdown_check.py` / `creator_views.py` / `project_tool.py` / `dashboard_server.py`
+ Dashboard 的 `app.js` / `styles.css`，以及各技能的 `edit_tool.py`、`production_tool.py`、
`episode_intake.py`、`novel_index.py`、`duration_estimate.py`。

带来三项能力：跨文档检查 `--partial`（只核对已有文档，缺的文档相关规则跳过，取代"等五份齐备"）、
`video_model_profile` 的 `profile_notes`（列出各自有效、合起来做不到的设定，如平均镜长低于目标
模型原生最短时长、设了单集目标时长却没有语速）、`format.episode_count` 与 `multi_shot_containers`
决策写入。

**B. 脚本：覆盖后重放补丁（本仓库有本地修改）**

- `screenplay_index.py`：上游新版仍无 bare-tag 修复，覆盖后重放 `BARE_TAG_RE` +
  `production_tag_missing_body`；两处 `owner` 改 `short-drama-pro`。上游新版带来的季前缀场景 ID、
  `[OS]/[VO]` 台词可带表演提示一并收入。
- router `selftest.py`：三处 `owner` 改 `short-drama-pro`。
- `storyboard_check.py` 与四个 legacy 检查器：**不跟上游的删除**（详见下条），保持本仓库版本。

**C. 不跟：上游把旧 JSON 检查器移出技能**

`#212 refactor(skills)` 把 `storyboard_check.py`、`container_check.py`、`motion_timing_check.py`、
`music_spec_check.py`、`voice_sheet_check.py`、`asset_check.py`、`image_prompt_check.py`、
`review_check.py` 移到 `tests/legacy/`（改名，**内容 0 改动**），并把 assets / image-prompts /
review 三个技能的 `scripts/` 与 `selftest.py` 整个删掉。

理由：本仓库的检查器不是"历史回归件"，而是 pro 三阶段检查器（`pro_check.py`）的活跃依赖，
且含本仓库自加的 SHT-31 单镜 ≤12 秒上限。**跟着删会让 pro 的检查能力塌掉**，因此三个技能的
`scripts/` 与 `selftest.py` 全部保留，自检照跑。

**D. 文档：覆盖后重放引用改名**

`creator-documents.md`、`creator-workflow.md`、`knowhow-index.md`、`SKILL.md`、`reference-roles.md`
及各技能 `references/`。上游 33 处仍写旧技能名，覆盖后统一改指 `$short-drama-pro` 并带阶段标注
（如 `$short-drama-pro（剧本阶段）`），与既有 55 处风格一致。`stage-*.md` 与 `handoff.md` 里的旧名
是溯源说明，保留原样。

上游同期的内容改动（缺图时默认写 `PLAN-...` 挂图计划并照常交付视频提示词、打戏按回合拆镜、
站位分两层写、Seedance 2.0 上限与首尾帧转场、示例改合成内容）随文档覆盖一并收入。

**自检**：pro 四组（3+15+17+10）、router 17、其余七件（9+5+10+5+8+8+1）全通过；
`install` 后 `check` 无漂移。

## 与 router / 生产链的关系

`short-drama`（router，含 `creator_markdown_check.py`、Dashboard、项目工具）仍在九件之内，
跨文档结构终审走它；创作三阶段（剧本 / 分镜 / 视频提示词）走 `$short-drama-pro`。
两边的文档语法一致，产物可以直接互为输入。
