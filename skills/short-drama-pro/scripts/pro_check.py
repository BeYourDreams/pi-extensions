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
SCR23_CHAIN_OVERLOAD / SCR23_HIDDEN_MECHANICS / SCR23_MISSING_LEADING_LIMB (warnings),
SAF01_HIGH_RISK_TERM (warning, all document kinds; see stage-script.md §9),
PAC04_* / PAC05_* (台词的语速·停顿·语气落进正文了吗，见 references/pacing.md),
CON08_* (站位朝向与衣着跨镜一致，见 references/identity-continuity.md).

Shot-level codes only run in 分镜/视频提示词 mode: a 剧本 has no shot prose to check.

`--shot-cap 5` tightens the per-shot cap to an accepted short-cut target (a 5-second
快切档, for example). It can only tighten, never raise, the 12-second suite cap (SHT-31).

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

# SAF-01: advisory content-safety scan. Only hard, unambiguous terms — real-name/
# brand/euphemistic risk cannot be regexed; the stage-script.md §9 table is the human net.
SAFETY_RE = re.compile(
    r"(吸毒|白粉|冰毒|海洛因|摇头丸|大麻|吗啡|K粉|迷药|迷魂药|赌场|赌球|开赌|百家乐|老虎机|六合彩|"
    r"卖淫|嫖|强奸|割腕|割脉|自残|自杀|上吊|跳楼|自焚|服毒|吞药|"
    r"血浆|血泊|血淋淋|血肉模糊|开膛|爆头|内脏|脑浆|断肢|分尸|碎尸|枪毙|枪杀|砍死|毒死|炸弹|爆炸物|恐怖袭击|恐怖|灵异|厉鬼|驱鬼|驱魔|降头|巫术|蛊|僵尸|吸血鬼|狼人|诅咒|阴魂|地府|阴间|冥婚|通灵|驱邪|附体|夺舍|降神|出马|仙家|"
    r"裸体|裸露|床戏|脱衣|色情|"
    r"傻逼|操你|他妈的|贱人|婊子|王八蛋|"
    r"法轮|伊斯兰|基督教会|真主|古兰经|邪教|"
    r"未成年.{0,6}(性|裸|脱|强|侵犯))"
)
LABEL_LINE_RE = re.compile(r"^\s*[-*]?\s*(起点|终点|唯一动作|状态链|分镜|时长|声音|运镜|景别|机位|输入参考图|静态视觉锚点|起始帧|收尾关键帧|职责|来源)")

# PAC-04: the three delivery levers a video model can only act on when they are
# written as separate, concrete words. A bare 「愤怒」 names none of them.
# H3 prose is English, Seedance/Wan prose is Chinese — both vocabularies count.
SPEED_LEVER_RE = re.compile(
    r"(一字一顿|一字一句|字字砸下|放慢|慢半拍|拖长|沉稳|迟疑|犹豫|吞字|断断续续|吞吐|后半句断掉|"
    r"急促|抢话|抢着|连着说|一口气|飞快|疾|语速|常速|匀速|正常语速|不赶|快而轻|越说越慢|越说越快|"
    r"先慢后快|前慢后快|断掉|挤出|吐出|迸出|含糊|含混|嗓子发|声音发|答得比平时|快半档|慢半档|"
    r"word by word|word[- ]by[- ]word|drawn out|s(?:low|lowly|lowered)|slower|deliberate|rapid|quick(?:er|est)?|"
    r"clipped|halting|broken rhythm|press(?:es)? out|pressing out|rushed|faster|spits? out)"  # noqa: E501
)
PAUSE_LEVER_RE = re.compile(
    r"(开口前|话到嘴边|欲言又止|没说出口|吞回去|顿了顿|停一停|停半拍|停一拍|留了一拍|空了一拍|停顿|留白|换气|吸气|"
    r"屏住呼吸|半秒|一秒|两秒|一拍|半拍|沉默|空档|句间|说完后|说完之后|话音落下|尾音|静默|不收声|余白|没有立刻收|"
    r"paus(?:e|es|ing)|\bbeat\b|half a second|a full second|before (?:she|he|they|the boy|\w) (?:speaks|starts|answers)|"
    r"trails? off|trail off|swallow(?:s|ed)? (?:it|the words)|holds? the silence|breath|lets it hang)"  # noqa: E501
)
COLOR_LEVER_RE = re.compile(
    r"(压低|咬着牙|冷|吼|喊|哑|颤抖|发抖|哽咽|哭|鼻音|气声|轻|大声|嘲讽|讥|客气|恭敬|恭谨|"
    r"温柔|温和|冷冷的|拖调|平|稳定|从容|紧张|急|发紧|发沉|发飘|脆|破音|咬字|音量大|气短|笑到一半|"
    r"沉声|闷声|放低|声音.{0,4}低|压低|压得|低到|音量|嗓子|喉咙|鼻腔|气不"
    r"low(?:er|est)?\b|soft(?:ly)?\b|quiet(?:ly)?\b|loud(?:er)?\b|hoarse|trembl\w*|whisper\w*|breathy|"
    r"choked|cracking|crack|flat voice|cold(?:ly)?\b|warm(?:ly)?\b|shrill|tight\b|volume)"  # noqa: E501
)
EMOTION_RE = re.compile(
    r"(震惊|愤怒|屈辱|狂喜|欣喜|得意|慌张|害怕|恐惧|心虚|委屈|悲伤|哀|怒|喜|惊|惧|冷漠|激动|感动|崩溃|不耐烦|"
    r"angry|anger|angr\w*|furi\w*|shock(?:ed|s)?|scared|afraid|panic\w*|excited|contempt\w*|terrified|grief)"
)
VAGUE_ONLY_RE = re.compile(r"(自然语速|正常语速|平稳|情绪饱满|有感情|抑扬顿挫|natural (?:pace|speed)|naturally)")
# PAC-05: a vague speed word is not yet a plan — it needs a second count or a slot position.
CALIBRATED_RE = re.compile(
    r"(半秒|一秒|两秒|一拍|半拍|开口前|换气|句间|说完后|说完之后|尾音|话到嘴边|欲言又止|"
    r"一字一顿|拖长|慢半拍|字字砸下|停顿|half a second|\bbeat\b|paus(?:e|es|ing)|trails? off)"
)

# CON-08: wardrobe colour + garment, the two facts that drift loudest across shots.
COLOR_WORD_RE = re.compile(
    r"(藏青|深蓝|浅蓝|墨绿|军绿|米白|乳白|象牙|灰白|深灰|浅灰|酒红|砖红|赭|黑|白|红|蓝|绿|黄|棕|褐|紫|粉|银|金|卡其|杏|驼)"
)
GARMENT_RE = re.compile(r"(外套|大衣|风衣|夹克|西装|衬衫|T恤|卫衣|毛衣|马甲|裙|裤|制服|工作服|白大褂|袍|褂|雨衣|校服|披风|斗篷)")
WARDROBE_CHANGE_RE = re.compile(r"(脱下|褪下|换上|披上|解开|扯开|卷起|撩起|扣好|系上|挽起)")
STANCE_RE = re.compile(
    r"(面朝|面向|背对|朝向|胸朝|背朝|胸部|胸口|背部|正对|对着|侧身|站着|立着|坐着|跪|半跪|卧|躺|"
    r"靠在|倚着|站在|位于|画左|画右|视线|目光|转身)"
)


LOOKBACK = 200  # one H3 English sentence runs longer than one Chinese 说话方式 clause
# PAC-05 also fires on a too-short-to-be-a-span line (「走。」) when a speech verb is present;
# a bare 说 or a camera described as 平稳 must not trigger it.
SPEECH_CONTEXT_RE = re.compile(
    r"(说道|说：|开口道|答道|问道|喊道|叫道|低声说|says?\b|said\b|whisper\w*|asks?\b|replies?\b|calls out)"
)


def _dialogue_spans(text: str) -> list[tuple[int, int]]:
    """Byte ranges holding verbatim delivered speech: `<d>` tags and Chinese quotes."""
    spans = [(m.start(), m.end()) for m in re.finditer(r"<d>.*?</d>", text, re.S)]
    spans += [(m.start(1), m.end(1)) for m in re.finditer(r"“([^”]{4,})”", text)]
    return spans


def _strip_dialogue(text: str) -> str:
    out, cursor = [], 0
    for start, end in _dialogue_spans(text):
        if start >= cursor:
            out.append(text[cursor:start])
            cursor = end
    out.append(text[cursor:])
    return "".join(out)


def _check_delivery(block_id: str, body: str) -> list[dict[str, Any]]:
    """PAC-04 / PAC-05: every delivered line must carry its own speed, pause and colour."""
    findings: list[dict[str, Any]] = []
    prose = _strip_dialogue(body)
    spans = _dialogue_spans(body)
    vague = sorted(set(VAGUE_ONLY_RE.findall(prose)))
    # A vague speed word next to any speaking context is an uncalibrated delivery — it also
    # fires when the line itself is too short to be a verbatim span (interjections stay with review).
    if vague and not CALIBRATED_RE.search(prose) and (spans or SPEECH_CONTEXT_RE.search(prose)):
        findings.append({"code": "PAC05_DELIVERY_NOT_CALIBRATED", "shot": block_id, "severity": "warning",
                         "terms": "/".join(vague),
                         "message": "只给了语速词，没给秒数或位置；回听不齐（PAC-05）"})
    if not spans:
        return findings
    for index, (start, end) in enumerate(spans):
        # The delivery clause normally precedes the line, but 「她说：“……”，声音压得很低」
        # is the same instruction — read both sides of the fence, never across a paragraph.
        pre = body[max(0, start - LOOKBACK):start]
        # 「自然语速」这类校准词不算杠杆，否则它会盖住自己正在犯的错。
        post = VAGUE_ONLY_RE.sub("", body[end:min(len(body), end + 60)])
        window = pre + post
        held = sum(bool(rx.search(window)) for rx in (SPEED_LEVER_RE, PAUSE_LEVER_RE, COLOR_LEVER_RE))
        if held < 2:
            findings.append({
                "code": "PAC04_DELIVERY_LEVERS_MISSING", "severity": "warning", "shot": block_id,
                "line": index + 1, "held": held,
                "message": "台词旁没写够两根发声杠杆（语速档 / 停顿位 / 音色语气，三取二）",
            })
        if EMOTION_RE.search(pre) and not (
                SPEED_LEVER_RE.search(window) or PAUSE_LEVER_RE.search(window)):
            findings.append({
                "code": "PAC04_EMOTION_WORD_ONLY", "severity": "warning", "shot": block_id,
                "line": index + 1, "message": "只有情绪形容词，没有可见的身体处理与发声落点",
            })
    return findings


WARDROBE_LANDING_RE = re.compile(r"(挂在|搭在|抱在|留在|放在|手里|臂弯|肩上|椅背|钩上|衣架上)")
SUBJECT_RE = re.compile(r"(人物|角色|他|她|<Subject)")
LOOK_REF_RE = re.compile(r"(REF-|PLAN-|造型状态|用途：身份)")
LOOK_EN_RE = re.compile(r"(hair|coat|jacket|shirt|uniform|dress)", re.I)


def _check_identity(block_id: str, body: str, kind: str) -> list[dict[str, Any]]:
    """CON-08: 站位/朝向/衣着 — 谁入画、穿什么、朝哪儿，每镜都得自己写一遍。"""
    findings: list[dict[str, Any]] = []
    end_line = re.search(r"^\s*[-*]?\s*终点[^\n]*", body, re.M)
    if end_line and not STANCE_RE.search(end_line.group(0)):
        findings.append({"code": "CON08_END_STANCE_MISSING", "severity": "warning", "shot": block_id,
                         "message": "终点行没重述身体朝向与落位，下一镜没有起点可核对"})
    # 穿脱写在哪个句子里，落点就得在那个句子里：下一句写了不算。
    for seg in re.split(r"(?<=[。！？\n])", body):
        if WARDROBE_CHANGE_RE.search(seg) and not WARDROBE_LANDING_RE.search(seg):
            findings.append({"code": "CON08_WARDROBE_LANDING_MISSING", "severity": "warning",
                             "shot": block_id, "snippet": seg.strip()[:40],
                             "message": "写了穿脱动作却没写衣物落点，跨镜会漂"})
    # Only an unbound motion body has to carry the look itself: 分镜 has 视觉依据,
    # and 图生视频 has a REF slot whose 用途 身份/造型状态 owns appearance (VID-03).
    has_subject = bool(SUBJECT_RE.search(body))
    has_garment = bool(GARMENT_RE.search(body)) or bool(LOOK_EN_RE.search(body))
    unbound = kind == "motion" and not LOOK_REF_RE.search(body)
    if has_subject and not has_garment and unbound:
        findings.append({"code": "CON08_LOOK_ANCHOR_MISSING", "severity": "warning", "shot": block_id,
                         "message": "入画人物既没有衣着/发型一句，也没有身份或造型参考图槽位"})
    return findings


def _check_look_drift(blocks: list[tuple[str, str]]) -> list[dict[str, Any]]:
    """CON-08: the same garment written two colours across one document is the loudest drift."""
    seen: dict[str, dict[str, list[str]]] = {}
    for block_id, body in blocks:
        for m in re.finditer(GARMENT_RE, body):
            colour = COLOR_WORD_RE.search(body[max(0, m.start() - 8):m.start()])
            if colour:
                seen.setdefault(m.group(0), {}).setdefault(colour.group(0), []).append(block_id)
    out: list[dict[str, Any]] = []
    for garment, colours in seen.items():
        if len(colours) > 1:
            out.append({"code": "CON08_LOOK_DRIFT", "severity": "warning", "garment": garment,
                       "colours": {c: ids[:3] for c, ids in colours.items()},
                       "message": "同一件衣物在本档被写成多种颜色（换装需要 [连续性] 声明）"})
    return out


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


def _check_block(block_id: str, body: str, kind: str,
                 shot_cap: float = SHOT_CAP_SECONDS) -> list[dict[str, Any]]:
    findings: list[dict[str, Any]] = []
    for m in DURATION_RE.finditer(body):
        seconds = float(m.group(1))
        if seconds > shot_cap:
            findings.append({"code": "SHT31_SHOT_EXCEEDS_CAP", "severity": "error",
                             "shot": block_id, "duration_seconds": seconds, "cap": shot_cap})
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
    findings += _check_delivery(block_id, body)
    findings += _check_identity(block_id, body, kind)
    return findings


def check_storyboard(text: str, shot_cap: float = SHOT_CAP_SECONDS) -> list[dict[str, Any]]:
    blocks = _blocks(text, "SHOT-")
    return [f for bid, body in blocks for f in _check_block(bid, body, "shot", shot_cap)] \
        + _check_look_drift(blocks)


def check_motion(text: str, shot_cap: float = SHOT_CAP_SECONDS) -> list[dict[str, Any]]:
    blocks = _blocks(text, "MOTION-")
    return [f for bid, body in blocks for f in _check_block(bid, body, "motion", shot_cap)] \
        + _check_look_drift(blocks)


def check_safety(text: str) -> list[dict[str, Any]]:
    findings: list[dict[str, Any]] = []
    for line in text.splitlines():
        for hit in SAFETY_RE.finditer(line):
            findings.append({"code": "SAF01_HIGH_RISK_TERM", "severity": "warning",
                             "snippet": line.strip()[:60], "term": hit.group(0)})
    return findings


def detect_and_check(path: Path, shot_cap: float = SHOT_CAP_SECONDS) -> list[dict[str, Any]]:
    text = path.read_text(encoding="utf-8")
    safety = check_safety(text)
    if "## SHOT-" in text:
        return safety + check_storyboard(text, shot_cap)
    if "## MOTION-" in text:
        return safety + check_motion(text, shot_cap)
    return safety + check_screenplay(text)


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
    for key in ("shot", "duration_seconds", "step_classes", "term", "snippet"):
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


MOTION_FIXTURE = """## MOTION-001 · 合格的发声与锁定
- 分镜：SHOT-EP001-001
- 时长：9 秒
- 生成方式：图生视频
- 输入参考图：REF-XIAOYU-SHEET（顺序：1）· 输入/参考图/小雨定妆.png《小雨定妆》（用途：身份）
- 起始帧：她面朝窗站在桌左侧，藏青外套扣到顶上，右手搭在椅背
- 状态链：她开口前停了半秒，一字一顿、压低声音，目光钉在窗上，藏青外套仍扣着。
  她一字一顿地说：“你当时就站在门后面。”
- 终点：她仍面朝窗立在桌左侧，右手垂下，藏青外套扣到顶上

## MOTION-002 · 只给了情绪词与坏颜色
- 分镜：SHOT-EP001-002
- 时长：8 秒
- 生成方式：文生视频
- 静态视觉锚点：一间夜里的办公室，一个人站在窗前
- 起始帧：她站在窗前
- 状态链：她愤怒地说：“你骗我。”说完自然语速地看了他一眼。
- 终点：她站在窗前，米白外套搭在臂弯
- 补充：她把外套脱下，随手一放。

## MOTION-003 · 文生却没有造型与落位
- 分镜：SHOT-EP001-003
- 时长：6 秒
- 生成方式：文生视频
- 静态视觉锚点：夜里的走廊，一盏声控灯
- 起始帧：她从画面深处走来，胸部朝向镜头
- 状态链：她站住，抬手按在墙上。
- 终点：她按着墙，灯灭

## MOTION-004 · H3 英文正文（台风格栏外已给全三根杠杆）
- 分镜：SHOT-EP001-004
- 时长：9 秒
- 生成方式：图生视频
- 输入参考图：REF-XIAOYU-SHEET（顺序：1）· 输入/参考图/小雨定妆.png《小雨定妆》（用途：身份；控制：脸型、短发剪影；不得控制：构图）

```text
<Subject 1> (S1), the woman on-screen in a dark teal jacket, stands with her back to the camera
and her chest toward the window on the left of the desk; she holds the silence for half a second,
then presses out each word low and tight: <d>[Chinese] 你当时就站在门后面。</d>
Her lips stop moving only after the last syllable has trailed off.
```
- 终点：她仍背对摄影机、胸部朝向窗立在桌左侧，藏青外套扣到顶上

## MOTION-005 · 说话方式写在台词之后（同一句里也算交付）
- 分镜：SHOT-EP001-005
- 时长：7 秒
- 生成方式：图生视频
- 输入参考图：REF-B（顺序：1）· images/b.png《起始帧》（用途：起始帧）
- 起始帧：她面朝窗站在桌左侧，米白针织衫
- 状态链：她说：“这件事我从来就没有答应过。”，声音压得极低，最后三字一字一顿。
- 终点：她仍面朝窗立在桌左侧，米白针织衫
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

        p3 = Path(td) / "脏剧本.md"
        p3.write_text("他掏出白色小袋递过去。\n\n她割腕之前看了他一眼，血浆溅在地砖上。\n", encoding="utf-8")
        terms = {f["term"] for f in check_safety(p3.read_text(encoding="utf-8"))}
        assert {"割腕", "血浆"} <= terms, terms
        probe = "他掀开袖子，裸露的伤口下血泊还没干，桌上散着几粒迷药。"
        assert {"裸露", "血泊", "迷药"} <= {f["term"] for f in check_safety(probe)}
        p5 = Path(td) / "禁题材.md"
        p5.write_text("该集为灵异恐怖片，含驱鬼与阴魂。\n", encoding="utf-8")
        terms5 = {f["term"] for f in check_safety(p5.read_text(encoding="utf-8"))}
        assert {"灵异", "恐怖", "驱鬼", "阴魂"} <= terms5, terms5
        assert not check_safety("他掏出白色小袋递过去，手一直抖。"), "clean line flagged?"

        p4 = Path(td) / "fastcut.md"
        p4.write_text("## SHOT-010\n- 时长：8 秒\n- 起点：她面朝窗站在桌前\n"
                      "- 唯一动作：她把杯子推过桌面\n- 终点：杯子停在桌沿，她胸朝窗\n",
                      encoding="utf-8")
        text4 = p4.read_text(encoding="utf-8")
        assert check_storyboard(text4) == [], "8s must pass at the 12s suite cap"
        tight = check_storyboard(text4, shot_cap=5.0)
        assert {f["code"] for f in tight} == {"SHT31_SHOT_EXCEEDS_CAP"}, tight
        assert tight[0]["cap"] == 5.0, tight
        assert main(["--shot-cap", "0", str(p4)]) == 2, "zero cap accepted"
        assert main(["--shot-cap", "abc", str(p4)]) == 2, "non-numeric cap accepted"
        assert main(["--shot-cap=5", str(p4)]) == 1, "--shot-cap=5 did not tighten"

        p6 = Path(td) / "视频提示词.md"
        p6.write_text(MOTION_FIXTURE, encoding="utf-8")
        codes6 = {f["code"] for f in check_motion(p6.read_text(encoding="utf-8"))}
        assert "PAC04_DELIVERY_LEVERS_MISSING" in codes6, codes6
        assert "CON08_LOOK_ANCHOR_MISSING" in codes6, codes6
        assert "PAC04_EMOTION_WORD_ONLY" in codes6, codes6
        assert "CON08_END_STANCE_MISSING" in codes6, codes6
        assert "CON08_WARDROBE_LANDING_MISSING" in codes6, codes6
        assert "CON08_LOOK_DRIFT" in codes6, codes6
        clean = [f for f in check_motion(MOTION_FIXTURE.split("## MOTION-002")[0])]
        assert clean == [], f"well-formed motion flagged: {clean}"
        h3 = MOTION_FIXTURE.split("## MOTION-004")[1].split("## MOTION-005")[0]
        assert check_motion("## MOTION-004" + h3) == [], \
            f"English delivery prose flagged: {check_motion('## MOTION-004' + h3)}"
        tail = MOTION_FIXTURE.split("## MOTION-005")[1]
        assert check_motion("## MOTION-005" + tail) == [], \
            f"post-quoted delivery clause flagged: {check_motion('## MOTION-005' + tail)}"
        # A line too short to be a verbatim span still owes its pacing plan (「走。」).
        short = ("## MOTION-006 · x\n- 时长：4 秒\n- 起始帧：她面朝窗，米白外套\n"
                 "- 状态链：她低声说道：“走。”用自然语速。\n- 终点：她仍面朝窗\n")
        assert {f["code"] for f in check_motion(short)} == {"PAC05_DELIVERY_NOT_CALIBRATED"}, check_motion(short)
        # 摄影机被写成「平稳」且全程无人说话，不是交付缺失。
        silent = ("## MOTION-007 · x\n- 时长：4 秒\n- 起始帧：她面朝窗，米白外套\n"
                  "- 状态链：摄影机平稳跟随，她没有说话，嘴唇保持闭合。\n- 终点：她仍面朝窗\n")
        assert check_motion(silent) == [], check_motion(silent)

        print("4 self-test groups passed")
    return 0


def main(argv: list[str]) -> int:
    if argv and argv[0] == "--selftest":
        return selftest()
    rest = list(argv)
    shot_cap = SHOT_CAP_SECONDS
    while rest and rest[0].startswith("--shot-cap"):
        flag = rest.pop(0)
        value = flag.split("=", 1)[1] if "=" in flag else (rest.pop(0) if rest else "")
        try:
            # Only tightening is honest: an accepted profile moves the target inside
            # the suite cap, it never lifts the cap (SHT-31).
            shot_cap = min(float(value), SHOT_CAP_SECONDS)
        except ValueError:
            print(f"usage error: --shot-cap needs a number of seconds, got {value!r}",
                  file=sys.stderr)
            return 2
        if shot_cap <= 0:
            print("usage error: --shot-cap must be positive", file=sys.stderr)
            return 2
    if not rest:
        print(__doc__)
        return 2
    try:
        findings = [detect_and_check(Path(a), shot_cap) for a in rest]
    except OSError as exc:
        print(f"usage error: {exc}", file=sys.stderr)
        return 2
    flat = [f for group in findings for f in group]
    return _report(flat)


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
