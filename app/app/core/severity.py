# D:\crisis\app\app\core\severity.py
from .schemas import NormalizedEvent

# 地震:分段映射,贴合能量的对数特性
# 每档内部线性插值,档位边界按有感/破坏性/重大灾害的实际影响划分
_EQ_BANDS = [
    (0.0, 4.0, 0.05, 0.15),
    (4.0, 5.0, 0.15, 0.35),
    (5.0, 6.0, 0.35, 0.58),
    (6.0, 7.0, 0.58, 0.80),
    (7.0, 8.0, 0.80, 0.94),
    (8.0, 10.0, 0.94, 1.00),
]


def _band(v: float, bands) -> float:
    for lo, hi, slo, shi in bands:
        if lo <= v < hi:
            ratio = (v - lo) / (hi - lo)
            return round(slo + (shi - slo) * ratio, 3)
    return 1.0 if v >= bands[-1][1] else 0.05


def compute_severity(ev: NormalizedEvent) -> float:
    v = ev.magnitude_value

    if ev.type == "earthquake":
        if v is None:
            return 0.05
        s = _band(v, _EQ_BANDS)
        # 海啸标志是独立的放大因子
        if ev.metrics.get("tsunami_flag"):
            s = min(1.0, s + 0.15)
        # 浅源地震破坏力更强
        depth = ev.metrics.get("depth_km")
        if depth is not None and depth < 30 and v >= 5.0:
            s = min(1.0, s + 0.05)
        return round(s, 3)

    if ev.type == "cyclone":
        # 风速 kts,按萨菲尔-辛普森分级边界
        if v is None:
            return 0.3
        return _band(v, [(0, 34, 0.10, 0.25), (34, 64, 0.25, 0.45),
                          (64, 83, 0.45, 0.62), (83, 113, 0.62, 0.80),
                          (113, 137, 0.80, 0.92), (137, 250, 0.92, 1.00)])

    if ev.type == "wildfire":
        # 过火面积 acres,跨度极大,用对数分档
        if v is None:
            return 0.2
        return _band(v, [(0, 100, 0.10, 0.25), (100, 1000, 0.25, 0.45),
                          (1000, 10000, 0.45, 0.70),
                          (10000, 100000, 0.70, 0.90),
                          (100000, 1e7, 0.90, 1.00)])

    if ev.type == "war":
        # 战争/战区：强度档 1~3 + 置信度，视觉上限 0.85
        n = v or 2.0
        base = _band(float(n), [(0, 1.5, 0.35, 0.5), (1.5, 2.5, 0.5, 0.68),
                                (2.5, 5, 0.68, 0.85)])
        return round(min(0.85, base * max(0.5, ev.confidence)), 3)

    if ev.category == "conflict":
        # 新闻信号强度 = 报道量 × 置信度,且封顶 0.7。
        # 封顶的理由:新闻信号本质上不是确证事件,不应与实测的
        # 自然灾害在视觉权重上等同。
        n = v or 1.0
        base = _band(float(n), [(0, 5, 0.10, 0.25), (5, 20, 0.25, 0.45),
                                (20, 60, 0.45, 0.60), (60, 500, 0.60, 0.70)])
        return round(min(0.7, base * ev.confidence), 3)

    if ev.type == "rainstorm":
        g = ev.metrics.get("cma_alertscore")
        if g is not None:
            try:
                return float(g)
            except (TypeError, ValueError):
                pass
        return 0.55

    if ev.type == "flood":
        # GDACS 洪水：优先官方 alertscore
        g = ev.metrics.get("gdacs_alertscore")
        if g is None:
            g = ev.metrics.get("cma_alertscore")
        if g is not None and (v is None or ev.metrics.get("ratio") is None):
            try:
                return float(g)
            except (TypeError, ValueError):
                pass
        # Open-Meteo：触发用相对量 ratio=peak/baseline；severity 必须同语义（REV-06）
        # 避免小河真洪灾（高 ratio、低绝对流量）severity 过低不告警，大河常态高流量饱和 1.0
        ratio = ev.metrics.get("ratio")
        if ratio is not None:
            try:
                r = float(ratio)
            except (TypeError, ValueError):
                r = 1.0
            # ratio 约 1.5 起跳、2–3 中等、5+ 高、10+ 极高
            s = _band(
                r,
                [
                    (0.0, 1.5, 0.10, 0.28),
                    (1.5, 2.5, 0.28, 0.48),
                    (2.5, 4.0, 0.48, 0.68),
                    (4.0, 7.0, 0.68, 0.85),
                    (7.0, 15.0, 0.85, 0.95),
                    (15.0, 100.0, 0.95, 1.00),
                ],
            )
            # 绝对流量仅作轻微修正，不主导分档
            if v is not None:
                try:
                    peak = float(v)
                    if peak >= 2000:
                        s = min(1.0, s + 0.05)
                    elif peak < 20 and r >= 3.0:
                        # 小河高倍超标仍保持告警可达
                        s = max(s, 0.55)
                except (TypeError, ValueError):
                    pass
            return round(s, 3)
        if v is None:
            return 0.5
        # 无 ratio 时的退化：绝对流量（仅兼容旧数据）
        return round(min(1.0, 0.3 + float(v) / 1000.0), 3)

    # GDACS 火山/干旱等:优先用官方红橙绿映射
    g = ev.metrics.get("gdacs_alertscore")
    if g is None:
        g = ev.metrics.get("cma_alertscore")
    if g is not None:
        return float(g)

    return 0.3
