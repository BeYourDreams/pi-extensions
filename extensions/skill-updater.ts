import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { createHash } from "node:crypto";
import { existsSync, globSync } from "node:fs";
import { cp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import path from "node:path";

const ROOT = path.join(homedir(), ".pi", "agent");
const CONFIG = path.join(ROOT, "skill-updater.json");
const STATE = path.join(ROOT, "skill-updater-state.json");
const CACHE = path.join(ROOT, "skill-updater-cache");
const BACKUPS = path.join(ROOT, "skill-updater-backups");

type Item = { from: string; to: string };
type Repo = { repo: string; branch?: string; mode?: "sync" | "adopt"; items: Item[] };
type Config = { checkIntervalHours?: number; gitRoots?: string[]; repos: Repo[] };
type Rec = { hash: string | null; ref: string };
type State = { lastCheck: number; repos: Record<string, { ref: string }>; skills: Record<string, Rec> };
type Result = { updated: string[]; skipped: string[]; errors: string[] };

const resolve = (p: string) => p.startsWith("~") ? path.join(homedir(), p.slice(1).replace(/^[\/]/, "")) : p;

const MARK = "disable-model-invocation: true";
/** 插件自己加的标记不算本地修改：更新后重打，避免每次都被 git 脏检查拦住。 */
export async function markSkills(dir: string): Promise<number> {
  let marked = 0;
  for (const rel of globSync("**/SKILL.md", { cwd: dir })) {
    const file = path.join(dir, rel);
    const src = await readFile(file, "utf8");
    const close = src.indexOf("---", 3);
    if (!src.startsWith("---") || close < 0 || src.slice(0, close).includes(MARK)) continue;
    await writeFile(file, src.slice(0, close) + MARK + "\n" + src.slice(close));
    marked++;
  }
  return marked;
}
export function markerOnly(status: string, diff: string): boolean {
  const rows = status.split("\n").filter(Boolean).map((r) => r.trimStart());
  if (!rows.length || !rows.every((r) => /^M /.test(r))) return false;
  const lines = diff.split("\n");
  return !lines.some((l) => /^-[^-]/.test(l)) && lines.filter((l) => /^\+[^+]/.test(l)).every((l) => l === "+" + MARK);
}

async function readJson<T>(file: string): Promise<T | null> {
  try { return JSON.parse(await readFile(file, "utf8")) as T; } catch { return null; }
}
async function saveJson(file: string, value: unknown) {
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, JSON.stringify(value, null, 2) + "\n");
}
async function hashDir(dir: string): Promise<string | null> {
  if (!existsSync(dir)) return null;
  const hash = createHash("sha256");
  async function walk(d: string, rel: string) {
    const entries = (await readdir(d, { withFileTypes: true }))
      .filter(e => e.name !== ".git" && e.name !== "node_modules")
      .sort((a, b) => a.name.localeCompare(b.name));
    for (const e of entries) {
      const r = rel ? rel + "/" + e.name : e.name;
      const full = path.join(d, e.name);
      if (e.isDirectory()) await walk(full, r);
      else if (e.isFile()) { hash.update(r); hash.update(await readFile(full)); }
    }
  }
  await walk(dir, "");
  return hash.digest("hex");
}
// ponytail: 加速源 5s 没结果就回退直连；换源只改这里，不做健康探测。
const MIRROR_CONFIG = "url.https://ghfast.top/https://github.com/.insteadOf=https://github.com/";
const MIRROR_TIMEOUT_MS = 5000;
const GIT_TIMEOUT_MS = 120000;
const REMOTE_GIT = new Set(["ls-remote", "clone", "fetch", "pull"]);
async function git(pi: ExtensionAPI, args: string[], cwd?: string): Promise<string> {
  const useMirror = REMOTE_GIT.has(args[0]);
  let r = await pi.exec("git", useMirror ? ["-c", MIRROR_CONFIG, ...args] : args,
    { cwd, timeout: useMirror ? MIRROR_TIMEOUT_MS : GIT_TIMEOUT_MS });
  if (useMirror && (r.killed || r.code !== 0)) r = await pi.exec("git", args, { cwd, timeout: GIT_TIMEOUT_MS });
  if (r.code !== 0) throw new Error("git " + args.join(" ") + ": " + (r.stderr || r.stdout).slice(0, 300));
  return r.stdout.trim();
}
async function prepareCache(pi: ExtensionAPI, repo: Repo, key: string, branch: string, changed: boolean) {
  const dir = path.join(CACHE, key);
  if (!changed) return dir;
  if (!existsSync(path.join(dir, ".git"))) {
    await mkdir(CACHE, { recursive: true });
    await git(pi, ["clone", "--depth", "1", "--branch", branch, repo.repo, dir]);
  } else {
    await git(pi, ["fetch", "--depth", "1", "origin", branch], dir);
    await git(pi, ["reset", "--hard", "FETCH_HEAD"], dir);
  }
  return dir;
}
async function syncItem(src: string, to: string) {
  if (!existsSync(src)) throw new Error("上游缺少目录: " + src);
  await mkdir(path.dirname(BACKUPS), { recursive: true });
  if (existsSync(to)) await cp(to, path.join(BACKUPS, path.basename(to) + "-" + Date.now()), { recursive: true });
  await rm(to, { recursive: true, force: true });
  await cp(src, to, { recursive: true });
}
async function runUpdate(pi: ExtensionAPI, force: boolean, checkOnly = false, forceLocal = false): Promise<Result> {
  const result: Result = { updated: [], skipped: [], errors: [] };
  const cfg = await readJson<Config>(CONFIG);
  if (!cfg) { result.errors.push("缺少配置文件 " + CONFIG); return result; }
  const state = await readJson<State>(STATE) ?? { lastCheck: 0, repos: {}, skills: {} };
  if (!force && !checkOnly && state.lastCheck && Date.now() - state.lastCheck < (cfg.checkIntervalHours ?? 6) * 3600_000) return result;

  await mkdir(CACHE, { recursive: true });
  // 远端 ref 一次性并发取回：串行 5 个仓库会叠加镜像延迟；失败逐个记账，不拖垮其他仓库。
  const refs = new Map<string, string>();
  const refErrors = new Map<string, string>();
  const probes: Promise<void>[] = [];
  for (const repo of cfg.repos) {
    const key = createHash("sha1").update(repo.repo).digest("hex").slice(0, 12);
    probes.push((async () => {
      try {
        const ref = (await git(pi, ["ls-remote", repo.repo, "refs/heads/" + (repo.branch ?? "main")])).split("\t")[0];
        if (!ref) throw new Error("无法获取远端 ref");
        refs.set(key, ref);
      } catch (err) { refErrors.set(key, (err as Error).message); }
    })());
  }
  const localDirs: string[] = [];
  for (const root of cfg.gitRoots ?? []) {
    const dir = resolve(root);
    let entries;
    try { entries = await readdir(dir, { withFileTypes: true }); } catch { continue; }
    for (const e of entries) {
      if (e.isDirectory() && existsSync(path.join(dir, e.name, ".git"))) localDirs.push(path.join(dir, e.name));
    }
  }
  if (checkOnly) for (const p of localDirs) probes.push((async () => {
    try {
      const branch = await git(pi, ["rev-parse", "--abbrev-ref", "HEAD"], p);
      const ref = (await git(pi, ["ls-remote", "origin", "refs/heads/" + branch], p)).split("\t")[0];
      if (!ref) throw new Error("无法获取远端 ref");
      refs.set(p, ref);
    } catch (err) { refErrors.set(p, (err as Error).message); }
  })());
  await Promise.all(probes);
  for (const repo of cfg.repos) {
    const key = createHash("sha1").update(repo.repo).digest("hex").slice(0, 12);
    const branch = repo.branch ?? "main";
    try {
      const ref = refs.get(key);
      if (refErrors.has(key)) throw new Error(refErrors.get(key));
      if (!ref) throw new Error("无法获取远端 ref");
      const changed = state.repos[key]?.ref !== ref || !existsSync(path.join(CACHE, key, ".git"));
      const cache = checkOnly ? "" : await prepareCache(pi, repo, key, branch, changed);
      for (const item of repo.items) {
        const to = resolve(item.to);
        const name = path.basename(to);
        const rec = state.skills[item.to];
        try {
          const hash = await hashDir(to);
          if (repo.mode === "adopt") {
            if (!rec) state.skills[item.to] = { hash, ref };
            else if (changed) result.skipped.push(name + " (只读采用，上游有更新)");
            continue;
          }
          if (!changed && rec?.ref === ref) continue;
          if (rec && rec.hash !== hash) { result.skipped.push(name + " (本地有修改)"); continue; }
          if (checkOnly) { result.updated.push(name + " (可更新)"); continue; }
          const src = item.from === "." ? cache : path.join(cache, item.from);
          await syncItem(src, to);
          state.skills[item.to] = { hash: await hashDir(to), ref };
          result.updated.push(name);
        } catch (err) { result.errors.push(name + ": " + (err as Error).message); }
      }
      if (!checkOnly) state.repos[key] = { ref };
    } catch (err) { result.errors.push(repo.repo + ": " + (err as Error).message); }
  }

  for (const p of localDirs) {
    const name = path.basename(p);
    try {
      if (checkOnly) {
        if (refErrors.has(p)) throw new Error(refErrors.get(p));
        const remoteRef = refs.get(p);
        if (!remoteRef) throw new Error("无法获取远端 ref");
        const localRef = await git(pi, ["rev-parse", "HEAD"], p);
        if (remoteRef !== localRef) result.updated.push(name + " (可更新)");
        continue;
      }
      const status = await git(pi, ["status", "--porcelain"], p);
      let note = "";
      if (status) {
        const files = status.split("\n").filter(Boolean).map((r) => r.replace(/^[MARCD?! ]{1,2}\s/, ""));
        const diff = await git(pi, ["diff", "HEAD", "--unified=0", "--", ...files], p);
        if (markerOnly(status, diff)) {
          await git(pi, ["checkout", "--", ...files], p);
        } else if (forceLocal) {
          await cp(p, path.join(BACKUPS, name + "-force-" + Date.now()), { recursive: true });
          await git(pi, ["reset", "--hard"], p);
          await git(pi, ["clean", "-fd"], p);
          note = " (本地修改已备份并丢弃)";
        } else {
          result.skipped.push(name + " (git 有本地修改)");
          continue;
        }
      }
      const out = await git(pi, ["pull", "--ff-only"], p);
      if (!/already up to date/i.test(out) || status) result.updated.push(name + note);
      await markSkills(p);
    } catch (err) { result.errors.push(name + ": " + (err as Error).message); }
  }
  if (!checkOnly) {
    state.lastCheck = Date.now();
    await saveJson(STATE, state);
  }
  return result;
}
function format(r: Result, checkOnly = false): string {
  const parts: string[] = [];
  if (r.updated.length) parts.push((checkOnly ? "可更新: " : "已更新: ") + r.updated.join(", "));
  if (r.skipped.length) parts.push("已跳过: " + r.skipped.join(", "));
  if (r.errors.length) parts.push("失败: " + r.errors.join("; "));
  return parts.length ? parts.join(" | ") : "技能均为最新";
}

export default function (pi: ExtensionAPI) {
  let running: Promise<Result> | undefined;
  const update = (force: boolean, forceLocal = false) => {
    if (!running) running = runUpdate(pi, force, false, forceLocal).finally(() => { running = undefined; });
    return running;
  };
  pi.on("session_start", (event, ctx: ExtensionContext) => {
    if (event.reason !== "startup" && event.reason !== "reload") return;
    // ctx 在会话替换后会失效；后台回调只用启动时抓到的 notify
    const hasUI = ctx.hasUI;
    const notify = hasUI ? ctx.ui.notify.bind(ctx.ui) : undefined;
    const tell = (msg: string, level: "info" | "warning") => {
      try { notify?.(msg, level); } catch { /* 会话已替换，丢弃提示 */ }
    };
    // 远端检查不 await，否则 git ls-remote 会卡住 session_start
    void runUpdate(pi, false, true).then((r) => {
      tell("技能检查: " + format(r, true) + "。如需更新运行 /skill-update", "info");
    }).catch((err: Error) => tell("技能更新检查失败: " + err.message, "warning"));
  });
  pi.registerCommand("skill-update", {
    description: "立即更新所有技能；--force 备份并丢弃 git 技能的本地修改后更新（插件标记的懒加载行会自动补回）",
    getArgumentCompletions: (prefix: string) => "--force".startsWith(prefix) ? [{ value: "--force", label: "--force 强制更新" }] : null,
    handler: async (args, ctx) => {
      const forceLocal = args.trim() === "force" || /(?:^|\s)--force(?:\s|$)/.test(args);
      const r = await update(true, forceLocal);
      ctx.ui.notify(format(r), r.errors.length ? "warning" : "info");
    },
  });
}
