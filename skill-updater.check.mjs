// 启动只提醒、不更新，且不阻塞 session_start：node ~/.pi/agent/skill-updater.check.mjs
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { homedir } from 'node:os';

const root = path.join(homedir(), '.pi', 'agent');
const state = path.join(root, 'skill-updater-state.json');
const before = readFileSync(state, 'utf8');
const saved = JSON.parse(before);
const { default: init } = await import(new URL('./extensions/skill-updater.ts', import.meta.url).href);

let onStart;
let command;
const calls = [];
let mirrored = false;
init({
  on: (name, fn) => { if (name === 'session_start') onStart = fn; },
  registerCommand: (name, def) => { command = { name, def }; },
  exec: async (_cmd, args) => {
    mirrored ||= args[0] === '-c';
    const call = args[0] === '-c' ? args.slice(2) : args;
    calls.push(call[0]);
    const key = createHash('sha1').update(call[1] ?? '').digest('hex').slice(0, 12);
    const ref = saved.repos[key]?.ref ?? 'deadbeef';
    return { code: 0, stdout: call[0] === 'ls-remote' ? ref + '\trefs/heads/main' : ref, stderr: '' };
  },
});
assert.equal(command?.name, 'skill-update');
const notes = [];
await onStart({ reason: 'startup' }, { hasUI: true, ui: { notify: (m) => notes.push(m) } });
assert.equal(calls.length, 0, '启动检查阻塞了 session_start');

// 检查完成必定提示，以提示作为完成信号
const deadline = Date.now() + 30000;
while (!notes.length && Date.now() < deadline) await new Promise((r) => setTimeout(r, 20));
assert.ok(notes.length > 0, '检查完成后未提示');
assert.ok(calls.length > 0, '未执行远端检查');
assert.ok(mirrored, '远端检查未走加速源');
assert.match(notes[0], /最新/, '全是最新时没有提示');
assert.ok(!calls.some((c) => ['clone', 'fetch', 'reset', 'pull'].includes(c)), '启动执行了更新操作: ' + calls.join(','));
assert.equal(readFileSync(state, 'utf8'), before, '启动修改了状态文件');

// 加速源挂掉时必须回退直连，结果不变
let startFallback;
const fallbackCalls = [];
let mirrorAttempts = 0;
init({
  on: (name, fn) => { if (name === 'session_start') startFallback = fn; },
  registerCommand: () => {},
  exec: async (_cmd, args, opts) => {
    fallbackCalls.push(args[0]);
    if (args[0] === '-c') {
      assert.ok(opts?.timeout < 30000, '加速源没有快速超时');
      mirrorAttempts++;
      return mirrorAttempts % 2
        ? { code: 0, stdout: '', stderr: '', killed: true }
        : { code: 1, stdout: '', stderr: 'mirror down' };
    }
    const key = createHash('sha1').update(args[1] ?? '').digest('hex').slice(0, 12);
    const ref = saved.repos[key]?.ref ?? 'deadbeef';
    return { code: 0, stdout: args[0] === 'ls-remote' ? ref + '\trefs/heads/main' : ref, stderr: '' };
  },
});
const fallbackNotes = [];
await startFallback({ reason: 'startup' }, { hasUI: true, ui: { notify: (m) => fallbackNotes.push(m) } });
while (!fallbackNotes.length && Date.now() < deadline) await new Promise((r) => setTimeout(r, 20));
assert.ok(fallbackCalls.includes('-c') && fallbackCalls.includes('ls-remote'), '加速源失败未回退直连');
assert.match(fallbackNotes[0], /最新/, '回退后检查结果不对');
assert.equal(readFileSync(state, 'utf8'), before, '回退流程修改了状态文件');
console.log('OK 启动不阻塞、只读、加速源失败回退直连；提醒:', notes.join(' | ') || '(无可用更新)');
