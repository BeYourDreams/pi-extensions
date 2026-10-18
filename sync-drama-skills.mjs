#!/usr/bin/env node
/**
 * sync-drama-skills.mjs — 保护本仓库定制过的 short-drama 技能不被上游更新静默覆盖。
 *
 * 背景：drama-skills 用 `npx skills add zenstory-ai/drama-skills -y -g` 安装，
 * 升级=重跑同一条命令，会整目录覆盖全局技能目录（~/.pi/agent/skills）。
 * 本项目 skills/ 是全局已装 drama 技能的镜像与编辑源（canonical）：
 *
 *   short-drama-pro        —— 自包含创作链（剧本/分镜/视频提示词），复刻并取代原
 *                             write/storyboard/video-prompts 三件；上游不认识该名字，
 *                             升级不会碰它。内含 SCR-23/SHT-30/SHT-31/VID-28 补丁、
 *                             全部深度参考、三阶段检查器、pro_check.py。
 *   short-drama（router）  —— 路由表已指向 $short-drama-pro；含 creator_markdown_check.py
 *                             等跨文档终审脚本。
 *   short-drama-assets / -develop / -edit / -image-prompts / -novel-analyze /
 *   -produce / -review    —— 其余七个阶段技能，引用已同步指向 pro。
 *
 * 已卸载（2026-10-18，项目侧与全局侧均移除，内容已并入 pro）：
 *   short-drama-write / short-drama-storyboard / short-drama-video-prompts
 *   旧文件在 git 历史（提交 b611013 / 2089f9b）与 ~/.pi/agent/skills-backup/ 可查。
 *
 * 用法：
 *   node sync-drama-skills.mjs check     # 对比项目与全局安装目录，报告漂移（默认）
 *   node sync-drama-skills.mjs install   # 项目 → 全局（上游升级重跑安装命令后，执行这个重放定制）
 *   node sync-drama-skills.mjs save      # 全局 → 项目（只用于抢救：确认全局侧有未回收的改动时）
 *
 * 上游升级标准流程：
 *   1) npx skills add zenstory-ai/drama-skills -y -g
 *   2) node sync-drama-skills.mjs check     ← 应能看到被上游盖回的差异
 *   3) 把上游新改动合入本项目 skills/（git diff 审），CHANGELOG 里的收紧项按需吸收
 *   4) node sync-drama-skills.mjs install   ← 重放定制版
 *   5) 进各技能 scripts/ 跑 python selftest.py 复核
 */
import { promises as fs } from "node:fs";
import path from "node:path";
import os from "node:os";

const PROJECT_SKILLS = path.join(import.meta.dirname, "skills");
const GLOBAL_SKILLS = path.join(os.homedir(), ".pi", "agent", "skills");
// 与全局安装存在双源、需要本脚本守护的技能：
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

async function main() {
  const mode = process.argv[2] || "check";
  let drift = 0;
  for (const skill of CUSTOM) {
    const p = path.join(PROJECT_SKILLS, skill);
    const g = path.join(GLOBAL_SKILLS, skill);
    if (!(await fs.stat(p).catch(() => null))) {
      console.log(`!! 项目缺 skills/${skill}`);
      drift++;
      continue;
    }
    if (mode === "install" || mode === "save") {
      const [from, to] = mode === "install" ? [p, g] : [g, p];
      const n = await copyTree(from, to);
      console.log(`${mode} ${skill}: ${n} 个文件`);
      continue;
    }
    const findings = await compare(p, g, "项目", "全局");
    if (findings.length) {
      drift++;
      console.log(`✗ ${skill} 漂移（${findings.length} 项）：`);
      console.log(findings.join("\n"));
    } else {
      console.log(`✓ ${skill} 与全局一致`);
    }
  }
  if (mode === "check") {
    console.log(drift ? `\n${drift} 个技能存在漂移：上游重跑安装命令会盖掉定制版，请先按脚本头部注释的流程处理。` : "\n无漂移。");
    process.exitCode = drift ? 1 : 0;
  }
}

main().catch((e) => {
  console.error(e.message);
  process.exit(2);
});
