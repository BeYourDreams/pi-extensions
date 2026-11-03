---
name: short-drama-pro
人物站位衣着要跨镜一致」「每场不超过 10 秒/要能直接喂 5 秒·10 秒档模型」时使用；
license: MIT
---

# 短剧创作 Pro（复刻 + 补丁）

复刻自 `$short-drama-pro（剧本阶段）` / `$short-drama-pro（分镜阶段）` / `$short-drama-pro（视频阶段）` 三个创作阶段，
把本项目的动作物理与镜长补丁内建为默认纪律，并搬入原三阶段的全部深度参考，
使本技能不依赖上游任何文件。产物路径与标题语法与上游一致，
资产、生产、剪辑、终审仍用 `$short-drama-assets|produce|edit|review`。

## Quick Start

```text
用 $short-drama-pro 把这个大纲做成 EP001 的剧本、分镜和视频提示词，动作要符合物理常理，单镜不超过 4 秒
```

## 全局硬约束（补丁总览）

| 约束 | 内容 | 出处 |
| --- | --- | --- |
| 总长度 | 剧/集总长度**不设上限**；讲不完加镜头，不加时长 | SHT-31 |
| 镜长 | **片段时间 = 动作 + 对话算出来的秒数**（可发声字 ÷ 该句档位 + 停顿 + 动作拍 × 1 秒），不是先挑数字再塞台词；**默认单镜 4 秒**——算出来不足 4 秒按 4 秒算，写了更短按默认算；单镜 ≤4 秒硬顶（机械检查 `SHT31`，声明装不下算出来的秒数同样点名）；目标模型原生区间更紧时以原生为准；项目要更短的档（如 3 秒快切）时检查加 `--shot-cap <秒>`，只能收紧、硬顶不抬 | SHT-31 |
| 生成单元 | **一次生成 = 一镜**：一条提示词只挂一个 `SHOT-`（≤4 秒），正文只写这一镜。`## EP001-SC001` 是剧本的**场次**切分，不是生成单元——把整场丢给视频模型，它会照标题自行切段，产出一条十几秒的长片：动作挤在头两秒、台词赶词、后半段空转。给模型的是单条 `### 可复制提示词`，不是《剧本.md》也不是整份提示词文件；方言明确支持多镜容器时才合并，且每镜仍 ≤4 秒（机械检查 `VID29_SCENE_AS_GEN_UNIT` / `VID29_GEN_UNIT_NOT_ONE_SHOT`） | VID-29 |
| 生成段 | 《分镜视频剧本.md》把镜按 **≤10 秒**的生成段收拢：一段一条请求，**不跨场**、段内单镜仍 ≤4 秒；段末终点 = 下段起点（机械检查 `SEG10_*`） | SEG-10 |
| 剧本场单元 | **《剧本.md》一场 = 一条 ≤10 秒视频单元**（1–2 个短段），场数由剧情量决定、不固定 8–11 场；**一段 = 一次动作块或一句台词**，对白与动作不混段，括注里的动作占时超过 1 秒就删出另起段。估算超 10 秒**拆场**：不合并段落、不删台词、不提语速——成片被加速就口齿不清、没法看 | PAC-06 / SCR-25 |
| 位移与承载动作 |
| 动作容量 | 一拍 = 一条链 ≤ 两个物理步骤；超载链拆拍、从链中段进入、或 `[转场]` 明确省略 | SCR-23 |
| 高风险动作 | 剧情不压微表情/厘米级位移/单指精细/空中接取上；关键信息留第二载体 | SCR-23 |
| 跨镜因果 | 前镜停在可见的未完成原因，后镜从对应物理结果开始，朝向与部位两端一致 | SHT-30 |
| 起始帧核对 | 图生视频默认延续首帧朝向；朝向与移动方向冲突要么把转身写成第一拍给秒，要么回分镜改关键帧 | VID-28 |
| 语速基线 | 台词发声按 **2 个可发声字/秒**估算；开口、句内、句间与收尾停顿另计并累加。模型实测的更快速率（H3 ≈4.1、Wan 3.0 ≈4.6）只用于判断赶词与截断风险，不作预算。装不下就拆镜/删动作/回剧本减词/加镜头，不提速、不截断、不静默删词 | PAC-01 / PAC-02 |
| 逐句语速与表演 | 2 字/秒是常速预算值不是全片统一速率：按剧情给每句定档（沉缓 1.2–1.5 / 常速 2.0 / 急切 2.5–3.2 / 崩溃 3.2–4.0）并用该档重算秒数。情绪词只作定调锚，旁边必须至少有两根可执行杠杆：**速度档 / 停顿位 / 音色语气**；杠杆写在逐字围栏外，不靠「自然语速」这类词交差 | PAC-03 / PAC-04 / PAC-05 |
| 人物一致 | 模型只看本条正文：每镜重述入画者的**站位（相对锚点）、胸/背朝向、衣着主色与形制（入画部分）、两手与物件状态**；未变写「仍」，变了写变化与落点；文生视频自带全部，只挂地理参考时人物外观仍得写 | CON-08（承 VID-28 / CON-01） |
| 内容安全 | 平台对 `剧本.md` 做文本检测，命中即整份退回「文本未通过内容安全检测」：伤害/血腥/违禁物/擦边/脏话/真实专名/政治宗教/未成年人受害一律换动作与反应，不换剧情 | SAF-01 |

## 工作流

1. **单集契约**：观看承诺、谁要什么、阻力、当集兑现、退出状态。输入给出的事实、`必须/禁止`
   优先于本技能一切手艺默认；不为检查表补造题面没有的机关。
2. **写剧本** → `剧集/<EP>/剧本.md`：按[剧本阶段](references/stage-script.md)。每场当场过
   生成就绪七问（朝向绑定/容量预算/高频动作/空间锚点/因果可见/场景视觉事实/道具与文字可读），
   并按[内容安全](references/stage-script.md#9-平台内容安全saf-01)（SAF-01）把敏感字面换成动作与反应。
   长台词当场按[语速基线](references/pacing.md)（2 字/秒 + 停顿）估发声秒数，装不进一拍就先减词或拆拍；
   每句的表演括注要能回答快慢/哪里停/音量气息（PAC-03/PAC-04），外观什么时候变写进动作段与 `[连续性]`（CON-08）。
3. **剧本机械检查**：`python3 scripts/pro_check.py "剧集/<EP>/剧本.md"`——裸位移动词、
   超载拍、无原因结果、`SAF01_HIGH_RISK_TERM` 内容安全硬词会被点名；修到干净再进分镜。
4. **拆分镜** → `剧集/<EP>/分镜.md`：按[分镜阶段](references/stage-storyboard.md)。每镜先把
   动作与对白各自算成秒（可发声字 ÷ 档位 + 停顿 + 动作拍，**默认镜长 4 秒**，合计 ≤4 秒）；
   有台词先按[语速基线](references/pacing.md)把发声与停顿排进时间线，再给动作留窗口；
   装不下的链在可见状态闭合点拆镜。
5. **分镜机械检查**：`python3 scripts/pro_check.py "剧集/<EP>/分镜.md"`——镜长超上限直接报错
   （等价 SHT31）；声明时长装不下本镜动作+对话（`SHT31_SHOT_TIME_UNDERESTIMATED`）、短于默认
   4 秒（`SHT31_SHOT_BELOW_DEFAULT_SECONDS`）也会被点名。位移动作缺朝向、台词旁缺发声杠杆（`PAC04_*`）、
   衣着漂色（`CON08_*`）同档标记。
   项目接受了短镜档（如快切档 5 秒）时加
   `--shot-cap 3`，只能收紧、不能抬高 4 秒硬顶。
6. **写视频提示词** → `剧集/<EP>/视频提示词.md`：按[视频阶段](references/stage-video-prompts.md)；
   Seedance/H3/Wan 的素材槽位与语法细节见 [references/video/](references/video/) 对应方言文件。
   每句台词把三根杠杆写进正文（[台词交付规格](references/delivery-spec.md)），每镜重述站位/朝向/衣着
   （[站位、朝向与衣着的一致](references/identity-continuity.md)）。
   **逐镜单独生成**：一条提示词只对一个 `SHOT-`，不把一场当一个片段交出去（VID-29）。
7. **分镜视频剧本**（用户要 5/10 秒档直出时）→ `剧集/<EP>/分镜视频剧本.md`：按
   [分镜视频剧本](references/segment-script.md)，把镜按 ≤10 秒的生成段分箱，一段不跨场、段内单镜仍 ≤4 秒；
   检查 `python3 scripts/pro_check.py "剧集/<EP>/分镜视频剧本.md"`（`SEG10_*`）。
8. **交稿三查**（只读成稿）：观众查（承诺是否收到）、机制查（本集机关是否在边界内运转）、
   执行查（把动作段交给"看不见画面的人"演一遍，必须自己发明朝向手脚的就是没写完）。
9. 用户要整集就整集批次续跑；定点修订保留无关段落与既有 ID；会改变剧情走向的取舍交给用户。

## 按需知识

默认只读本 SKILL 和命中的阶段文档；同一请求跨阶段时逐阶段读：

- 剧本格式、七问细则、因果链与容量换算、高风险改写表、场景/道具/表面文字详细描述（SCR-24）：
  [剧本阶段](references/stage-script.md)
- 镜头字段、拆镜规则、轴线与冻结关键帧：[分镜阶段](references/stage-storyboard.md)
- 起止状态正文、朝向绑定写法、秒段与声音：[视频阶段](references/stage-video-prompts.md)
- 按 ≤10 秒生成段装片（5/10 秒模型直出）、段切点与段 ID：[分镜视频剧本](references/segment-script.md)
- 台词占多少秒、停顿怎么计、场单元 ≤10 秒与超时拆场、TTS 语速怎么校准：[语速基线与停顿预算](references/pacing.md)
  （PAC-01 / PAC-02 / PAC-06）
- 按剧情定语速档、情绪→杠杆换算表、各方言把语气写在哪一句：
  [台词交付规格](references/delivery-spec.md)（PAC-03 / PAC-04 / PAC-05）
- 站位、朝向、衣着、手持状态怎么逐镜重述，换装与伤情何时算已批准：
  [站位、朝向与衣着的一致](references/identity-continuity.md)（CON-08）
- 与上游套件的文档兼容、字段交接、能力分界：[交接与兼容](references/handoff.md)
- 深度参考（已搬入）：[references/script/](references/script/)、
  [references/storyboard/](references/storyboard/)、[references/video/](references/video/)

## 完成

点名范围成稿：剧本七问过检且 `pro_check` 剧本模式干净；分镜每镜 ≤4 秒、职责唯一、
起止状态含朝向与入画衣着、`pro_check` 分镜模式无 SHT31 报错；视频提示词逐镜正文完整实现所属镜头的
「起点 → 唯一动作 → 终点」且重述终点朝向；每句台词按本句档位（默认 2 字/秒）+ 停顿排进时间线、
装得进本镜，不靠提速或截断让算术成立；每句逐字围栏外至少两根发声杠杆，每镜自带站位/朝向/衣着锚点。
三查通过后交付；末尾一次报告节奏、表演交付与真实未决选择。

**交稿前的声音与一致性回听**（生成后做，不靠文本自证）：逐字完整？语速听着是不是常人说话、
该慢的地方真慢下来？停顿在不在写的位置、尾音有没有收？衣服颜色与站位跟上一镜对不对得上？
任一项靠猜就把缺陷回报到写它的那个阶段，不在下游静默修正。

## 安装维护

- **自包含**：本技能不引用任何上游路径——深度参考在 `references/{script,storyboard,video}/`，
  检查器与估时工具在 `scripts/`，样例在 `examples/`。上游 `npx skills add zenstory-ai/drama-skills -g`
  重跑只会重写它自带的 11 个 `short-drama-*` 目录，碰不到本目录；需要重放时从项目仓库
  `skills/short-drama-pro` 拷回（`node sync-drama-skills.mjs install`）。
- **自检**（需 Python 3.9+；Windows 无 `python3` 时用 `python`）：

  ```text
  python3 scripts/pro_check.py --selftest          # 镜长上限/裸位移/超载链/缺朝向/发声杠杆/人物一致
  python3 scripts/selftest_write.py                 # 剧本索引与估时
  python3 scripts/selftest_storyboard.py            # 分镜登记与 SHT-31 镜长上限
  python3 scripts/selftest_video.py                 # 配乐规格校验
  ```

- **机械检查口径**：`pro_check.py` 对 SHOT/MOTION 块报 `PAC04_DELIVERY_LEVERS_MISSING`（逐字围栏
  两侧同一句里不足两根杠杆）、`PAC04_EMOTION_WORD_ONLY`（只有情绪词）、
  `PAC05_DELIVERY_NOT_CALIBRATED`（只写「自然语速」类词）、`CON08_LOOK_ANCHOR_MISSING` /
  `CON08_END_STANCE_MISSING` / `CON08_WARDROBE_LANDING_MISSING` / `CON08_LOOK_DRIFT`。
  全部是 warning：特写镜不写全身服装这类合理省略靠审查判断，不改成 error。
- **工具入口**：`screenplay_index.py` / `duration_estimate.py`（时长与 `vo_share`）、
  `storyboard_check.py`（含 `--shot-duration-cap`，默认 4.0）、`voice_sheet_check.py`、
  `motion_timing_check.py`、`container_check.py`、`music_spec_check.py`。
- 跨文档结构终审仍用 router 的 `$short-drama` → `scripts/creator_markdown_check.py`。
