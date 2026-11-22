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
init({
  on: (name, fn) => { if (name === 'session_start') onStart = fn; },
  registerCommand: (name, def) => { command = { name, def }; },
  exec: async (_cmd, args) => {
    calls.push(args[0]);
    const key = createHash('sha1').update(args[1] ?? '').digest('hex').slice(0, 12);
    const ref = saved.repos[key]?.ref ?? 'deadbeef';
    return { code: 0, stdout: args[0] === 'ls-remote' ? ref + '\trefs/heads/main' : ref, stderr: '' };
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
assert.match(notes[0], /最新/, '全是最新时没有提示');
assert.ok(!calls.some((c) => ['clone', 'fetch', 'reset', 'pull'].includes(c)), '启动执行了更新操作: ' + calls.join(','));
assert.equal(readFileSync(state, 'utf8'), before, '启动修改了状态文件');
console.log('OK 启动不阻塞、只读；提醒:', notes.join(' | ') || '(无可用更新)');
