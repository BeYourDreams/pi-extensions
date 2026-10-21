---
name: short-drama-pro
description: 自包含的 AI 短剧创作链（剧本→分镜→视频提示词），复刻 short-drama 套件三个创作阶段并合入本项目补丁：动作因果链与朝向绑定（SCR-23/SHT-30/VID-28）、单镜 ≤12 秒且 10 秒最佳的镜长规则（SHT-31，含机械检查）。用户要生成短剧/漫剧剧本、拆分镜、写文生/图生视频动作提示词，或点名要求「动作符合物理常理」「镜长上限」时使用；不生成媒体，不管资产图/终审/剪辑（交回对应技能）。已取代并卸载 upstream 的 write/storyboard/video-prompts 三件；drama-skills 后续升级覆盖不影响本技能。
license: MIT
---

# 短剧创作 Pro（复刻 + 补丁）

复刻自 `$short-drama-write` / `$short-drama-storyboard` / `$short-drama-video-prompts` 三个创作阶段，
把本项目的动作物理与镜长补丁内建为默认纪律，并搬入原三阶段的全部深度参考，
使本技能不依赖上游任何文件。产物路径与标题语法与上游一致，
资产、生产、剪辑、终审仍用 `$short-drama-assets|produce|edit|review`。

## Quick Start

```text
用 $short-drama-pro 把这个大纲做成 EP001 的剧本、分镜和视频提示词，动作要符合物理常理，单镜不超过 12 秒
```

## 全局硬约束（补丁总览）

| 约束 | 内容 | 出处 |
| --- | --- | --- |
| 总长度 | 剧/集总长度**不设上限**；讲不完加镜头，不加时长 | SHT-31 |
| 镜长 | 单镜 ≤12 秒（机械检查 `SHT31`），10 秒左右最佳（设计目标，不硬凑）；目标模型原生区间更紧时以原生为准 | SHT-31 |
| 位移动作 | 朝向绑定：写明胸/背朝向哪个锚点、移动方向、领先手脚、界面开向、终点落位；禁止裸位移动词 | SCR-23 / SHT-30 / VID-28 |
| 动作容量 | 一拍 = 一条链 ≤ 两个物理步骤；超载链拆拍、从链中段进入、或 `[转场]` 明确省略 | SCR-23 |
| 高风险动作 | 剧情不压微表情/厘米级位移/单指精细/空中接取上；关键信息留第二载体 | SCR-23 |
| 跨镜因果 | 前镜停在可见的未完成原因，后镜从对应物理结果开始，朝向与部位两端一致 | SHT-30 |
| 起始帧核对 | 图生视频默认延续首帧朝向；朝向与移动方向冲突要么把转身写成第一拍给秒，要么回分镜改关键帧 | VID-28 |
| 内容安全 | 平台对 `剧本.md` 做文本检测，命中即整份退回「文本未通过内容安全检测」：伤害/血腥/违禁物/擦边/脏话/真实专名/政治宗教/未成年人受害一律换动作与反应，不换剧情 | SAF-01 |

## 工作流

1. **单集契约**：观看承诺、谁要什么、阻力、当集兑现、退出状态。输入给出的事实、`必须/禁止`
   优先于本技能一切手艺默认；不为检查表补造题面没有的机关。
2. **写剧本** → `剧集/<EP>/剧本.md`：按[剧本阶段](references/stage-script.md)。每场当场过
   生成就绪七问（朝向绑定/容量预算/高频动作/空间锚点/因果可见/场景视觉事实/道具与文字可读），
   并按[内容安全](references/stage-script.md#9-平台内容安全saf-01)（SAF-01）把敏感字面换成动作与反应。
3. **剧本机械检查**：`python3 scripts/pro_check.py "剧集/<EP>/剧本.md"`——裸位移动词、
   超载拍、无原因结果、`SAF01_HIGH_RISK_TERM` 内容安全硬词会被点名；修到干净再进分镜。
4. **拆分镜** → `剧集/<EP>/分镜.md`：按[分镜阶段](references/stage-storyboard.md)。每镜先按
   ≤12 秒（10 秒最佳）预分动作与对白；装不下的链在可见状态闭合点拆镜。
5. **分镜机械检查**：`python3 scripts/pro_check.py "剧集/<EP>/分镜.md"`——镜长超 12 秒直接报错
   （等价 SHT31），位移动作缺朝向会被标记。
6. **写视频提示词** → `剧集/<EP>/视频提示词.md`：按[视频阶段](references/stage-video-prompts.md)；
   Seedance/H3/Wan 的素材槽位与语法细节见 [references/video/](references/video/) 对应方言文件。
7. **交稿三查**（只读成稿）：观众查（承诺是否收到）、机制查（本集机关是否在边界内运转）、
   执行查（把动作段交给"看不见画面的人"演一遍，必须自己发明朝向手脚的就是没写完）。
8. 用户要整集就整集批次续跑；定点修订保留无关段落与既有 ID；会改变剧情走向的取舍交给用户。

## 按需知识

默认只读本 SKILL 和命中的阶段文档；同一请求跨阶段时逐阶段读：

- 剧本格式、七问细则、因果链与容量换算、高风险改写表、场景/道具/表面文字详细描述（SCR-24）：
  [剧本阶段](references/stage-script.md)
- 镜头字段、拆镜规则、轴线与冻结关键帧：[分镜阶段](references/stage-storyboard.md)
- 起止状态正文、朝向绑定写法、秒段与声音：[视频阶段](references/stage-video-prompts.md)
- 与上游套件的文档兼容、字段交接、能力分界：[交接与兼容](references/handoff.md)
- 深度参考（已搬入）：[references/script/](references/script/)、
  [references/storyboard/](references/storyboard/)、[references/video/](references/video/)

## 完成

点名范围成稿：剧本七问过检且 `pro_check` 剧本模式干净；分镜每镜 ≤12 秒、职责唯一、
起止状态含朝向、`pro_check` 分镜模式无 SHT31 报错；视频提示词逐镜正文完整实现所属镜头的
「起点 → 唯一动作 → 终点」且重述终点朝向。三查通过后交付；末尾一次报告节奏与真实未决选择。

## 安装维护

- **自包含**：本技能不引用任何上游路径——深度参考在 `references/{script,storyboard,video}/`，
  检查器与估时工具在 `scripts/`，样例在 `examples/`。上游 `npx skills add zenstory-ai/drama-skills -g`
  重跑只会重写它自带的 11 个 `short-drama-*` 目录，碰不到本目录；需要重放时从项目仓库
  `skills/short-drama-pro` 拷回（`node sync-drama-skills.mjs install`）。
- **自检**（需 Python 3.9+；Windows 无 `python3` 时用 `python`）：

  ```text
  python3 scripts/pro_check.py --selftest          # 镜长上限/裸位移/超载链/缺朝向
  python3 scripts/selftest_write.py                 # 剧本索引与估时
  python3 scripts/selftest_storyboard.py            # 分镜登记与 SHT-31 镜长上限
  python3 scripts/selftest_video.py                 # 配乐规格校验
  ```

- **工具入口**：`screenplay_index.py` / `duration_estimate.py`（时长与 `vo_share`）、
  `storyboard_check.py`（含 `--shot-duration-cap`，默认 12.0）、`voice_sheet_check.py`、
  `motion_timing_check.py`、`container_check.py`、`music_spec_check.py`。
- 跨文档结构终审仍用 router 的 `$short-drama` → `scripts/creator_markdown_check.py`。
