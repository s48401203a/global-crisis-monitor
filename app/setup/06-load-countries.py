# D:\crisis\app\setup\06-load-countries.py
# 下载 Natural Earth 110m 国界(public domain),入库并生成前端底图文件
import json, pathlib, sys
import httpx
from sqlalchemy import text

# 允许从任意 cwd 执行:python setup/06-load-countries.py
_ROOT = pathlib.Path(__file__).resolve().parents[1]
if str(_ROOT) not in sys.path:
    sys.path.insert(0, str(_ROOT))

from app.db import get_session

URL = ("https://raw.githubusercontent.com/nvkelso/natural-earth-vector/"
       "master/geojson/ne_110m_admin_0_countries.geojson")

OUT = _ROOT / "app" / "static" / "data" / "countries.geojson"
OUT.parent.mkdir(parents=True, exist_ok=True)

data = httpx.get(URL, timeout=120, follow_redirects=True).json()

# 前端底图只需要几何与名称,剥掉其余 90 多个属性字段以减小体积
slim = {"type": "FeatureCollection", "features": [
    {"type": "Feature", "geometry": f["geometry"],
     "properties": {"iso3": f["properties"].get("ADM0_A3"),
                    "name": f["properties"].get("NAME")}}
    for f in data["features"]
]}
# 铁律:显式 encoding + ensure_ascii=False(红线 #5)
with open(OUT, "w", encoding="utf-8") as f:
    json.dump(slim, f, ensure_ascii=False)
print(f"底图已写入 {OUT},{len(slim['features'])} 个国家")

# 入库:供事件的国家归属判定与 GDELT 国家质心定位
with get_session() as s:
    for f in data["features"]:
        p = f["properties"]
        iso3 = p.get("ADM0_A3")
        if not iso3:
            continue
        s.execute(text("""
            INSERT INTO country (iso3, name_en, geom, centroid)
            VALUES (:iso3, :name,
                    ST_Multi(ST_GeomFromGeoJSON(:geom))::geography,
                    ST_PointOnSurface(ST_GeomFromGeoJSON(:geom))::geography)
            ON CONFLICT (iso3) DO UPDATE
               SET geom = EXCLUDED.geom, centroid = EXCLUDED.centroid
        """), {"iso3": iso3, "name": p.get("NAME"),
               "geom": json.dumps(f["geometry"])})
print("country 表已更新")
