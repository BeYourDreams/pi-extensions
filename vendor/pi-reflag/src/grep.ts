/**
 * Translate grep/egrep/fgrep/zgrep family arguments to rg equivalents.
 *
 * Upstream port from greprip-rs (MIT). Local fork: one table of single-flag
 * mappings; short clusters are split per character, no combined-flag special cases.
 */
import type { CommandRewrite } from "./types.js";
import { xargs } from "./xargs.js";

type Mode = "basic" | "extended" | "fixed";

type Action =
  | { kind: "drop" }
  | { kind: "emit"; to: string[] }
  | { kind: "value"; to: string[]; map?: (v: string) => string[] }
  | { kind: "mode"; mode: Mode }
  | { kind: "unsupported" };

const DROP: Action = { kind: "drop" };
const NO: Action = { kind: "unsupported" };
const emit = (...to: string[]): Action => ({ kind: "emit", to });
const value = (...to: string[]): Action => ({ kind: "value", to });
const mode = (m: Mode): Action => ({ kind: "mode", mode: m });

/** One entry per flag, never per combination. Long names omit the leading "--". */
const FLAGS: ReadonlyMap<string, Action> = new Map([
  ["E", mode("extended")], ["F", emit("-F")], ["G", mode("basic")], ["P", emit("-P")],
  ["i", emit("-i")], ["w", emit("-w")], ["x", emit("-x")], ["z", emit("--null-data")],
  ["e", value("-e")], ["f", value("-f")], ["s", emit("--no-messages")], ["v", emit("-v")],
  ["V", NO], ["help", NO],
  ["m", value("-m")], ["b", emit("-b")], ["n", emit("-n")], ["line-buffered", emit("--line-buffered")],
  ["H", emit("-H")], ["h", emit("-I")], ["o", emit("-o")], ["q", emit("-q")],
  ["a", emit("-a")], ["I", DROP], ["r", DROP], ["R", emit("-L")],
  ["L", emit("--files-without-match")], ["l", emit("-l")], ["c", emit("-c", "--include-zero")],
  ["Z", emit("-0")], ["U", emit("--crlf")], ["u", NO], ["T", NO],
  ["d", NO], ["D", NO], ["label", NO], ["exclude-from", value("--ignore-file")],
  ["include", value("-g")],
  ["exclude", { kind: "value", to: ["-g"], map: (v) => ["!" + v] }],
  ["exclude-dir", { kind: "value", to: ["-g"], map: (v) => ["!" + v + "/"] }],
  ["color", emit("--color=always")], ["colour", emit("--color=always")],
  ["A", value("-A")], ["B", value("-B")], ["C", value("-C")],
  ["after-context", value("-A")], ["before-context", value("-B")], ["context", value("-C")],
  ["extended-regexp", mode("extended")], ["fixed-strings", emit("-F")],
  ["basic-regexp", mode("basic")], ["perl-regexp", emit("-P")],
  ["regexp", value("-e")], ["file", value("-f")], ["ignore-case", emit("-i")],
  ["word-regexp", emit("-w")], ["line-regexp", emit("-x")], ["null-data", emit("--null-data")],
  ["no-messages", emit("--no-messages")], ["invert-match", emit("-v")], ["version", NO],
  ["max-count", value("-m")], ["byte-offset", emit("-b")], ["line-number", emit("-n")],
  ["with-filename", emit("-H")], ["no-filename", emit("-I")], ["only-matching", emit("-o")],
  ["quiet", emit("-q")], ["silent", emit("-q")], ["text", emit("-a")],
  ["recursive", DROP], ["dereference-recursive", emit("-L")],
  ["files-without-match", emit("--files-without-match")], ["files-with-matches", emit("-l")],
  ["count", emit("-c", "--include-zero")], ["null", emit("-0")],
  ["initial-tab", NO], ["directories", NO], ["devices", NO],
]);

const BRE_META = new Set(["(", ")", "{", "}", "|", "+", "?"]);

function convertBreToEre(pattern: string): string {
  let result = "";
  let i = 0;
  while (i < pattern.length) {
    if (pattern[i] === "\\" && i + 1 < pattern.length && BRE_META.has(pattern[i + 1])) {
      result += pattern[i + 1];
      i += 2;
    } else if (BRE_META.has(pattern[i])) {
      result += "\\" + pattern[i];
      i++;
    } else {
      result += pattern[i];
      i++;
    }
  }
  return result;
}

interface Token { text: string; pattern?: boolean }

function apply(action: Action, inline: string | undefined, args: string[], index: number, out: Token[]): { next: number; explicitPattern: boolean } | undefined {
  if (action.kind === "unsupported") return undefined;
  if (action.kind === "mode") return { next: index, explicitPattern: false };
  if (action.kind === "drop") return { next: index, explicitPattern: false };
  if (action.kind === "emit") {
    for (const t of action.to) out.push({ text: t });
    return { next: index, explicitPattern: false };
  }
  const val = inline !== undefined ? inline : args[index + 1];
  if (val === undefined) return { next: index, explicitPattern: false };
  const mapped = action.map ? action.map(val) : [val];
  for (const t of action.to) out.push({ text: t });
  for (const v of mapped) out.push({ text: v, pattern: action.to.includes("-e") });
  const isPattern = action.to.includes("-e") || action.to.includes("-f");
  return { next: inline !== undefined ? index : index + 1, explicitPattern: isPattern };
}

export function translateGrepArgs(args: string[], preset: Mode = "basic"): string[] | undefined {
  let regexMode = preset;
  const out: Token[] = [];
  let explicitPattern = false;
  let i = 0;

  while (i < args.length) {
    const arg = args[i];

    if (arg === "--") {
      out.push({ text: arg });
      i++;
      continue;
    }

    if (arg.startsWith("--")) {
      const eq = arg.indexOf("=");
      const name = eq < 0 ? arg.slice(2) : arg.slice(2, eq);
      const inline = eq < 0 ? undefined : arg.slice(eq + 1);
      if (name === "color" || name === "colour") {
        out.push({ text: inline ? "--color=" + inline : "--color=always" });
        i++;
        continue;
      }
      if (name === "binary-files") {
        if (inline === "without-match") {
          i++;
          continue;
        }
        if (inline === "text") {
          out.push({ text: "-a" });
          i++;
          continue;
        }
        if (inline === "binary") {
          out.push({ text: "--binary" });
          i++;
          continue;
        }
        return undefined;
      }
      if (inline !== undefined && name !== "color" && name !== "colour" && !["include", "exclude", "exclude-dir", "exclude-from", "regexp", "file", "max-count", "after-context", "before-context", "context"].includes(name)) {
        return undefined;
      }
      const action = FLAGS.get(name);
      if (!action) return undefined;
      if (action.kind === "mode") regexMode = action.mode;
      const applied = apply(action, inline, args, i, out);
      if (!applied) return undefined;
      if (applied.explicitPattern) explicitPattern = true;
      i = applied.next + 1;
      continue;
    }

    if (arg.length > 1 && arg[0] === "-" && /^[0-9]+$/.test(arg.slice(1))) {
      out.push({ text: "-C" }, { text: arg.slice(1) });
      i++;
      continue;
    }

    if (arg.length > 1 && arg[0] === "-") {
      let consumedNext = false;
      for (let p = 1; p < arg.length; p++) {
        const action = FLAGS.get(arg[p]);
        if (!action) return undefined;
        if (action.kind === "mode") {
          regexMode = action.mode;
          continue;
        }
        const rest = action.kind === "value" && p + 1 < arg.length ? arg.slice(p + 1) : undefined;
        const applied = apply(action, rest, args, i, out);
        if (!applied) return undefined;
        if (applied.explicitPattern) explicitPattern = true;
        if (applied.next > i) consumedNext = true;
        if (rest !== undefined) break;
      }
      i += consumedNext ? 2 : 1;
      continue;
    }

    out.push({ text: arg, pattern: !explicitPattern });
    explicitPattern = true;
    i++;
  }

  const convert = regexMode === "basic";
  return out.map((t) => t.pattern && convert ? convertBreToEre(t.text) : t.text);
}

export const grep: CommandRewrite = xargs((command) => {
  const preset: Mode | undefined = command.name === "egrep" || command.name === "zegrep"
    ? "extended"
    : command.name === "fgrep" || command.name === "zfgrep"
      ? "fixed"
      : undefined;
  if (!preset && !["grep", "zgrep", "bzgrep", "xzgrep"].includes(command.name)) return undefined;
  const compressed = ["zgrep", "zegrep", "zfgrep", "bzgrep", "xzgrep"].includes(command.name);
  const args = translateGrepArgs(command.args, preset ?? "basic");
  if (!args) return undefined;
  const prefix = compressed ? ["-z"] : [];
  if (preset === "fixed") prefix.push("-F");
  return { name: "rg", args: [...prefix, ...args] };
});
