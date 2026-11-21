import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
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
async function git(pi: ExtensionAPI, args: string[], cwd?: string): Promise<string> {
  const r = await pi.exec("git", args, { cwd, timeout: 120000 });
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
async function runUpdate(pi: ExtensionAPI, force: boolean): Promise<Result> {
  const result: Result = { updated: [], skipped: [], errors: [] };
  const cfg = await readJson<Config>(CONFIG);
  if (!cfg) { result.errors.push("缺少配置文件 " + CONFIG); return result; }
  const state = await readJson<State>(STATE) ?? { lastCheck: 0, repos: {}, skills: {} };
  if (!force && state.lastCheck && Date.now() - state.lastCheck < (cfg.checkIntervalHours ?? 6) * 3600_000) return result;

  await mkdir(CACHE, { recursive: true });
  for (const repo of cfg.repos) {
    const key = createHash("sha1").update(repo.repo).digest("hex").slice(0, 12);
    const branch = repo.branch ?? "main";
    try {
      const ref = (await git(pi, ["ls-remote", repo.repo, "refs/heads/" + branch])).split("\t")[0];
      if (!ref) throw new Error("无法获取远端 ref");
      const changed = state.repos[key]?.ref !== ref || !existsSync(path.join(CACHE, key, ".git"));
      const cache = await prepareCache(pi, repo, key, branch, changed);
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
          const src = item.from === "." ? cache : path.join(cache, item.from);
          await syncItem(src, to);
          state.skills[item.to] = { hash: await hashDir(to), ref };
          result.updated.push(name);
        } catch (err) { result.errors.push(name + ": " + (err as Error).message); }
      }
      state.repos[key] = { ref };
    } catch (err) { result.errors.push(repo.repo + ": " + (err as Error).message); }
  }

  for (const root of cfg.gitRoots ?? []) {
    const dir = resolve(root);
    let entries;
    try { entries = await readdir(dir, { withFileTypes: true }); } catch { continue; }
    for (const e of entries) {
      if (!e.isDirectory() || !existsSync(path.join(dir, e.name, ".git"))) continue;
      const p = path.join(dir, e.name);
      try {
        const status = await git(pi, ["status", "--porcelain"], p);
        if (status) { result.skipped.push(e.name + " (git 有本地修改)"); continue; }
        const out = await git(pi, ["pull", "--ff-only"], p);
        if (!/already up to date/i.test(out)) result.updated.push(e.name);
      } catch (err) { result.errors.push(e.name + ": " + (err as Error).message); }
    }
  }
  state.lastCheck = Date.now();
  await saveJson(STATE, state);
  return result;
}
function format(r: Result): string {
  const parts: string[] = [];
  if (r.updated.length) parts.push("已更新: " + r.updated.join(", "));
  if (r.skipped.length) parts.push("已跳过: " + r.skipped.join(", "));
  if (r.errors.length) parts.push("失败: " + r.errors.join("; "));
  return parts.length ? parts.join(" | ") : "技能均为最新";
}

export default function (pi: ExtensionAPI) {
  let running: Promise<Result> | undefined;
  const update = (force: boolean) => {
    if (!running) running = runUpdate(pi, force).finally(() => { running = undefined; });
    return running;
  };
  pi.on("session_start", async (event, ctx: ExtensionContext) => {
    if (event.reason !== "startup" && event.reason !== "reload") return;
    const r = await update(false);
    if (ctx.hasUI && (r.updated.length || r.skipped.length || r.errors.length)) ctx.ui.notify("技能更新: " + format(r), r.errors.length ? "warning" : "info");
  });
  pi.registerCommand("skill-update", {
    description: "立即检查并更新所有技能（备份后覆盖，跳过本地有修改的）",
    handler: async (_args, ctx) => {
      const r = await update(true);
      ctx.ui.notify(format(r), r.errors.length ? "warning" : "info");
    },
  });
}
