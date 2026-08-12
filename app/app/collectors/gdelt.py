# D:\crisis\app\app\collectors\gdelt.py
# 冲突信号采集：
# 1) 优先解析 GDELT 2.0 最新 export.CSV（限流友好）
# 2) DOC API 作为补充（常 429，失败不致命）
from __future__ import annotations

import csv
import io
import logging
import re
import zipfile
from collections import defaultdict
from datetime import datetime, timezone
from typing import Any

import httpx
from sqlalchemy import text

from .base import BaseCollector
from ..core.schemas import NormalizedEvent
from ..db import get_session

log = logging.getLogger(__name__)

LASTUPDATE = "http://data.gdeltproject.org/gdeltv2/lastupdate.txt"
DOC_URL = "https://api.gdeltproject.org/api/v2/doc/doc"

# CAMEO 根码：18 袭击 19 战斗 20 非常规大规模暴力
# 仅保留「国家/代理人/边境武装」级，排除普通治安枪击
ROOT_CODES = {"18", "19", "20"}
# 行为体类型（政治/军事/反叛/分离等），普通 CIV 互殴不计入
STATE_ACTOR_TYPES = {
    "GOV", "MIL", "REB", "INS", "SEP", "OPP", "SPY", "COP",
    "MOD", "LEG", "JUD", "ELI", "RAG", "PTY",
}
# 事件码前缀：军事交火/空袭/占领/大规模暴力（排除轻微 18x 街头伤害若无国家行为体）
MILITARY_EVENT_PREFIXES = (
    "190", "191", "192", "193", "194", "195", "196",  # fight
    "180", "181", "182", "183", "184", "185", "186",  # assault (需国家行为体)
    "200", "201", "202", "203", "204",  # mass violence
)
# 至少提及次数，过滤单次零星治安报道
MIN_MENTIONS = 5

# FIPS10-4 → ISO3（GDELT ActionGeo_CountryCode 常用 FIPS）
FIPS_TO_ISO3 = {
    "UP": "UKR", "RS": "RUS", "US": "USA", "CH": "CHN", "IR": "IRN",
    "IS": "ISR", "GZ": "PSE", "WE": "PSE", "SY": "SYR", "IZ": "IRQ",
    "YM": "YEM", "SU": "SDN", "BM": "MMR", "LE": "LBN", "SA": "SAU",
    "AE": "ARE", "MU": "OMN", "QA": "QAT", "BA": "BHR", "KU": "KWT",
    "AF": "AFG", "PK": "PAK", "IN": "IND", "PK": "PAK", "TU": "TUR",
    "EG": "EGY", "LY": "LBY", "AG": "DZA", "MO": "MAR", "NI": "NGA",
    "ML": "MLI", "SG": "SEN", "CD": "COD", "CG": "COG", "ET": "ETH",
    "SO": "SOM", "KE": "KEN", "UG": "UGA", "RW": "RWA", "BY": "BLR",
    "PL": "POL", "GM": "DEU", "FR": "FRA", "UK": "GBR", "IT": "ITA",
    "SP": "ESP", "JA": "JPN", "KS": "KOR", "VM": "VNM", "TH": "THA",
    "ID": "IDN", "RP": "PHL", "MX": "MEX", "CO": "COL", "VE": "VEN",
    "BR": "BRA", "AR": "ARG", "PE": "PER", "CI": "CHL", "CU": "CUB",
    "HA": "HTI", "PM": "PAN", "HO": "HND", "NU": "NIC", "ES": "SLV",
    "GT": "GTM", "AJ": "AZE", "AM": "ARM", "GG": "GEO", "TX": "TKM",
    "UZ": "UZB", "KZ": "KAZ", "KG": "KGZ", "TI": "TJK", "AF": "AFG",
}

CONF_BY_COUNT = {1: 0.35, 2: 0.5, 3: 0.65, 4: 0.75, 5: 0.85}


class GdeltCollector(BaseCollector):
    name = "gdelt"
    timeout = 60.0

    def __init__(self):
        self._country_index: list[tuple[str, str, float, float]] = []
        self._iso_centroid: dict[str, tuple[float, float, str]] = {}

    def fetch(self) -> Any:
        """优先 export CSV；失败再试 DOC API。"""
        try:
            return {"mode": "export", "rows": self._fetch_export_rows()}
        except Exception as e:
            log.warning("[gdelt] export 失败，尝试 DOC API: %r", e)
        try:
            doc = self._fetch_doc_api()
            return {"mode": "doc", "doc": doc}
        except Exception as e:
            log.warning("[gdelt] DOC API 也失败: %r", e)
            raise RuntimeError(f"GDELT export+DOC 均失败: {e!r}")

    def _fetch_export_rows(self) -> list[list[str]]:
        # lastupdate.txt 首行指向最新 export.CSV.zip
        meta = httpx.get(LASTUPDATE, timeout=30, follow_redirects=True)
        meta.raise_for_status()
        export_url = None
        for line in meta.text.splitlines():
            if "export.CSV.zip" in line:
                parts = line.split()
                export_url = parts[-1] if parts else None
                break
        if not export_url:
            raise RuntimeError("lastupdate.txt 中无 export.CSV.zip")

        r = httpx.get(export_url, timeout=90, follow_redirects=True)
        r.raise_for_status()
        rows: list[list[str]] = []
        with zipfile.ZipFile(io.BytesIO(r.content)) as zf:
            name = zf.namelist()[0]
            with zf.open(name) as f:
                # GDELT export 为 UTF-8 TSV 无表头
                text_data = io.TextIOWrapper(f, encoding="utf-8", errors="replace")
                reader = csv.reader(text_data, delimiter="\t")
                for i, row in enumerate(reader):
                    if i > 12000:
                        break
                    if len(row) < 58:
                        continue
                    if not self._is_state_level_conflict(row):
                        continue
                    try:
                        lat = float(row[56])
                        lon = float(row[57])
                    except (ValueError, IndexError):
                        continue
                    if not (-90 <= lat <= 90 and -180 <= lon <= 180):
                        continue
                    rows.append(row)
        log.info("[gdelt] export 国家/武装级冲突行 %d", len(rows))
        return rows

    @classmethod
    def _is_state_level_conflict(cls, row: list[str]) -> bool:
        """
        只保留国家间战争、代理人战争、边境/武装冲突。
        排除普通枪击、治安案件、个人暴力（无政治军事行为体）。
        """
        root = (row[28] if len(row) > 28 else "") or ""
        base = (row[27] if len(row) > 27 else "") or ""
        code = (row[26] if len(row) > 26 else "") or ""
        if root not in ROOT_CODES and not (
            base.startswith("18") or base.startswith("19") or base.startswith("20")
        ):
            return False

        try:
            mentions = int(float(row[31] or 0))  # NumMentions
        except ValueError:
            mentions = 0
        try:
            articles = int(float(row[33] or 0))  # NumArticles
        except ValueError:
            articles = 0

        # GDELT 2.0：Actor1Code=5, Actor1Type1=12, Actor2Code=15, Actor2Type1=21
        # Actor1CountryCode=7, Actor2CountryCode=17
        a1t = (row[12] if len(row) > 12 else "") or ""
        a2t = (row[21] if len(row) > 21 else "") or ""
        a1c = (row[5] if len(row) > 5 else "") or ""
        a2c = (row[15] if len(row) > 15 else "") or ""
        a1cty = (row[7] if len(row) > 7 else "") or ""
        a2cty = (row[17] if len(row) > 17 else "") or ""

        def has_state_actor(type_code: str, actor_code: str) -> bool:
            t = (type_code or "").upper()
            a = (actor_code or "").upper()
            if t in STATE_ACTOR_TYPES:
                return True
            for k in STATE_ACTOR_TYPES:
                if k in a or k in t:
                    return True
            return False

        def looks_country(code: str) -> bool:
            c = (code or "").upper()
            return bool(re.fullmatch(r"[A-Z]{3}", c))

        state_actor = has_state_actor(a1t, a1c) or has_state_actor(a2t, a2c)
        interstate = looks_country(a1cty) or looks_country(a2cty) or looks_country(a1c) or looks_country(a2c)

        # 战斗 / 大规模暴力：国家或政治军事行为体参与，且有一定报道量
        if root in ("19", "20") or base.startswith("19") or base.startswith("20"):
            if not (state_actor or interstate):
                return False
            return mentions >= 4 or articles >= 2 or state_actor

        # 袭击：必须政治/军事/反叛等行为体 —— 排除普通枪击
        if root == "18" or base.startswith("18"):
            if not state_actor:
                return False
            return mentions >= MIN_MENTIONS or articles >= 3

        return False

    def _fetch_doc_api(self) -> dict:
        # 慢请求 + 较宽时间窗；空响应抛错
        import time
        time.sleep(5)
        r = self.http_get(DOC_URL, params={
            "query": '(war OR "armed conflict" OR shelling OR "air strike" OR "missile attack")',
            "mode": "artlist",
            "maxrecords": 75,
            "format": "json",
            "timespan": "1d",
        })
        body = (r.text or "").strip()
        if not body or body.startswith("Please limit") or body[0] not in "{[":
            raise RuntimeError(f"DOC 非 JSON: {body[:80]!r}")
        return r.json()

    def normalize(self, raw: Any) -> list[NormalizedEvent]:
        self._load_country_index()
        if not raw:
            return []
        if raw.get("mode") == "export":
            return self._normalize_export(raw.get("rows") or [])
        return self._normalize_doc(raw.get("doc") or {})

    def _normalize_export(self, rows: list[list[str]]) -> list[NormalizedEvent]:
        # 按国家聚合 15 分钟槽
        now = datetime.now(timezone.utc)
        slot = now.replace(minute=(now.minute // 15) * 15, second=0, microsecond=0)
        buckets: dict[str, list[dict]] = defaultdict(list)

        for row in rows:
            # ActionGeo_CountryCode=53, FullName=52, Lat=56, Long=57
            fips = row[53] if len(row) > 53 else ""
            try:
                lat = float(row[56])
                lon = float(row[57])
            except (ValueError, IndexError):
                continue
            iso3 = FIPS_TO_ISO3.get(str(fips).upper()) if fips else None
            if not iso3:
                iso3 = self._iso_from_point(lon, lat)
            if not iso3:
                iso3 = f"PT:{lon:.1f},{lat:.1f}"
            gold = 0.0
            try:
                gold = abs(float(row[30])) if row[30] else 0.0
            except ValueError:
                pass
            buckets[iso3].append({
                "lat": lat, "lon": lon, "gold": gold,
                "code": row[26] if len(row) > 26 else "",
                "name": row[52] if len(row) > 52 else "",
            })

        out: list[NormalizedEvent] = []
        for iso3, items in buckets.items():
            n = len(items)
            # 单点偶发且无多起互证 → 不入库（避免治安噪声）
            if n < 2:
                continue
            conf = CONF_BY_COUNT.get(min(n, 5), 0.85)
            lat = sum(i["lat"] for i in items) / n
            lon = sum(i["lon"] for i in items) / n
            if iso3 in self._iso_centroid and not iso3.startswith("PT:"):
                lon, lat, cname = (
                    self._iso_centroid[iso3][0],
                    self._iso_centroid[iso3][1],
                    self._iso_centroid[iso3][2],
                )
            else:
                cname = iso3
            gold_avg = sum(i["gold"] for i in items) / n
            # 国家/武装级统一记为 war；强度用事件数表达
            out.append(NormalizedEvent(
                source=self.name,
                source_event_id=f"export:{iso3}:{slot:%Y%m%dT%H%M}",
                category="conflict",
                type="war",
                lat=float(lat), lon=float(lon),
                occurred_at=slot,
                headline=f"{cname}：国家/武装冲突信号 {n} 起（边境或代理人冲突级）",
                magnitude_value=float(n),
                magnitude_unit="events",
                confidence=min(0.9, conf + min(0.1, gold_avg / 100)),
                metrics={
                    "event_count": n,
                    "goldstein_abs_avg": round(gold_avg, 2),
                    "iso3": iso3 if not iso3.startswith("PT:") else None,
                    "source_mode": "export",
                    "filter": "state_level_only",
                },
                raw={"count": n, "iso3": iso3},
            ))
        return out

    def _normalize_doc(self, raw: dict) -> list[NormalizedEvent]:
        # 兼容旧 DOC 聚合逻辑（简化）
        self._load_country_index()
        buckets: dict[str, list[dict]] = defaultdict(list)
        for art in raw.get("articles", []):
            iso3, penalty = self._locate(art)
            if iso3:
                art["_conf_penalty"] = penalty
                buckets[iso3].append(art)

        now = datetime.now(timezone.utc)
        slot = now.replace(minute=(now.minute // 15) * 15, second=0, microsecond=0)
        out: list[NormalizedEvent] = []
        for iso3, arts in buckets.items():
            domains = {a.get("domain") for a in arts if a.get("domain")}
            if len(domains) < 1:
                continue
            conf = CONF_BY_COUNT.get(min(len(domains), 5), 0.85)
            penalty = min(a.get("_conf_penalty", 1.0) for a in arts)
            conf = round(conf * penalty, 2)
            if iso3 not in self._iso_centroid:
                continue
            lon, lat, cname = self._iso_centroid[iso3]
            out.append(NormalizedEvent(
                source=self.name,
                source_event_id=f"doc:{iso3}:{slot:%Y%m%dT%H%M}",
                category="conflict",
                type="crisis_signal",
                lat=lat, lon=lon,
                occurred_at=slot,
                headline=f"{cname}：{len(arts)} 篇冲突相关报道 / {len(domains)} 家媒体",
                magnitude_value=float(len(arts)),
                magnitude_unit="articles",
                confidence=conf,
                metrics={
                    "article_count": len(arts),
                    "domain_count": len(domains),
                    "iso3": iso3,
                    "source_mode": "doc",
                    "samples": [
                        {"title": a.get("title"), "url": a.get("url"), "domain": a.get("domain")}
                        for a in arts[:6]
                    ],
                },
                raw={"iso3": iso3, "count": len(arts)},
            ))
        return out

    def _iso_from_point(self, lon: float, lat: float) -> str | None:
        try:
            with get_session() as s:
                row = s.execute(text("""
                    SELECT iso3 FROM country
                     WHERE ST_Intersects(geom, ST_MakePoint(:lon,:lat)::geography)
                     LIMIT 1
                """), {"lon": lon, "lat": lat}).fetchone()
                return row[0] if row else None
        except Exception:
            return None

    def _locate(self, art: dict) -> tuple[str | None, float]:
        title = (art.get("title") or "").lower()
        for iso3, name_en, _, _ in self._country_index:
            if re.search(r"\b" + re.escape(name_en.lower()) + r"\b", title):
                return iso3, 1.0
        src = art.get("sourcecountry")
        if src:
            for iso3, name_en, _, _ in self._country_index:
                if name_en.lower() == src.lower():
                    return iso3, 0.4
        return None, 0.0

    def _load_country_index(self) -> None:
        if self._country_index:
            return
        with get_session() as s:
            rows = s.execute(text("""
                SELECT iso3, name_en,
                       ST_Y(centroid::geometry), ST_X(centroid::geometry)
                  FROM country
            """)).fetchall()
        self._country_index = sorted(
            [(r[0], r[1], r[2], r[3]) for r in rows],
            key=lambda x: len(x[1] or ""), reverse=True,
        )
        self._iso_centroid = {
            r[0]: (float(r[3]), float(r[2]), r[1] or r[0]) for r in rows if r[0]
        }
