/**
 * no-find — 拦截 `find`，自动改写为 `fd` 后执行（减少模型往返请求）
 *
 * - bash/powershell 命令里出现 `find`：改写成 `fd`（find → fd、grep/egrep/fgrep → rg），
 *   覆盖不到的参数原样保留 → 让命令自己报错，不静默猜；改写成功直接执行，不额外请求模型。
 * - pi-find 注册的 `find` 工具：直接拦截（逼用 `fd`）。
 * - `./find`、`findings.md`、管道消费位、`git grep` 等不误伤。
 *
 * 配置：`~/.pi/agent/extensions/no-find.json`
 *   - `{"enabled": false}` 整体停用
 *   - `{"allow": ["find -name *.go"]}` 按「首词 + 第二个词」前缀放行个别命令（放行时不改写）
 */
import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

const CONFIG_PATH = path.join(homedir(), ".pi", "agent", "extensions", "no-find.json");

const REASON = [
	"`find` 已被全局禁用（在本机会假死：cmd/PowerShell 里命中的是 C:\\Windows\\System32\\find.exe，它会从 stdin 读；Git Bash 的 GNU find 在大目录树上极慢）。",
	"改用 `fd`（同一底层、ignore 感知、更快）：",
	'  - fd {pattern:"RULES", extension:"md"}        # 正则匹配整条路径 + 限定扩展名',
	'  - fd {type:"directory", maxDepth:2}           # 只列目录、限深度',
	'  - fd {changedWithin:"1d"}                     # 最近改过的（find 做不到）',
	"  - bash 里直接写 fd / fdfind（等价于 find 的路径匹配，如 `fd -e ts`）",
	"  - 找文件内容用 grep 工具，别用 find。",
].join("\n");

interface NoFindConfig {
	enabled?: boolean;
	allow?: string[];
}

function loadConfig(): NoFindConfig {
	try {
		return existsSync(CONFIG_PATH) ? (JSON.parse(readFileSync(CONFIG_PATH, "utf8")) as NoFindConfig) : {};
	} catch {
		return {};
	}
}

function* commandSegments(command: string): Generator<string> {
	const inner: string[] = [];
	const outer = command
		.replace(/\$\(([^()]*)\)/g, (_m, body: string) => {
			inner.push(body);
			return " ";
		})
		.replace(/`([^`]*)`/g, (_m, body: string) => {
			inner.push(body);
			return " ";
		});
	for (const body of inner) yield* commandSegments(body);
	for (const part of outer.split(/[;\n|]|&&|\|\|/)) yield part;
}

export function detectFindCommand(command: string): string | null {
	for (const raw of commandSegments(command)) {
		let segment = raw.trim();
		if (!segment) continue;
		let guard = 0;
		while (guard++ < 6) {
			const before = segment;
			segment = segment.replace(/^(&|\(|)\s*/, "");
			segment = segment.replace(
				/^(?:sudo|command|env|nohup|time|xargs|exec|eval|then|do|else)\b\s*(\w+=\S+\s+)*/,
				"",
			);
			segment = segment.replace(/^\d*>>?\s*\S+\s*/, "");
			if (segment === before) break;
		}
		segment = segment.trim();
		if (!segment) continue;
		const first = /^("[^"]*"|'[^']*'|\S+)/.exec(segment)?.[1]?.replace(/^["']|["']$/g, "") ?? "";
		const base = first.split(/[\\/]/).pop() ?? "";
		if (base !== "find" && base.toLowerCase() !== "find.exe") continue;
		return segment.length > 120 ? `${segment.slice(0, 120)}…` : segment;
	}
	return null;
}

export function detectGrepCommand(command: string): string | null {
	for (const raw of commandSegments(command)) {
		let segment = raw.trim();
		if (!segment) continue;
		let guard = 0;
		while (guard++ < 6) {
			const before = segment;
			segment = segment.replace(/^(&|\(|)\s*/, "");
			segment = segment.replace(
				/^(?:sudo|command|env|nohup|time|xargs|exec|eval|then|do|else)\b\s*(\w+=\S+\s+)*/,
				"",
			);
			segment = segment.replace(/^\d*>>?\s*\S+\s*/, "");
			if (segment === before) break;
		}
		segment = segment.trim();
		if (!segment) continue;
		const first = /^("[^"]*"|'[^']*'|\S+)/.exec(segment)?.[1]?.replace(/^["']|["']$/g, "") ?? "";
		const base = first.split(/[\/]/).pop() ?? "";
		if (base !== "grep" && base !== "egrep" && base !== "fgrep" && base.toLowerCase() !== "grep.exe") continue;
		return segment.length > 120 ? `${segment.slice(0, 120)}…` : segment;
	}
	return null;
}

export function detectSearchCommand(command: string): string | null {
	return detectFindCommand(command) ?? detectGrepCommand(command);
}

const SEARCH_CMDS = new Set(["find", "grep", "egrep", "fgrep"]);
const LEADING_NOISE = new Set([
	"sudo", "doas", "time", "nice", "ionice", "nohup", "setsid", "stdbuf",
	"command", "exec", "xargs", "env",
]);
const SHELL_KEYWORDS = new Set([
	"if", "then", "else", "elif", "fi", "do", "done", "for", "while", "until",
	"case", "esac", "in", "{", "}", "(", ")", "!", "function",
]);

function baseName(t: string): string {
	return t.replace(/\.exe$/i, "").split(/[/\\]/).pop()?.toLowerCase() ?? t.toLowerCase();
}

function isPrefixToken(t: string): boolean {
	const b = baseName(t);
	if (LEADING_NOISE.has(b)) return true;
	if (SHELL_KEYWORDS.has(b)) return true;
	if (/^[A-Za-z_][A-Za-z0-9_]*=/.test(t)) return true;
	if (t.startsWith("-")) return true;
	if (/^\d+$/.test(t)) return true;
	if (t === "--") return true;
	return false;
}

export function findCommandIndex(tokens: string[]): number {
	for (let i = 0; i < tokens.length; i++) {
		const b = baseName(tokens[i]);
		if (!SEARCH_CMDS.has(b)) continue;
		if (i === 0 || isPrefixToken(tokens[i - 1])) return i;
	}
	return -1;
}

export function splitSegments(s: string): string[] {
	const out: string[] = [];
	let cur = "";
	let quote: '"' | "'" | null = null;
	for (let i = 0; i < s.length; i++) {
		const c = s[i];
		if (quote) {
			cur += c;
			if (c === quote) quote = null;
			continue;
		}
		if (c === '"' || c === "'") {
			quote = c;
			cur += c;
			continue;
		}
		if (c === "\\" && i + 1 < s.length) {
			cur += c + s[++i];
			continue;
		}
		if (c === "|" && s[i + 1] === "|") {
			out.push(cur, "||");
			cur = "";
			i++;
			continue;
		}
		if (c === "|" && s[i + 1] === "&") {
			out.push(cur, "|&");
			cur = "";
			i++;
			continue;
		}
		if (c === "&" && s[i + 1] === "&") {
			out.push(cur, "&&");
			cur = "";
			i++;
			continue;
		}
		if (c === "&" && s[i + 1] === ">") {
			cur += c;
			continue;
		}
		if (c === "&") {
			if (cur.length > 0 && cur[cur.length - 1] === ">") {
				cur += c;
				continue;
			}
			out.push(cur, "&");
			cur = "";
			continue;
		}
		if (c === "|" || c === ";" || c === "\n") {
			out.push(cur, c);
			cur = "";
			continue;
		}
		cur += c;
	}
	out.push(cur);
	return out;
}

export function tokenize(s: string): string[] {
	const out: string[] = [];
	let cur = "";
	let quote: '"' | "'" | null = null;
	let started = false;
	for (let i = 0; i < s.length; i++) {
		const c = s[i];
		if (quote) {
			cur += c;
			if (c === quote) quote = null;
			continue;
		}
		if (c === '"' || c === "'") {
			quote = c;
			cur += c;
			started = true;
			continue;
		}
		if (/\s/.test(c)) {
			if (started) {
				out.push(cur);
				cur = "";
				started = false;
			}
			continue;
		}
		cur += c;
		started = true;
	}
	if (started) out.push(cur);
	return out;
}

export function translateFindArgs(args: string[]): string[] | null {
	const out: string[] = [];
	const paths: string[] = [];
	const execArgs: string[] = [];
	for (let i = 0; i < args.length; i++) {
		const t = args[i];
		if (t === "-name" || t === "-iname") {
			const pat = args[++i];
			if (pat === undefined) return null;
			if (t === "-iname") out.push("-i");
			out.push("-g", pat);
		} else if (t === "-type") {
			const v = args[++i];
			if (v !== "f" && v !== "d" && v !== "l") return null;
			out.push("-t", v);
		} else if (t === "-maxdepth") {
			const v = args[++i];
			if (v === undefined) return null;
			out.push("-d", v);
		} else if (t === "-mindepth") {
			const v = args[++i];
			if (v === undefined) return null;
			out.push("--min-depth", v);
		} else if (t === "-print") {
		} else if (t === "-print0") {
			out.push("-0");
		} else if (t === "-exec" || t === "-execdir") {
			const cmd: string[] = [];
			let j = i + 1;
			let closed = false;
			for (; j < args.length; j++) {
				if (args[j] === ";" || args[j] === "\\;" || args[j] === "+") {
					closed = true;
					break;
				}
				cmd.push(args[j]);
			}
			if (!closed || !cmd.length) return null;
			const braceIdx = cmd.indexOf("{}");
			if (braceIdx >= 0 && braceIdx !== cmd.length - 1) return null;
			execArgs.push("-x", ...cmd.filter((c) => c !== "{}"));
			i = j;
		} else if (!t.startsWith("-")) {
			paths.push(t);
		} else {
			return null;
		}
	}
	return [...out, ...paths, ...execArgs];
}

export function translateGrepArgs(args: string[]): string[] {
	const out: string[] = [];
	for (const t of args) {
		if (t === "-r" || t === "-R" || t === "-d" || t === "--recursive") continue;
		if (t === "-E" || t === "-G") continue;
		if (/^-[a-zA-Z]+$/.test(t) && /[rR]/.test(t)) {
			const chars = t.slice(1).split("").filter((c) => c !== "r" && c !== "R");
			if (chars.length) out.push(`-${chars.join("")}`);
			continue;
		}
		if (t.startsWith("--include=")) {
			out.push("-g", t.slice("--include=".length));
			continue;
		}
		if (t.startsWith("--exclude=")) {
			const glob = t.slice("--exclude=".length);
			const m = glob.match(/^(['"])([\s\S]*)\1$/);
			out.push("-g", m ? `${m[1]}!${m[2]}${m[1]}` : `!${glob}`);
			continue;
		}
		out.push(t);
	}
	return out;
}

export function findHasPath(tokens: string[]): boolean {
	let i = 1;
	let hasPath = false;
	while (i < tokens.length) {
		const t = tokens[i];
		if (t === "-name" || t === "-iname" || t === "-type" || t === "-maxdepth" || t === "-mindepth" || t === "-newer") {
			i += 2;
			continue;
		}
		if (t === "-print" || t === "-print0") {
			i++;
			continue;
		}
		if (t === "-exec" || t === "-execdir") {
			let j = i + 1;
			while (j < tokens.length && tokens[j] !== ";" && tokens[j] !== "\\;" && tokens[j] !== "+") j++;
			i = j + 1;
			continue;
		}
		if (!t.startsWith("-")) hasPath = true;
		i++;
	}
	return hasPath;
}

export function grepInfo(tokens: string[]): { recursive: boolean; hasFile: boolean } {
	let recursive = false;
	let patternGiven = false;
	const files: string[] = [];
	let i = 1;
	while (i < tokens.length) {
		const t = tokens[i];
		if (t === "-r" || t === "-R" || t === "--recursive") {
			recursive = true;
			i++;
			continue;
		}
		if (t === "-e" || t === "-f" || t === "--regexp" || t === "--file") {
			patternGiven = true;
			i += 2;
			continue;
		}
		if (t === "-m" || t.startsWith("--regexp=") || t.startsWith("--file=")) {
			if (t !== "-m") patternGiven = true;
			i += t === "-m" ? 2 : 1;
			continue;
		}
		if (/^-[a-zA-Z]+$/.test(t)) {
			if (/[rR]/.test(t)) recursive = true;
			i++;
			continue;
		}
		if (t.startsWith("--")) {
			i++;
			continue;
		}
		files.push(t);
		i++;
	}
	return { recursive, hasFile: files.length >= (patternGiven ? 1 : 2) };
}

export function isBroadScan(command: string): boolean {
	const parts = splitSegments(command);
	for (let i = 0; i < parts.length; i += 2) {
		if (parts[i - 1] === "|" || parts[i - 1] === "|&") continue;
		const tokens = tokenize(parts[i].trim());
		const cmdIdx = findCommandIndex(tokens);
		if (cmdIdx < 0) continue;
		const cmd = baseName(tokens[cmdIdx]);
		const args = tokens.slice(cmdIdx + 1);
		const arr = [cmd, ...args];
		if (cmd === "find") {
			if (!findHasPath(arr)) return true;
		} else if (cmd === "grep" || cmd === "egrep" || cmd === "fgrep") {
			const info = grepInfo(arr);
			if (info.recursive && !info.hasFile) return true;
		}
	}
	return false;
}

export function rewriteSegment(seg: string): string {
	const leading = seg.match(/^\s*/)?.[0] ?? "";
	const trailing = seg.match(/\s*$/)?.[0] ?? "";
	const trimmed = seg.trim();
	if (!trimmed) return seg;
	const tokens = tokenize(trimmed);
	const cmdIdx = findCommandIndex(tokens);
	if (cmdIdx < 0) return seg;
	const cmd = baseName(tokens[cmdIdx]);
	const prefix = tokens.slice(0, cmdIdx);
	const args = tokens.slice(cmdIdx + 1);
	let body: string | null = null;
	if (cmd === "find") {
		const translated = translateFindArgs(args);
		if (translated) body = [...prefix, "fd", ...translated].join(" ");
	} else {
		body = [...prefix, "rg", ...translateGrepArgs(args)].join(" ");
	}
	return body === null ? seg : leading + body + trailing;
}

export function rewriteCommand(command: string): string {
	const parts = splitSegments(command);
	for (let i = 0; i < parts.length; i += 2) {
		if (parts[i - 1] === "|" || parts[i - 1] === "|&") continue;
		parts[i] = rewriteSegment(parts[i]);
	}
	return parts.join("");
}

export default function noFind(pi: ExtensionAPI): void {
	const config = loadConfig();
	if (config.enabled === false) return;

	const allowed = (config.allow ?? []).map((rule) => rule.trim()).filter(Boolean);
	const isAllowed = (segment: string): boolean => {
		const key = segment.split(/\s+/).slice(0, 2).join(" ").replace(/^["']|["']$/g, "");
		return allowed.some((rule) => key === rule || key.startsWith(`${rule} `));
	};

	pi.on("tool_call", (event) => {
		if (event.toolName === "find") {
			return { block: true, reason: REASON };
		}
		if (event.toolName !== "bash" && event.toolName !== "powershell") return;
		const command = String((event.input as { command?: unknown }).command ?? "");
		if (!command) return;
		const hit = detectSearchCommand(command);
		if (hit && isAllowed(hit)) return;
		if (!hit) return;
		const next = rewriteCommand(command);
		if (next !== command) {
			(event.input as { command: string }).command = next;
			return;
		}
		return { block: true, reason: `${REASON}\n\n被拦的命令：${hit}` };
	});
}
