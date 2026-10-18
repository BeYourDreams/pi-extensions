#!/usr/bin/env node
/**
 * sync-drama-skills.mjs — drama 技能的**唯一更新通道**：本仓库 skills/ ⇄ ~/.pi/agent/skills/
 *
 * 策略（2026-10-18 起）：**不再运行上游安装器**。上游 `npx skills add zenstory-ai/drama-skills -y -g`
 * 会按技能整目录覆盖全局目录，把本地补丁静默盖回，还会重新装回我们已卸载的三件
 * （short-drama-write / -storyboard / -video-prompts，内容已并入 short-drama-pro）。
 *
 * 因此全局安装只从本仓库镜像来：改这里 → `install` → 提交。上游仓库降级为参考快照，
 * 版本与人工吸收流程记录在 `skills/UPSTREAM.md`。
 *
 * 用法：
 *   node sync-drama-skills.mjs check     # 体检：本仓库镜像与全局安装是否漂移（默认）
 *   node sync-drama-skills.mjs install   # 安装/更新到全局：逐文件镜像，并删除全局多出的文件
 *   node sync-drama-skills.mjs save      # 抢救：全局 → 本仓库（只在确认真改在全局侧时用；不删文件）
 *
 * 四个自检（install 后复核，Windows 无 python3 时用 python）：
 *   cd ~/.pi/agent/skills/short-drama-pro/scripts
 *   python pro_check.py --selftest && python selftest_write.py && python selftest_storyboard.py && python selftest_video.py
 *   cd ../../short-drama/scripts && python selftest.py
 */
import { promises as fs } from "node:fs";
import path from "node:path";
import os from "node:os";

const PROJECT_SKILLS = path.join(import.meta.dirname, "skills");
const GLOBAL_SKILLS = path.join(os.homedir(), ".pi", "agent", "skills");
// 与全局安装存在双源、由本脚本守护的技能（drama 线全部九件）：
const CUSTOM = [
  "short-drama",
  "short-drama-assets",
  "short-drama-develop",
  "short-drama-edit",
  "short-drama-image-prompts",
  "short-drama-novel-analyze",
  "short-drama-pro",
  "short-drama-produce",
  "short-drama-review",
];
// 已卸载（内容并入 short-drama-pro）：安装器若把它们装回来，install 会删掉；
// 这里额外守一道，防止它们被误装成第十、十一件。
const RETIRED = [
  "short-drama-write",
  "short-drama-storyboard",
  "short-drama-video-prompts",
];

async function walk(dir, base = dir) {
  const out = new Map();
  if (!(await fs.stat(dir).catch(() => null))) return out;
  for (const e of await fs.readdir(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name === "__pycache__" || e.name === "node_modules") continue;
      for (const [k, v] of await walk(p, base)) out.set(k, v);
    } else {
      out.set(path.relative(base, p), p);
    }
  }
  return out;
}

async function compare(aDir, bDir, labelA, labelB) {
  const [a, b] = await Promise.all([walk(aDir), walk(bDir)]);
  const findings = [];
  for (const [rel, pa] of a) {
    const pb = b.get(rel);
    if (!pb) {
      findings.push(`  仅${labelA}: ${rel}`);
      continue;
    }
    const [ca, cb] = await Promise.all([fs.readFile(pa), fs.readFile(pb)]);
    if (!ca.equals(cb)) findings.push(`  内容不同: ${rel}`);
  }
  for (const rel of b.keys()) if (!a.has(rel)) findings.push(`  仅${labelB}: ${rel}`);
  return findings;
}

async function copyTree(fromDir, toDir) {
  const files = await walk(fromDir);
  for (const [rel, src] of files) {
    const dst = path.join(toDir, rel);
    await fs.mkdir(path.dirname(dst), { recursive: true });
    await fs.copyFile(src, dst);
  }
  return files.size;
}

/** Exact-mirror step: drop files the source no longer has, then empty dirs. */
async function pruneTree(fromDir, toDir) {
  const keep = new Set((await walk(fromDir)).keys());
  const existing = await walk(toDir);
  const removed = [];
  for (const rel of existing.keys()) {
    if (keep.has(rel)) continue;
    await fs.rm(path.join(toDir, rel));
    removed.push(rel);
  }
  const pruneEmpty = async (dir) => {
    for (const e of await fs.readdir(dir, { withFileTypes: true })) {
      if (!e.isDirectory() || e.name === "__pycache__") continue;
      const child = path.join(dir, e.name);
      await pruneEmpty(child);
      if ((await fs.readdir(child)).length === 0) await fs.rmdir(child);
    }
  };
  if (await fs.stat(toDir).catch(() => null)) await pruneEmpty(toDir);
  return removed;
}

async function main() {
  const mode = process.argv[2] || "check";
  if (!["check", "install", "save"].includes(mode)) {
    console.error(`未知模式 ${mode}；用法：check | install | save`);
    process.exitCode = 2;
    return;
  }

  let drift = 0;
  for (const skill of CUSTOM) {
    const p = path.join(PROJECT_SKILLS, skill);
    const g = path.join(GLOBAL_SKILLS, skill);
    if (!(await fs.stat(p).catch(() => null))) {
      console.log(`!! 本仓库缺 skills/${skill}（镜像不完整，先 save 或补齐）`);
      drift++;
      continue;
    }
    if (mode === "install") {
      const n = await copyTree(p, g);
      const removed = await pruneTree(p, g);
      console.log(
        `install ${skill}: ${n} 个文件${removed.length ? `，删除全局多余 ${removed.length}（${removed.slice(0, 3).join(", ")}${removed.length > 3 ? " …" : ""}）` : ""}`,
      );
      continue;
    }
    if (mode === "save") {
      const n = await copyTree(g, p);
      console.log(`save ${skill}: ${n} 个文件（未删除本仓库多余文件）`);
      continue;
    }
    const findings = await compare(p, g, "本仓库", "全局");
    if (findings.length) {
      drift++;
      console.log(`✗ ${skill} 漂移（${findings.length} 项）：`);
      console.log(findings.join("\n"));
    } else {
      console.log(`✓ ${skill} 与本仓库一致`);
    }
  }

  if (mode === "install") {
    const strays = [];
    for (const skill of RETIRED) {
      const dir = path.join(GLOBAL_SKILLS, skill);
      if (await fs.stat(dir).catch(() => null)) {
        const n = (await walk(dir)).size;
        await fs.rm(dir, { recursive: true, force: true });
        strays.push(`${skill}（${n} 文件）`);
      }
    }
    if (strays.length) console.log(`删除已退役技能（内容已并入 short-drama-pro）：${strays.join("、")}`);
    console.log("\n已应用到全局。复核自检见脚本头注释；再跑 `check` 应为无漂移。");
    return;
  }

  if (mode === "check") {
    console.log(
      drift
        ? `\n${drift} 个技能存在漂移。若漂移来自全局侧的手改，用 save 回收；若本仓库才是准的，用 install 覆盖。`
        : "\n无漂移：全局安装与本仓库镜像一致。",
    );
    process.exitCode = drift ? 1 : 0;
  }
}

main().catch((e) => {
  console.error(e.message);
  process.exit(2);
});
