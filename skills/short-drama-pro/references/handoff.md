# 交接与兼容

## 文档契约

| 产物 | 路径 | 本技能负责 | 上游套件负责 |
| --- | --- | --- | --- |
| 剧本 | `剧集/<EP>/剧本.md` | `$short-drama-pro`（剧本阶段） | `$short-drama-write` |
| 视觉设定/资产 | `剧集/<EP>/视觉设定.md`、`图片提示词.md` | ✗ | `$short-drama-assets` / `$short-drama-image-prompts` |
| 分镜 | `剧集/<EP>/分镜.md` | `$short-drama-pro`（分镜阶段） | `$short-drama-storyboard` |
| 视频提示词 | `剧集/<EP>/视频提示词.md` | `$short-drama-pro`（视频阶段） | `$short-drama-video-prompts` |
| 生产/剪辑/终审 | `制作成果/`、审查文档 | ✗ | `$short-drama-produce/edit/review` |

标题与字段语法与上游一致（`# EP…`／`## EP…-SC…`／`## SHOT-…`／`## MOTION-… · 中文名`、
`### 冻结关键帧提示词`、`### 可复制提示词` 引用块、`REF-<slot>（顺序：…）· 路径《名称》（用途：…；
控制：…；不得控制：…）` 槽位、生产标签 `[VO] [OS] [SFX] [画面文字] [连续性] [转场]`），
所以产物可以混用两条链：pro 写的剧本可交给上游 `$short-drama-storyboard`，反之亦可。
五份创作文档齐备后可转 `$short-drama` 做跨文档机械核对。

## 字段交接

- 分镜从剧本接：场景 ID、动作因果段、`[连续性]` 状态、`[SFX]`/`[画面文字]` 事实。
- 视频阶段从分镜接：`时长`（原样，≤12 秒）、`起点/唯一动作/终点`（只实现不回写）、
  `输入参考图` 槽位（原样携带）、`视觉依据` 条目名。
- 冻结关键帧→图生视频：起始帧只管起点外观与构图；终点必须由运动正文写出。

## 补丁映射（复刻来源）

| pro 规则 | 上游等价物 |
| --- | --- |
| 单镜 ≤12s／10s 最佳，总长不设限 | `short-drama-storyboard` SHT-31 + `storyboard_check.py --shot-duration-cap` |
| 位移动作朝向绑定、领先部位、终点重述 | SCR-23 / SHT-30 / VID-28 三份 action-physics |
| 一拍 ≤ 两物理步、中段进入、未完成原因→对应结果 | 同上（三层共用词汇） |
| 生成就绪五问 | `short-drama-write` SKILL「生成就绪硬约束」 |

`pro_check.py` 是这三层纪律在 pro 文档形态下的轻量机械版；上游项目若同时使用
`creator_markdown_check.py` / `storyboard_check.py`，以它们为结构终审（口径一致：
镜长上限默认同为 12.0）。

## 与上游的共存

- 本技能目录自包含，不引用上游文件路径；上游升级不影响本技能。
- 方言深水区（Seedance/H3/Wan 的槽位与容器语法）以命中模型的官方文档为准；本技能
  references 只写通用纪律。
- 需要回到全上游链（资产板、生产确认、剪辑、终审）时，产物文件即接口，无需转换。
