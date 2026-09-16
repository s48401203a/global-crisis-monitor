"""统一分级：severity/metrics/magnitude → {band, tone, zh, en}。

前端 realGrade 的服务端实现，单一真相源。tone ∈ neutral|green|yellow|orange|red。
"""
from __future__ import annotations

import re
from typing import Any

TONES = ("neutral", "green", "yellow", "orange", "red")
_ALERT_ZH = {"green": "绿色", "yellow": "黄色", "orange": "橙色", "red": "红色"}
_ALERT_EN = {"green": "Green", "yellow": "Yellow", "orange": "Orange", "red": "Red"}
_CMA_LEVEL_TONE = {"红": "red", "橙": "orange", "黄": "yellow", "蓝": "green"}


def fmt_num(n: Any) -> str:
    try:
        x = float(n)
    except (TypeError, ValueError):
        return str(n)
    if abs(x) >= 10000:
        return f"{int(round(x)):,}"
    if abs(x) >= 100:
        return f"{x:.0f}"
    r = round(x, 1)
    return str(int(r)) if r == int(r) else f"{r:.1f}"


def cma_level_from_text(text: str | None) -> str | None:
    t = text or ""
    if re.search(r"红色预警|红预警", t):
        return "红"
    if re.search(r"橙色预警|橙预警", t):
        return "橙"
    if re.search(r"黄色预警|黄预警", t):
        return "黄"
    if re.search(r"蓝色预警|蓝预警", t):
        return "蓝"
    return None


def is_cma_alert(source: str | None, unit: str | None, metrics: dict) -> bool:
    return source == "cma" or unit == "alert" or bool(metrics.get("cma_level") or metrics.get("cma_alertscore"))


def official_tone(headline: str | None, metrics: dict) -> str | None:
    raw = metrics.get("gdacs_alert") or metrics.get("usgs_alert")
    if raw:
        k = str(raw).lower()
        if k in ("green", "yellow", "orange", "red"):
            return k
    lv = cma_level_from_text(f"{headline or ''} {metrics.get('cma_headline') or ''}") or metrics.get("cma_level")
    return _CMA_LEVEL_TONE.get(str(lv)) if lv else None


def _g(band: str, tone: str, zh: str, en: str) -> dict:
    return {"band": band, "tone": tone if tone in TONES else "neutral", "zh": zh, "en": en}


def compute_grade(*, type_: str, magnitude: float | None, unit: str | None,
                  confidence: float | None, source: str | None,
                  headline: str | None, metrics: dict | None) -> dict:
    met = metrics if isinstance(metrics, dict) else {}
    mag = None
    if magnitude is not None:
        try:
            mag = float(magnitude)
        except (TypeError, ValueError):
            mag = None
    tone_off = official_tone(headline, met)
    azh = _ALERT_ZH.get(tone_off or "", "")
    aen = _ALERT_EN.get(tone_off or "", "")
    t = type_

    if t == "earthquake":
        if mag is not None:
            if mag >= 8: band, zh, en = "great", "巨大地震", "Great"
            elif mag >= 7: band, zh, en = "major", "大地震", "Major"
            elif mag >= 6: band, zh, en = "strong", "强震", "Strong"
            elif mag >= 5: band, zh, en = "moderate", "中强震", "Moderate"
            elif mag >= 4: band, zh, en = "light", "有感地震", "Light"
            elif mag >= 3: band, zh, en = "minor", "小震", "Minor"
            else: band, zh, en = "micro", "微震", "Micro"
            tone = "red" if mag >= 7 else "yellow" if mag >= 5 else "neutral"
            pz = f"{azh}警报 · " if tone_off else ""
            pe = f"{aen} alert · " if tone_off else ""
            return _g(band, tone, f"{pz}{zh} M{mag:.1f}", f"{pe}{en} M{mag:.1f}")
        if tone_off:
            return _g("alert", tone_off, f"{azh}警报", f"{aen} alert")
        return _g("na", "neutral", "震级未定", "Magnitude n/a")

    if t == "cyclone":
        if mag is not None:
            if mag >= 137: band, zh, en, tone = "cat5", "五级飓风", "Cat-5 hurricane", "red"
            elif mag >= 113: band, zh, en, tone = "cat4", "四级飓风", "Cat-4 hurricane", "red"
            elif mag >= 96: band, zh, en, tone = "cat3", "三级飓风", "Cat-3 hurricane", "orange"
            elif mag >= 83: band, zh, en, tone = "cat2", "二级飓风", "Cat-2 hurricane", "orange"
            elif mag >= 64: band, zh, en, tone = "cat1", "一级飓风", "Cat-1 hurricane", "yellow"
            elif mag >= 34: band, zh, en, tone = "ts", "热带风暴", "Tropical storm", "yellow"
            else: band, zh, en, tone = "td", "热带低压", "TD", "green"
            pz = f"{azh} · " if tone_off else ""
            pe = f"{aen} · " if tone_off else ""
            return _g(band, tone_off or tone, f"{pz}{zh} {fmt_num(mag)} 节", f"{pe}{en} {fmt_num(mag)} kts")
        if tone_off:
            return _g("alert", tone_off, f"{azh}警报 · 气旋", f"{aen} · cyclone")
        return _g("na", "neutral", "气旋等级未定", "Cyclone grade n/a")

    if t == "wildfire":
        if mag is not None and unit == "MW":
            if mag >= 5000: band, zh, en, tone = "extreme", "特大火点簇", "Extreme fire cluster", "red"
            elif mag >= 1000: band, zh, en, tone = "large", "大型火点簇", "Large fire cluster", "orange"
            elif mag >= 300: band, zh, en, tone = "medium", "中型火点簇", "Medium fire cluster", "yellow"
            elif mag >= 50: band, zh, en, tone = "notable", "较大火点簇", "Notable fire cluster", "yellow"
            else: band, zh, en, tone = "small", "小型火点簇", "Small fire cluster", "green"
            return _g(band, tone, f"{zh} FRP {fmt_num(mag)} MW", f"{en} FRP {fmt_num(mag)} MW")
        if mag is not None:
            if mag >= 100000: band, zh, en, tone = "extreme", "特大火场", "Extremely large fire", "red"
            elif mag >= 10000: band, zh, en, tone = "large", "大型火场", "Large fire", "orange"
            elif mag >= 1000: band, zh, en, tone = "medium", "中型火场", "Medium fire", "yellow"
            elif mag >= 100: band, zh, en, tone = "notable", "较大火场", "Notable fire", "yellow"
            else: band, zh, en, tone = "small", "小型火场", "Small fire", "green"
            pz = f"{azh} · " if tone_off else ""
            pe = f"{aen} · " if tone_off else ""
            return _g(band, tone_off or tone, f"{pz}{zh} {fmt_num(mag)} 英亩", f"{pe}{en} {fmt_num(mag)} acres")
        if tone_off:
            return _g("alert", tone_off, f"{azh}警报 · 野火", f"{aen} alert · wildfire")
        return _g("na", "neutral", "火场规模未定", "Burn area n/a")

    if t == "rainstorm":
        if tone_off:
            return _g("alert", tone_off, f"{azh}暴雨预警", f"{aen} rainstorm warning")
        return _g("alert", "orange", "暴雨预警", "Rainstorm warning")

    if t == "flood":
        if is_cma_alert(source, unit, met) and tone_off:
            return _g("alert", tone_off, f"{azh}山洪/洪水风险预警", f"{aen} flood-risk warning")
        if tone_off:
            if mag is not None and unit != "alert":
                return _g("alert", tone_off, f"{azh}警报 · 径流 {fmt_num(mag)} m³/s",
                          f"{aen} alert · discharge {fmt_num(mag)} m³/s")
            return _g("alert", tone_off, f"{azh}警报 · 洪水", f"{aen} alert · flood")
        if mag is not None and unit != "alert":
            ratio = met.get("ratio")
            try:
                r = float(ratio) if ratio is not None else None
            except (TypeError, ValueError):
                r = None
            if r is not None:
                tone = "red" if r >= 7 else "orange" if r >= 4 else "yellow"
                return _g("discharge", tone, f"径流量 {fmt_num(mag)} m³/s · 基线 {fmt_num(r)} 倍",
                          f"Discharge {fmt_num(mag)} m³/s · {fmt_num(r)}× baseline")
            return _g("discharge", "yellow", f"径流量 {fmt_num(mag)} m³/s", f"Discharge {fmt_num(mag)} m³/s")
        return _g("na", "neutral", "洪水等级未定", "Flood grade n/a")

    if t == "volcano":
        if tone_off:
            return _g("alert", tone_off, f"{azh}警报 · 火山活动", f"{aen} alert · volcano")
        if mag is not None:
            return _g("activity", "orange", f"火山活动 {fmt_num(mag)}", f"Volcano {fmt_num(mag)}")
        return _g("activity", "orange", "火山活动", "Volcano activity")

    if t == "drought":
        if tone_off:
            return _g("alert", tone_off, f"{azh}警报 · 干旱", f"{aen} alert · drought")
        return _g("alert", "yellow", "干旱预警", "Drought alert")

    if t == "war":  # 遗留类型
        level = met.get("war_level") or ("high" if (mag or 0) >= 2.5 else "medium")
        if level == "high":
            return _g("high", "red", "高强度战区 / 持续冲突", "High-intensity war zone / ongoing conflict")
        if level == "medium":
            return _g("medium", "orange", "中等强度冲突关注区", "Medium-intensity conflict zone")
        return _g("low", "yellow", "冲突关注区", "Conflict watch area")

    if t in ("crisis_signal", "armed_clash"):
        conf = float(confidence) if confidence is not None else 0.0
        n = mag if mag is not None else (met.get("article_count") or met.get("event_count") or 0)
        if conf >= 0.7: band, zh, en, tone = "high", "高置信", "High conf.", "red"
        elif conf >= 0.45: band, zh, en, tone = "medium", "中置信", "Medium conf.", "orange"
        elif conf >= 0.25: band, zh, en, tone = "low", "低置信", "Low conf.", "yellow"
        else: band, zh, en, tone = "low", "低置信", "Low conf.", "neutral"
        uz, ue = ("起事件", "events") if unit == "events" else ("篇报道", "articles")
        return _g(band, tone, f"{zh} · {fmt_num(n)} {uz}", f"{en} · {fmt_num(n)} {ue}")

    if tone_off:
        return _g("alert", tone_off, f"{azh}警报", f"{aen} alert")
    if mag is not None:
        u = unit or ""
        return _g("value", "neutral", f"{fmt_num(mag)} {u}".strip(), f"{fmt_num(mag)} {u}".strip())
    return _g("na", "neutral", "等级待定", "Grade n/a")


def grade_for_row(r) -> dict:
    """SQLAlchemy Row（event 表列）→ grade。"""
    return compute_grade(
        type_=r.type, magnitude=r.magnitude_value, unit=r.magnitude_unit,
        confidence=r.confidence, source=r.primary_source, headline=r.headline,
        metrics=r.metrics if isinstance(r.metrics, dict) else None,
    )
