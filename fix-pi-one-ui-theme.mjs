#!/usr/bin/env node
// pi-one-ui 内置主题 × pi 1.x 严格主题 schema 的兼容补丁（幂等，`--check` 只体检）。
//
// 症状：开机 / `/reload` 弹
//   [Theme conflicts] Invalid theme "C:\Users\<you>\.pi\agent\npm\node_modules\pi-one-ui\themes\cc-dark.json":
//     - /colors/cwd: schema is false
//     - /colors/editorModel: schema is false
//     - /colors/editorBorder: schema is false
//     - /colors: must not have additional properties
//   （cc-light.json 紧跟着一份一模一样的）
//
// 根因：pi 的主题对象是**严格**的（`<pi 安装目录>/docs/themes.md`：
//   "Theme objects are strict: only documented top-level fields and color tokens are
//    accepted. … custom keys under `colors` or `export` … are rejected"；schema 在
//   `<pi 安装目录>/theme/theme-schema.json`，`colors.additionalProperties = false`，
//   56 个键、止于 `bashMode`）。而 pi-one-ui@0.9.1 把它自造的扩展色键
//   `cwd` / `editorModel` / `editorBorder` 直接写进了两个内置主题的 `colors`
//   （它 README「颜色体系与主题定制」一节明说这是设计：cc-dark / cc-light 支持这些键）。
//   后果不是「只丢那 3 个色」——**整份主题被判非法**，cc-dark / cc-light 直接不可用。
//
// 处理：把这 3 个键从 `colors` 里删掉。pi-one-ui 自己就有三级回退
//   （extensions/shared/style.ts:renderSourceColor：配置 > 主题 token > 原生默认，
//   themeHasToken() 探不到 token 不抛错），所以删键后：
//     - `cwd`          → 走 ~/.pi/agent/pi-one-ui.json 的 colors.cwd（本机 = accent，见 readme §7.22）
//     - `editorModel`  → 原生默认（minimalist 行 syntaxKeyword，editor metadata 格式化那路 accent）
//     - `editorBorder` → 原生默认 borderMuted
//   想再调就写 pi-one-ui 的配置，别改主题文件：用户主题（<agent-dir>/themes/）走同一条
//   严格校验，加 `colors.cwd` 只会把自定义主题整个打死。
//
// 注意：`pi update npm:pi-one-ui` / 重装会把 themes/*.json 覆盖回来 → 重跑本脚本即可。
//   上游哪天按 pi 的严格 schema 重做了这两个主题，本脚本自动变成 `[skip]`。
//   ~/.pi/agent/pi-one-ui.json 的 colors 段在 agent 目录、不受本补丁影响。
//
// 用法：node fix-pi-one-ui-theme.mjs [--check]
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";

const PKG_DIR = path.join(os.homedir(), ".pi", "agent", "npm", "node_modules", "pi-one-ui");
const THEME_DIR = path.join(PKG_DIR, "themes");
// 找不到 pi 的 schema 时用的兜底名单（pi 1.0.0 ~ 1.3.0 就是这 3 个键越界）。
const FALLBACK_EXTRA = ["cwd", "editorModel", "editorBorder"];
const checkOnly = process.argv.includes("--check");

/** 定位 pi 的 theme-schema.json：PI_INSTALL_DIR > where.exe pi(.exe) > 常见约定目录。 */
function detectSchemaFile() {
	const candidates = [];
	if (process.env.PI_INSTALL_DIR) candidates.push(process.env.PI_INSTALL_DIR);
	try {
		for (const line of execFileSync("where.exe", ["pi"], { encoding: "utf8" }).split(/\r?\n/)) {
			const exe = line.trim();
			if (exe) candidates.push(path.dirname(exe));
		}
	} catch {}
	const agentRoot = path.join(os.homedir(), ".pi", "agent");
	candidates.push(
		path.join(agentRoot, "node_modules", "@earendil-works", "pi-coding-agent"),
		path.join(agentRoot, "npm", "node_modules", "@earendil-works", "pi-coding-agent"),
	);
	for (const dir of candidates) {
		for (const rel of [
			path.join("theme", "theme-schema.json"),
			path.join("dist", "modes", "interactive", "theme", "theme-schema.json"),
		]) {
			const p = path.join(dir, rel);
			if (fs.existsSync(p)) return p;
		}
	}
	return null;
}

/** schema 允许的主题色键；schema 不可用 / 不严格时返回 null（改用兜底名单）。 */
function allowedColorKeys(schemaFile) {
	if (!schemaFile) return null;
	try {
		const colors = JSON.parse(fs.readFileSync(schemaFile, "utf8")).properties?.colors;
		if (!colors || colors.additionalProperties !== false) return null;
		const keys = Object.keys(colors.properties ?? {});
		return keys.length ? new Set(keys) : null;
	} catch {
		return null;
	}
}

if (!fs.existsSync(THEME_DIR)) {
	console.log(
		`[skip] 未找到 pi-one-ui 主题目录（未装 npm 副本，本机改用本地源码安装）: ${THEME_DIR}`,
	);
	process.exit(0);
}

const schemaFile = detectSchemaFile();
const allowed = allowedColorKeys(schemaFile);
const themeFiles = fs.readdirSync(THEME_DIR).filter((f) => f.endsWith(".json"));
if (themeFiles.length === 0) {
	console.error(`[fail] ${THEME_DIR} 里没有 .json 主题，请手工核对`);
	process.exit(1);
}

let todo = 0;
let clean = 0;
for (const file of themeFiles) {
	const full = path.join(THEME_DIR, file);
	let theme;
	try {
		theme = JSON.parse(fs.readFileSync(full, "utf8"));
	} catch (error) {
		console.error(`[fail] ${file} 不是合法 JSON，本脚本不动它：${error.message}`);
		process.exit(1);
	}
	const colors = theme.colors;
	if (!colors || typeof colors !== "object") {
		console.log(`[skip] ${file}：没有 colors 段，无需处理`);
		clean++;
		continue;
	}
	const bad = Object.keys(colors).filter((k) => (allowed ? !allowed.has(k) : FALLBACK_EXTRA.includes(k)));
	if (bad.length === 0) {
		console.log(`[skip] ${file}：colors 全在 pi 主题 schema 白名单内（上游已合规或本机已补过）`);
		clean++;
		continue;
	}
	if (checkOnly) {
		console.log(`[待修补] ${file}: colors 里有 pi 不认的键 -> ${bad.join(", ")}`);
		todo++;
		continue;
	}
	for (const key of bad) delete colors[key];
	// 上游这两个文件本来就是 tab 缩进 + 尾换行，round-trip 不改动其它内容。
	fs.writeFileSync(full, `${JSON.stringify(theme, null, "\t")}\n`, "utf8");
	console.log(`[done] ${file}: 删掉 ${bad.join(", ")}（主题恢复可被 pi 校验）`);
	todo++;
}

console.log(`来源：pi 主题 schema = ${schemaFile ?? "未找到（用兜底名单 cwd/editorModel/editorBorder）"}`);
if (checkOnly) {
	if (todo > 0) {
		console.log(`[check] ${todo} 份主题待修补，跑：node fix-pi-one-ui-theme.mjs`);
		process.exit(1);
	}
	console.log(`[check] ${clean} 份主题全部合规`);
	process.exit(0);
}
if (todo === 0) console.log("无需改动。");
else console.log(`共处理 ${todo} 份。/reload 或重启 pi 后 Theme conflicts 提示应消失。`);
