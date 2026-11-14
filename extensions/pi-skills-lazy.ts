/**
 * pi-skills-lazy — 会话启动时自动给全局技能补 disable-model-invocation: true
 *
 * 目的：技能被手工更新/同步覆盖 SKILL.md 后标记可能丢失，导致 <available_skills>
 * 索引重新常驻。启动时幂等补标记即可自愈（配合 config/agent/AGENTS.md 名单路由）。
 *
 * 不注册工具；仅修复缺失标记时提示一次。路由名单不在此自动改（技能增删/改名需人工维护）。
 */
import { existsSync, globSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

const MARK = "disable-model-invocation: true";

function markMissing(): { marked: number; total: number } {
	const root = join(homedir(), ".pi", "agent", "skills");
	const files = existsSync(root) ? globSync("*/SKILL.md", { cwd: root }).map((f) => join(root, f)) : [];
	let marked = 0;
	for (const file of files) {
		let src: string;
		try {
			src = readFileSync(file, "utf8");
		} catch {
			continue;
		}
		const close = src.indexOf("---", 3);
		if (!src.startsWith("---") || close < 0) continue;
		if (src.slice(0, close).includes(MARK)) continue;
		try {
			writeFileSync(file, src.slice(0, close) + MARK + "\n" + src.slice(close));
			marked++;
		} catch {
			/* 只读/占用时跳过，下次再试 */
		}
	}
	return { marked, total: files.length };
}

export default function (pi: ExtensionAPI) {
	pi.on("session_start", (_event, ctx) => {
		try {
			const { marked } = markMissing();
			if (marked > 0 && ctx.hasUI) {
				ctx.ui.notify(`pi-skills-lazy: 已为 ${marked} 个技能补回 disable-model-invocation 标记`, "info");
			}
		} catch {
			/* 自愈失败不阻塞会话 */
		}
	});
}
