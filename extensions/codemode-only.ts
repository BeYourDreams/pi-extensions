/**
 * codemode-only — 让 `codemode.mode: "only"` 真正成为唯一入口
 *
 * 为什么需要它：`only` 只隐藏**声明**，不改 active 集——`hiddenDeclarations` 的语义是
 * 「active 但请求里不声明」，工具**仍然可调用**。而 `bash` 又必须保持 active，否则脚本里的
 * `tools.bash()` 也调不动（`direct` exposure 只在 active 时可调用）。于是模型硬点名 `bash`
 * 时 pi 照跑：2026-11-14 实测一条会话 43 次直调全部成功（该会话 system 段 tools 只有 codemode）。
 *
 * 做法：`tool_call` 里拦掉模型**直接**发出的内建调用，回一句 reason 指回 `tools.x()`；
 * codemode 脚本发起的嵌套调用带 `parentToolCallId`，一律放行。不注册工具、不进提示词，
 * 前缀 0 成本。
 *
 * 上限：只覆盖内建 8 个名字；扩展工具（如 `omnify`）不在名单里，要拦就往 DIRECT 里加。
 */
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

const DIRECT = new Set(["read", "bash", "edit", "write", "grep", "find", "ls", "powershell"]);

export default function codemodeOnly(pi: ExtensionAPI): void {
	pi.on("tool_call", async (event) => {
		if (event.parentToolCallId || !DIRECT.has(event.toolName)) return;
		return {
			block: true,
			reason: `Call it from codemode instead: const r = await tools.${event.toolName}({ ... })`,
		};
	});
}
