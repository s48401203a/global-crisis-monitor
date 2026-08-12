# -*- coding: utf-8 -*-
from pathlib import Path
import re
import shutil

src = Path(r"D:\crisis\app\app\static\index.html").read_text(encoding="utf-8")
m_style = re.search(r"<style>([\s\S]*?)</style>", src)
m_script = re.search(r"<script>([\s\S]*?)</script>\s*</body>", src)
if not m_style or not m_script:
    raise SystemExit("parse fail: style/script not found")

css = m_style.group(1).strip() + "\n"
js = m_script.group(1).strip() + "\n"
body = re.search(r"<body>([\s\S]*)</body>", src).group(1)
body = re.sub(r"<style>[\s\S]*?</style>", "", body)
body = re.sub(r"<script>[\s\S]*?</script>", "", body).strip()

web = Path(r"D:\crisis\web")
(web / "src").mkdir(parents=True, exist_ok=True)
(web / "public" / "data").mkdir(parents=True, exist_ok=True)

(web / "src" / "styles.css").write_text(css, encoding="utf-8")
# import css from main.js
main_js = 'import "./styles.css";\n\n' + js
(web / "src" / "main.js").write_text(main_js, encoding="utf-8")

index = f"""<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>全球综合危机监测中心</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
  <link href="https://unpkg.com/maplibre-gl@5.6.1/dist/maplibre-gl.css" rel="stylesheet">
  <script src="https://unpkg.com/maplibre-gl@5.6.1/dist/maplibre-gl.js"></script>
</head>
<body>
{body}
  <script type="module" src="/src/main.js"></script>
</body>
</html>
"""
(web / "index.html").write_text(index, encoding="utf-8")

geo_src = Path(r"D:\crisis\app\app\static\data\countries.geojson")
geo_dst = web / "public" / "data" / "countries.geojson"
if geo_src.exists():
    shutil.copy2(geo_src, geo_dst)
    print("geojson copied", geo_dst.stat().st_size)
else:
    print("WARN: countries.geojson missing")

print("css", len(css), "js", len(js), "body", len(body))
print("done")
