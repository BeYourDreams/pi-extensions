/**
 * pi-find-grep-rewrite — bash 里 find/grep 自动转成 fd/rg
 *
 * 背景：本机 find/grep 不可用（§4.2 no-find + §5 第三类），但模型仍会写 `find . -name '*.ts'`。
 * 纯文字纪律拦不住，故在 `tool_call` 上把命令改写掉：find → fd，grep/egrep/fgrep → rg。
 *
 * 只改首词是这四个之一的**流水线段**（`;` `|` `&&` `||` 换行切段，引号内不切）：
 *   - `find . -name '*.ts'` → `fd -g '*.ts' .`
 *   - `find src -type d -maxdepth 2` → `fd -t d -d 2 src`
 *   - `grep -rn 'foo' .` → `rg -n 'foo' .`
 *   - `git grep foo` / `./find-helper.sh` / `findings.md` / 管道消费位 → 放行
 *
 * 翻译不了就**原样保留**（让 find 自己报错），绝不静默猜：不认的 find flag 直接放弃转译。
 *
 * 零工具注入、不动注册表、不改 active 集。回退：删本文件 + /reload。
 */
import type { BashToolCallEvent, ExtensionAPI } from "@earendil-works/pi-coding-agent";

/** 引号感知的顶层切段：返回 [段, 分隔符, 段, …]，引号内的 |;& 不切。 */
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
			// 反斜杠转义：`\;` 不是分隔符
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

/** 极简 shell 分词：保留引号与原始文本，不做变量展开/转义还原。 */
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

/**
 * find 参数 → fd 参数。返回 null 表示「有无法对等翻译的 flag，整条放弃」。
 * 只覆盖有把握的对等映射，其余一律拒绝，避免静默改变语义。
 */
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
		} else if (t === "-newer") {
			const v = args[++i];
			if (v === undefined) return null;
			out.push("--changed-after", v);
		} else if (t === "-print") {
			// fd 默认就打印
		} else if (t === "-print0") {
			out.push("-0");
		} else if (t === "-exec" || t === "-execdir") {
			// 只认「{} 在末尾或省略、以 ; 或 + 收尾」（fd -x 把匹配项附加在命令末尾）
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
			return null; // 不认识的 find flag
		}
	}
	return [...out, ...paths, ...execArgs];
}

/**
 * grep 参数 → rg 参数。
 * grep 与 rg 绝大多数选项同名；要处理的是：递归类（rg 默认递归）、正则方言差异、--include/--exclude。
 */
export function translateGrepArgs(args: string[]): string[] {
	const out: string[] = [];
	for (const t of args) {
		if (t === "-r" || t === "-R" || t === "-d" || t === "--recursive") continue;
		if (t === "-E" || t === "-G") continue; // rg 默认扩展正则；rg -E 是 encoding，冲突
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

/**
 * 单个 find 段是否有显式 path 参数。
 */
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

/**
 * 单个 grep 段信息。
 */
export function grepInfo(tokens: string[]): { recursive: boolean; hasFile: boolean } {
	let recursive = false;
	const files: string[] = [];
	let i = 1;
	while (i < tokens.length) {
		const t = tokens[i];
		if (t === "-r" || t === "-R" || t === "--recursive") {
			recursive = true;
			i++;
			continue;
		}
		if (t === "-e" || t === "-f" || t === "-m") {
			i += 2;
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
	// 第一个非选项参数是 pattern，其余是 file/path
	return { recursive, hasFile: files.length >= 2 };
}

/**
 * 是否是「无 path 的整盘/整树扫描」命令（find 无 path，或递归 grep 无 file）。
 * 管道消费位不算。
 */
export function isBroadScan(command: string): boolean {
	const parts = splitSegments(command);
	for (let i = 0; i < parts.length; i += 2) {
		if (parts[i - 1] === "|" || parts[i - 1] === "|&") continue;
		const tokens = tokenize(parts[i].trim());
		const head = tokens[0];
		if (head === "find") {
			if (!findHasPath(tokens)) return true;
		} else if (head === "grep" || head === "egrep" || head === "fgrep") {
			const info = grepInfo(tokens);
			if (info.recursive && !info.hasFile) return true;
		}
	}
	return false;
}

export const isBroadScanCommand = isBroadScan;
export const isUnscopedSearch = isBroadScan;
export const isUnscopedScan = isBroadScan;

/** 单段改写：首词是 find/grep 才动；翻不了就原样返回。前后空白保留。 */
export function rewriteSegment(seg: string): string {
	const leading = seg.match(/^\s*/)?.[0] ?? "";
	const trailing = seg.match(/\s*$/)?.[0] ?? "";
	const trimmed = seg.trim();
	if (!trimmed) return seg;
	const tokens = tokenize(trimmed);
	const head = tokens[0];
	let body: string | null = null;
	if (head === "find") {
		const translated = translateFindArgs(tokens.slice(1));
		if (translated) body = ["fd", ...translated].join(" ");
	} else if (head === "grep" || head === "egrep" || head === "fgrep") {
		body = ["rg", ...translateGrepArgs(tokens.slice(1))].join(" ");
	}
	return body === null ? seg : leading + body + trailing;
}

/** 整条 command：逐段改写，分隔符原样保留；管道消费位不转。 */
export function rewriteCommand(command: string): string {
	const parts = splitSegments(command);
	for (let i = 0; i < parts.length; i += 2) {
		if (parts[i - 1] === "|" || parts[i - 1] === "|&") continue; // 管道消费位
		parts[i] = rewriteSegment(parts[i]);
	}
	return parts.join("");
}

export default function (pi: ExtensionAPI): void {
	pi.on("tool_call", (event) => {
		if (event.toolName !== "bash") return;
		const e = event as BashToolCallEvent;
		const command = e.input?.command;
		if (typeof command !== "string" || !command) return;
		if (isBroadScan(command)) {
			return { block: true, reason: "find/grep 无 path 参数会整树/整盘扫描，请显式给出 path/glob 范围" };
		}
		const next = rewriteCommand(command);
		if (next !== command) e.input.command = next;
	});
}