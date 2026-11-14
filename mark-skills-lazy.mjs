#!/usr/bin/env node
/**
 * mark-skills-lazy.mjs — 给全局技能打 `disable-model-invocation: true`，把技能索引从系统提示词里摘掉
 *
 * 为什么：pi 原生把每个技能的 name+description+filePath 常驻注入（本机 11 个技能 ≈ 2000 tok/请求），
 * 技能正文本来就是按需读的。打上这个标记后 pi 用 `formatSkillsForPrompt` 过滤掉，整条不出现在提示词里；
 * `/skill:<name>` 和直接 read SKILL.md 都不受影响。路由改由 `~/.pi/agent/AGENTS.md` 的名单承担
 * （canonical 在 config/agent/AGENTS.md，`node install-project-config.mjs` 同步）。
 *
 * 用法：
 *   node mark-skills-lazy.mjs           # 给缺标记的 SKILL.md 补一行（幂等）
 *   node mark-skills-lazy.mjs --check   # 只体检；有缺标记的 exit 1
 *
 * 新装技能后要重跑一次，并在 AGENTS.md 名单里补一条——这是纯配置方案的唯一维护成本。
 */
import { existsSync, globSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const MARK = "disable-model-invocation: true";
const check = process.argv.includes("--check");
const root = join(homedir(), ".pi", "agent", "skills");
const files = existsSync(root) ? globSync("*\/SKILL.md", { cwd: root }).map((f) => join(root, f)) : [];

let changed = 0;
for (const file of files) {
	const src = readFileSync(file, "utf8");
	const close = src.indexOf("---", 3); // frontmatter 闭合位置
	if (!src.startsWith("---") || close < 0) {
		console.log(`[skip] 无 frontmatter: ${file}`);
		continue;
	}
	if (src.slice(0, close).includes(MARK)) continue;
	if (check) {
		console.log(`[missing] ${file}`);
		changed++;
		continue;
	}
	writeFileSync(file, src.slice(0, close) + MARK + "\n" + src.slice(close));
	console.log(`[mark] ${file}`);
	changed++;
}
console.log(`${check ? "缺标记" : "本次标记"} ${changed} 个 / 共 ${files.length} 个技能`);
if (check && changed > 0) process.exit(1);
