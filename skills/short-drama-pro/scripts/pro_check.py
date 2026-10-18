#!/usr/bin/env python3
"""pro_check.py — short-drama-pro mechanical discipline checker.

Advisory for screenplay prose (SCR-23 / SHT-30 patterns), hard for shot duration
(SHT-31: <= 12s per shot). Auto-detects document kind:

- 分镜.md  : "## SHOT-..." blocks; checks duration cap and orientation binding
- 视频提示词.md : "## MOTION-..." blocks; checks duration cap, orientation,
              end-state re-declaration
- 剧本.md   : action paragraphs; checks bare displacement verbs, chain overload,
              hidden mechanics, leading limb on crossings

Codes: SHT31_SHOT_EXCEEDS_CAP (error), VID28_END_STATE_MISSING (warning),
VID28_BARE_DISPLACEMENT / SHT30_MISSING_ORIENTATION / SCR23_BARE_DISPLACEMENT /
SCR23_CHAIN_OVERLOAD / SCR23_HIDDEN_MECHANICS / SCR23_MISSING_LEADING_LIMB (warnings).

Exit 0 when no errors (warnings only), 1 on errors, 2 on usage problems.
--selftest runs built-in fixtures.
"""
from __future__ import annotations

import re
import sys
import tempfile
from pathlib import Path
from typing import Any

MIN_PY = (3, 9)
if sys.version_info < MIN_PY:
    raise SystemExit("pro_check.py requires Python 3.9+")

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

SHOT_CAP_SECONDS = 12.0

DISPLACEMENT_RE = re.compile(
    r"(走向|走进|走到|进入|进入房|踏入|穿过|冲出|跑出|跑去|奔|离开|撤离|"
    r"推门|拉门|开门|关门|推开|拉开|关上|上车|下车|翻越|跨过|迈过|门槛)"
)
ORIENTATION_RE = re.compile(
    r"(面朝|面向|背对|朝向|正对|对着|转身|转向|转过头|视线|目光|背影|侧身|"
    r"胸部|胸口|背部|内开|外开|向内|向外|冲向|扑向)"
)
CROSS_RE = re.compile(r"(跨过|迈过|门槛|踏入|跨进|登上|上车|下车)")
LEADING_LIMB_RE = re.compile(r"(左脚|右脚|左手|右手)")
TURN_RE = re.compile(r"(转身|转过身|转向|转过头|回身)")
MOVE_RE = re.compile(r"(走向|走进|走到|跑到|跑向|奔|冲出|穿过|离开|上前|后退|入场|进入|踏入)")
INTERFACE_RE = re.compile(r"(推门|拉门|开门|关门|推开|拉开|关上|掀开|拧开|门把|门闩)")
CROSSCLASS_RE = CROSS_RE
GRAB_RE = re.compile(r"(拿起|抓起|取下|接过|掏出|握住|抓起)")
HIDDEN_RE = re.compile(r"(突然|随即|随后|紧接着)[^。！？\n]{0,24}?(走进|进入|出现在|推到|拉开|跨上|坐上|站到)")

DURATION_RE = re.compile(r"时长[:：]?\s*(\d+(?:\.\d+)?)\s*秒")
LABEL_LINE_RE = re.compile(r"^\s*[-*]?\s*(起点|终点|唯一动作|状态链|分镜|时长|声音|运镜|景别|机位|输入参考图|静态视觉锚点|起始帧|收尾关键帧|职责|来源)")


def _paragraphs(text: str) -> list[str]:
    out = []
    for para in re.split(r"\n\s*\n", text):
        body = para.strip()
        if not body:
            continue
        if body.startswith(("#", "|", "```", ">")):
            continue
        lines = [l for l in body.splitlines() if l.strip()]
        if lines and all(l.strip().startswith(("[", "- 视觉依据", "- 输入参考图", "- 图片提示词")) for l in lines):
            continue
        out.append(body)
    return out


def _is_dialogue_line(line: str) -> bool:
    stripped = line.strip()
    if "：" not in stripped:
        return False
    head = stripped.split("：", 1)[0]
    return len(head) <= 16 and not head.startswith(("[", "-"))


def _action_prose(text: str) -> list[str]:
    out = []
    for para in _paragraphs(text):
        lines = [l for l in para.splitlines() if l.strip() and not _is_dialogue_line(l)
                 and not LABEL_LINE_RE.match(l) and not l.strip().startswith("[")]
        joined = "\n".join(lines).strip()
        if joined:
            out.append(joined)
    return out


def check_screenplay(text: str) -> list[dict[str, Any]]:
    findings: list[dict[str, Any]] = []
    for para in _action_prose(text):
        for seg in re.split(r"(?<=[。！？])", para):
            seg = seg.strip()
            if not seg:
                continue
            has_disp = bool(DISPLACEMENT_RE.search(seg))
            has_orient = bool(ORIENTATION_RE.search(seg))
            if has_disp and not has_orient:
                findings.append({"code": "SCR23_BARE_DISPLACEMENT", "severity": "warning", "snippet": seg[:60]})
            classes = [name for name, rx in (("turn", TURN_RE), ("move", MOVE_RE),
                                             ("interface", INTERFACE_RE), ("cross", CROSSCLASS_RE),
                                             ("grab", GRAB_RE)) if rx.search(seg)]
            if len(classes) >= 3:
                findings.append({"code": "SCR23_CHAIN_OVERLOAD", "severity": "warning",
                                 "snippet": seg[:60], "step_classes": classes})
            if CROSSCLASS_RE.search(seg) and not LEADING_LIMB_RE.search(seg):
                findings.append({"code": "SCR23_MISSING_LEADING_LIMB", "severity": "warning", "snippet": seg[:60]})
        hit = HIDDEN_RE.search(para)
        if hit:
            findings.append({"code": "SCR23_HIDDEN_MECHANICS", "severity": "warning",
                             "snippet": para[max(0, hit.start() - 10):hit.end() + 10][:60]})
    return findings


def _blocks(text: str, prefix: str) -> list[tuple[str, str]]:
    out: list[tuple[str, str]] = []
    current_id, buf = None, []
    for line in text.splitlines():
        m = re.match(rf"^##\s+{prefix}[^\s#]*", line)
        if m:
            if current_id is not None:
                out.append((current_id, "\n".join(buf)))
            current_id, buf = line.strip("# 　")[:40], [line]
        elif current_id is not None:
            if line.startswith("## ") or line.startswith("# "):
                out.append((current_id, "\n".join(buf)))
                current_id, buf = None, []
            else:
                buf.append(line)
    if current_id is not None:
        out.append((current_id, "\n".join(buf)))
    return out


def _check_block(block_id: str, body: str, kind: str) -> list[dict[str, Any]]:
    findings: list[dict[str, Any]] = []
    for m in DURATION_RE.finditer(body):
        seconds = float(m.group(1))
        if seconds > SHOT_CAP_SECONDS:
            findings.append({"code": "SHT31_SHOT_EXCEEDS_CAP", "severity": "error",
                             "shot": block_id, "duration_seconds": seconds, "cap": SHOT_CAP_SECONDS})
    disp = bool(DISPLACEMENT_RE.search(body))
    if disp and not ORIENTATION_RE.search(body):
        findings.append({"code": "SHT30_MISSING_ORIENTATION" if kind == "shot" else "VID28_BARE_DISPLACEMENT",
                         "severity": "warning", "shot": block_id,
                         "message": "travel verb without a body-orientation anchor"})
    if kind == "motion" and disp:
        tail = body.strip()[-260:]
        if not re.search(r"(终点|结束|停在|最后|ends?|收尾)", tail):
            findings.append({"code": "VID28_END_STATE_MISSING", "severity": "warning", "shot": block_id,
                             "message": "no end-state/orientation re-declaration near block tail"})
    if disp and CROSSCLASS_RE.search(body) and not LEADING_LIMB_RE.search(body):
        findings.append({"code": "SCR23_MISSING_LEADING_LIMB", "severity": "warning", "shot": block_id})
    return findings


def check_storyboard(text: str) -> list[dict[str, Any]]:
    return [f for bid, body in _blocks(text, "SHOT-") for f in _check_block(bid, body, "shot")]


def check_motion(text: str) -> list[dict[str, Any]]:
    return [f for bid, body in _blocks(text, "MOTION-") for f in _check_block(bid, body, "motion")]


def detect_and_check(path: Path) -> list[dict[str, Any]]:
    text = path.read_text(encoding="utf-8")
    if "## SHOT-" in text:
        return check_storyboard(text)
    if "## MOTION-" in text:
        return check_motion(text)
    return check_screenplay(text)


def _report(findings: list[dict[str, Any]]) -> int:
    errors = [f for f in findings if f.get("severity") == "error"]
    warnings = [f for f in findings if f.get("severity") == "warning"]
    for item in errors:
        print("ERROR   " + _fmt(item))
    for item in warnings:
        print("warning " + _fmt(item))
    print(f"pro_check: {len(errors)} error(s), {len(warnings)} warning(s)")
    return 1 if errors else 0


def _fmt(item: dict[str, Any]) -> str:
    parts = [item["code"]]
    for key in ("shot", "duration_seconds", "step_classes", "snippet"):
        if key in item and item[key] is not None:
            parts.append(f"{key}={item[key]}")
    if "message" in item:
        parts.append(item["message"])
    return " · ".join(str(p) for p in parts)


STORYBOARD_FIXTURE = """## SHOT-001 · 进门超限
- 时长：14 秒
- 起点：她面朝房门站在桌前，右手垂在身侧
- 唯一动作：她转身走到门前，左脚先跨过门槛，右手推门
- 终点：她进入房内，胸部朝向窗
- 声音：环境底噪

## SHOT-002 · 裸位移
- 时长：8 秒
- 起点：她在画右
- 唯一动作：她走向门口推门进入
- 终点：她在门外
- 声音：无对白底声持续
"""

SCREENPLAY_FIXTURE = """# EP001 测试

## EP001-SC001 内 · 房间 · 夜

她走到门口推门进入房间。

沈一舟（低声）：谁？

他背对摄影机，胸部朝向内开的铁门，两步走到门前，右手压下门把把门向内拉开，
左脚先跨过门槛。人已站在门内，胸部朝向窗。
"""


def selftest() -> int:
    with tempfile.TemporaryDirectory() as td:
        p1 = Path(td) / "分镜.md"
        p1.write_text(STORYBOARD_FIXTURE, encoding="utf-8")
        codes1 = {f["code"] for f in check_storyboard(p1.read_text(encoding="utf-8"))}
        assert "SHT31_SHOT_EXCEEDS_CAP" in codes1, codes1
        assert "SHT30_MISSING_ORIENTATION" in codes1, codes1

        p2 = Path(td) / "剧本.md"
        p2.write_text(SCREENPLAY_FIXTURE, encoding="utf-8")
        fs = check_screenplay(p2.read_text(encoding="utf-8"))
        codes2 = {f["code"] for f in fs}
        assert "SCR23_BARE_DISPLACEMENT" in codes2, codes2
        assert "SCR23_CHAIN_OVERLOAD" in codes2, codes2
        bare = [f for f in fs if f["code"] == "SCR23_BARE_DISPLACEMENT"]
        assert all("背对摄影机" not in f["snippet"] for f in bare), "oriented segment flagged?"

        print("2 self-test groups passed")
    return 0


def main(argv: list[str]) -> int:
    if argv and argv[0] == "--selftest":
        return selftest()
    if not argv:
        print(__doc__)
        return 2
    try:
        findings = [detect_and_check(Path(a)) for a in argv for _ in [0]]
    except OSError as exc:
        print(f"usage error: {exc}", file=sys.stderr)
        return 2
    flat = [f for group in findings for f in group]
    return _report(flat)


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
