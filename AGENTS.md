# 项目规则（单条，可整文件拷到其他项目目录）

- **不要在本目录写 `.pi/settings.json`。** pi 合并 settings 时数组**整体替换、项目级胜出**——只要某个项目里留了一份 `defaultTools`，它就把全局 `~/.pi/agent/settings.json` 顶掉，「改一处生效」退化成「改 N 处」。**配置只改用户级那一份。**
- 项目确实需要差异化时，用本文件（`AGENTS.md`）、脚本参数或环境变量表达，不要落在 `.pi/settings.json` 的 `defaultTools` 上。

> 出处：pi-extensions 仓库（2026-11-13 定案）。同步到别的项目：`cp <仓库>/AGENTS.md <项目>/AGENTS.md`。
