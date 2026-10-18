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
| 快照版本 | `v0.9.0`（`VERSION` 文件） |
| 快照 commit | `dafe80e`（`docs: align current drama guides with creator workflow (#209)`） |
| 记录日期 | 2026-10-18 |

## 本仓库相对快照的定制

| 技能 | 定制 |
| --- | --- |
| `short-drama-pro` | **新增**。复刻并取代原 write / storyboard / video-prompts 三件：生成就绪五问、动作因果链与朝向绑定（SCR-23 / SHT-30 / VID-28）、单镜 ≤12 秒上限（SHT-31，含机械检查）、全部深度参考、三阶段检查器与 `pro_check.py` |
| `short-drama`（router） | 路由表、`knowhow-index`、`creator-workflow` 改指 `$short-drama-pro` |
| 其余七件 | 内部引用改指 `$short-drama-pro`（共 55 处） |
| `screenplay_index.py` | 修上游消息缺陷：裸写 `[转场]`（标签无正文）原报「不支持生产标签」，现报 `production_tag_missing_body`（`selftest_write` 15 项） |
| 已卸载 | `short-drama-write` / `-storyboard` / `-video-prompts`（内容并入 pro；备份在 `~/.pi/agent/skills-backup/*.uninstalled-20261018-204641`） |

## 人工吸收上游新版本（可选，不进 CI）

1. `cd D:\AI\drama-skills && git pull`，记下新 `VERSION` 与 commit，更新本文件的快照表；
2. 看上游改了什么：`git diff dafe80e..<新 commit> -- skills/`（分页读，按技能过）；
3. **只挑有价值的改动手工落到本仓库 `skills/`**，注意两点：
   - 上游若改了老名字的 write / storyboard / video-prompts，改动要落到 `short-drama-pro` 对应阶段
     （`references/stage-*.md` 或 `references/{script,storyboard,video}/`）；
   - 上游若动了 `storyboard_check.py`、`screenplay_index.py` 等脚本，先 diff 出上游那几行，
     再在本仓库副本上重放（本仓库副本已含 12 秒上限与 bare-tag 修复，别整文件覆盖）；
4. 自检：`short-drama-pro/scripts` 四组（`pro_check` / `selftest_write` / `selftest_storyboard` /
   `selftest_video`）+ router `selftest.py`，再 `node sync-drama-skills.mjs check`；
5. `node sync-drama-skills.mjs install` 应用到全局，`git commit` + `git push`。

## 与 router / 生产链的关系

`short-drama`（router，含 `creator_markdown_check.py`、Dashboard、项目工具）仍在九件之内，
跨文档结构终审走它；创作三阶段（剧本 / 分镜 / 视频提示词）走 `$short-drama-pro`。
两边的文档语法一致，产物可以直接互为输入。
