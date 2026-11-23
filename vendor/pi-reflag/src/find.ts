/**
 * Translate find command-line arguments to fd equivalents.
 *
 * Ported from:
 *   - kaofelix/greprip-rs src/fnd.rs (MIT)
 *   - kluzzebass/reflag translator/find2fd/translator.go (MIT)
 *
 * Local fork: one table of per-flag actions covering GNU find 4.10 --help.
 * Flags with no fd equivalent leave the command unrewritten.
 */
import type { CommandRewrite } from "./types.js";
import { xargs } from "./xargs.js";

export type IgnoreMode = "ignore" | "no-ignore" | "auto";

export const KNOWN_IGNORED_DIRS: string[] = [
  // Node.js / JavaScript package managers
  "node_modules",
  ".yarn",
  ".pnpm-store",

  // Bundler / tool caches
  ".parcel-cache",
  ".turbo",
  ".vite",
  ".cache",
  ".eslintcache",
  ".stylelintcache",

  // Framework build outputs
  ".next",
  ".nuxt",
  ".svelte-kit",
  ".vuepress",
  ".output",
  ".docusaurus",
  ".temp",
  ".serverless",
  ".firebase",

  // Generic build outputs
  "dist",
  "build",
  "out",
  "target",
  "debug",
  "obj",
  "artifacts",
  "_deps",
  "CMakeFiles",

  // Test coverage
  "coverage",
  ".nyc_output",
  ".hypothesis",

  // Python
  "__pycache__",
  ".pytest_cache",
  ".tox",
  ".nox",
  ".venv",
  "venv",
  ".ipynb_checkpoints",

  // Ruby / PHP
  "vendor",
  ".bundle",

  // JVM build tools
  ".gradle",
  ".mvn",

  // Elixir
  "_build",
  "deps",

  // Version control internals
  ".git",
];

export function shouldDisableIgnore(paths: string[], mode: IgnoreMode): boolean {
  if (mode === "no-ignore") {
    return true;
  }
  if (mode === "ignore") {
    return false;
  }
  const ignoredSet = new Set(KNOWN_IGNORED_DIRS);
  return paths.some((p) => p.split(/[/\\]/).some((component) => ignoredSet.has(component)));
}

type Action =
  | { kind: "drop" }
  | { kind: "emit"; to: string[] }
  | { kind: "value"; to: string[]; map?: (v: string) => string[] }
  | { kind: "mapped"; map: (v: string) => string[] | undefined }
  | { kind: "pattern"; target: "glob" | "path" | "regex"; icase?: boolean }
  | { kind: "exec" }
  | { kind: "unsupported" };

const DROP: Action = { kind: "drop" };
const NO: Action = { kind: "unsupported" };
const emit = (...to: string[]): Action => ({ kind: "emit", to });
const value = (...to: string[]): Action => ({ kind: "value", to });
const glob = (icase = false): Action => ({ kind: "pattern", target: "glob", icase });
const pathPattern = (icase = false): Action => ({ kind: "pattern", target: "path", icase });
const regex = (icase = false): Action => ({ kind: "pattern", target: "regex", icase });

function translateDuration(val: string, unit: "d" | "min"): string[] | undefined {
  if (val.startsWith("-")) {
    return ["--changed-within", val.slice(1) + unit];
  }
  if (val.startsWith("+")) {
    return ["--changed-before", val.slice(1) + unit];
  }
  // Unsigned means "exactly N days/mins ago" — fd has no equivalent, bail
  return undefined;
}

function translateSize(val: string): string[] | undefined {
  const m = /^([+-]?)(\d+)([cwkMGb])?$/.exec(val);
  if (!m) return undefined;
  const [, sign, num, unit] = m;
  // find: c=bytes, M/G=MiB/GiB; bare/k/w/b count 512-byte blocks or words
  switch (unit) {
    case "c": return [sign + num + "b"];
    case "M": return [sign + num + "mi"];
    case "G": return [sign + num + "gi"];
    default: return undefined;
  }
}

/** One entry per GNU find flag; long names omit the leading "--". */
const FLAGS: ReadonlyMap<string, Action> = new Map<string, Action>([
  // positional options
  ["H", DROP], ["L", emit("-L")], ["P", DROP], ["follow", emit("-L")],
  ["daystart", NO], ["warn", DROP], ["nowarn", DROP], ["regextype", NO],
  ["help", NO], ["version", NO],
  // normal options
  ["depth", DROP], ["files0-from", NO], ["maxdepth", value("-d")], ["mindepth", value("--min-depth")],
  ["mount", emit("--one-file-system")], ["xdev", emit("--one-file-system")],
  ["noleaf", DROP], ["ignore_readdir_race", DROP], ["noignore_readdir_race", DROP],
  // tests: fd only tracks mtime, so atime/ctime variants bail
  ["amin", NO], ["anewer", NO], ["atime", NO], ["cmin", NO], ["cnewer", NO], ["ctime", NO],
  ["context", NO], ["empty", emit("-t", "e")], ["false", NO], ["true", DROP], ["fstype", NO],
  ["gid", { kind: "mapped", map: (v) => ["--owner", ":" + v] }],
  ["group", { kind: "mapped", map: (v) => ["--owner", ":" + v] }],
  ["ilname", NO], ["lname", NO],
  ["iname", glob(true)], ["name", glob()],
  ["inum", NO], ["links", NO], ["used", NO],
  ["ipath", pathPattern(true)], ["iwholename", pathPattern(true)],
  ["path", pathPattern()], ["wholename", pathPattern()],
  ["iregex", regex(true)], ["regex", regex()],
  ["mmin", { kind: "mapped", map: (v) => translateDuration(v, "min") ?? [] }],
  ["mtime", { kind: "mapped", map: (v) => translateDuration(v, "d") ?? [] }],
  ["newer", value("--newer")], ["nouser", NO], ["nogroup", NO], ["perm", NO],
  ["readable", NO], ["writable", NO], ["executable", emit("-t", "x")],
  ["size", { kind: "mapped", map: (v) => { const s = translateSize(v); return s ? ["-S", ...s] : []; } }],
  ["type", value("-t")],
  ["uid", value("--owner")], ["user", value("--owner")], ["xtype", NO],
  // actions
  ["delete", NO], ["print0", emit("-0")], ["print", DROP], ["ls", emit("-l")],
  ["fprint", NO], ["fprint0", NO], ["printf", NO], ["fprintf", NO], ["fls", NO],
  ["prune", DROP], ["quit", emit("-1")],
  ["exec", { kind: "exec" }], ["execdir", { kind: "exec" }],
  ["ok", NO], ["okdir", NO],
]);

function stripAnchors(pat: string): string {
  return pat
    .replace(/^\.\//, "")
    .replace(/^\*\//, "")
    .replace(/\/\*$/, "")
    .replace(/\*$/, "");
}

function parseExecArgs(args: string[], startIndex: number): {
  execArgs: string[]; isBatch: boolean; endIndex: number;
} {
  const execArgs: string[] = [];
  let i = startIndex;
  let isBatch = false;
  while (i < args.length) {
    if (args[i] === ";" || args[i] === "\\;") {
      i++;
      break;
    }
    if (args[i] === "+") {
      isBatch = true;
      i++;
      break;
    }
    execArgs.push(args[i]);
    i++;
  }
  return { execArgs, isBatch, endIndex: i };
}

function collectLeadingOptions(args: string[]): { options: string[]; cursor: number } | undefined {
  const options: string[] = [];
  let cursor = 0;
  while (cursor < args.length) {
    const arg = args[cursor];
    if (arg === "-L" || arg === "-follow") {
      options.push("-L");
      cursor++;
    } else if (arg === "-H" || arg === "-P") {
      cursor++;
    } else if (arg === "-D" || arg === "-O" || /^-O\d+$/.test(arg)) {
      // fd has no optimizer/debug-option equivalent
      return undefined;
    } else {
      break;
    }
  }
  return { options, cursor };
}

function collectPaths(args: string[], cursor: number): { paths: string[]; cursor: number } {
  const paths: string[] = [];
  while (cursor < args.length) {
    const arg = args[cursor];
    if (arg.startsWith("-") || arg === "!" || arg === "(" || arg === ")") {
      break;
    }
    // skip "." — fd defaults to current directory
    if (arg !== ".") {
      paths.push(arg);
    }
    cursor++;
  }
  return { paths, cursor };
}

type Token =
  | { kind: "raw"; text: string }
  | { kind: "glob" | "path"; value: string; negate?: boolean }
  | { kind: "regex"; value: string };

export function translateFindArgs(
  args: string[],
  ignoreMode: IgnoreMode = "auto",
): string[] | undefined {
  const result: string[] = ["-H"];

  const leadingPaths = collectLeadingOptions(args);
  if (!leadingPaths) return undefined;
  result.push(...leadingPaths.options);
  const pathsResult = collectPaths(args, leadingPaths.cursor);
  const { paths } = pathsResult;

  const out: Token[] = [];
  const execArgs: string[] = [];
  const caseModes = new Set<boolean>();
  let negate = false;
  let i = pathsResult.cursor;

  while (i < args.length) {
    const arg = args[i];

    // Operators are consumed, but a comma is a distinct find OR — can't express it
    if (arg === "(" || arg === ")" || arg === "-a" || arg === "-and" || arg === "-o" || arg === "-or") {
      i++;
      continue;
    }
    if (arg === "," || arg === "--") {
      return undefined;
    }
    if (arg === "!" || arg === "-not") {
      negate = true;
      i++;
      continue;
    }

    if (!arg.startsWith("-")) {
      // find allows paths interleaved with expressions
      if (arg !== ".") paths.push(arg);
      i++;
      continue;
    }

    // GNU find flags are whole words (some take values), not short clusters
    const eq = arg.startsWith("--") ? arg.indexOf("=") : -1;
    const name = eq < 0 ? arg.replace(/^-+/, "") : arg.slice(2, eq);
    const inline = eq < 0 ? undefined : arg.slice(eq + 1);
    const action = FLAGS.get(name);
    if (!action) return undefined;

    if (action.kind === "unsupported") return undefined;
    if (action.kind === "drop") {
      if (negate) return undefined;
      if (name === "prune") {
        const last = out[out.length - 1];
        if (last && (last.kind === "glob" || last.kind === "path") && !last.negate) {
          last.negate = true;
          if (last.kind === "path") last.value = stripAnchors(last.value);
        }
      }
      i++;
      continue;
    }
    if (action.kind === "pattern") {
      const val = inline ?? args[i + 1];
      if (val === undefined) return undefined;
      caseModes.add(!!action.icase);
      if (action.icase) out.push({ kind: "raw", text: "-i" });
      if (action.target === "regex") {
        if (negate) return undefined;
        out.push({ kind: "regex", value: val });
      } else {
        out.push({
          kind: action.target,
          value: action.target === "path" && negate ? stripAnchors(val) : val,
          negate,
        });
      }
      i += inline === undefined ? 2 : 1;
      continue;
    }

    if (action.kind === "exec") {
      if (negate) return undefined;
      const { execArgs: cmd, isBatch, endIndex } = parseExecArgs(args, i + 1);
      execArgs.push(isBatch ? "-X" : "-x", ...cmd);
      i = endIndex;
      continue;
    }

    if (negate) return undefined;
    let emitted: string[];
    let consumed = 1;
    if (action.kind === "emit") {
      if (inline !== undefined) return undefined;
      emitted = action.to;
    } else {
      const val = inline ?? args[i + 1];
      if (val === undefined) return undefined;
      consumed = inline === undefined ? 2 : 1;
      if (action.kind === "mapped") {
        emitted = action.map(val) ?? [];
        if (emitted.length === 0) return undefined;
      } else {
        emitted = [...action.to, ...(action.map ? action.map(val) : [val])];
      }
    }
    for (const text of emitted) out.push({ kind: "raw", text });
    i += consumed;
  }

  // fd has one case mode and one glob flag; mixed case patterns can't be expressed
  if (caseModes.size > 1) return undefined;
  // fd ORs repeated --type/--owner filters; find ANDs them
  const rawFlags = out.filter((t) => t.kind === "raw").map((t) => t.text);
  if (["-t", "--owner"].some((flag) => rawFlags.filter((f) => f === flag).length > 1)) {
    return undefined;
  }
  if (out.filter((t) => t.kind === "regex").length > 1) return undefined;
  if (shouldDisableIgnore(paths, ignoreMode)) {
    result.splice(1, 0, "--no-ignore");
  }

  const globs: string[] = [];
  for (const token of out) {
    if (token.kind === "raw") {
      result.push(token.text);
    } else if (token.kind === "regex") {
      result.push(token.value);
    } else if (token.negate) {
      result.push("-E", token.value);
    } else if (token.kind === "glob") {
      globs.push(token.value);
    } else {
      result.push("-p", token.value);
    }
  }

  if (globs.length > 0) {
    if (globs.some((g) => g.includes(","))) return undefined;
    result.push("-g", globs.length === 1 ? globs[0] : "{" + globs.join(",") + "}");
  } else if (!out.some((t) => t.kind === "regex") && paths.length > 0) {
    // fd requires a pattern before path args; "." matches everything
    result.push(".");
  }

  result.push(...paths, ...execArgs);
  return result;
}

export function createFind(ignoreMode: IgnoreMode): CommandRewrite {
  return xargs((command) => {
    if (command.name === "find") {
      const args = translateFindArgs(command.args, ignoreMode);
      if (args) {
        return { name: "fd", args };
      }
    }
  });
}
