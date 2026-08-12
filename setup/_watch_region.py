import os
import sys

# 密码只从环境变量读取，禁止写入仓库
pw = os.environ.get("PGPASSWORD") or os.environ.get("PGSUPERPASS")
if not pw:
    print("请先设置环境变量 PGPASSWORD 或 PGSUPERPASS", file=sys.stderr)
    sys.exit(1)
os.environ["PGPASSWORD"] = pw
import psycopg
with psycopg.connect("host=localhost dbname=crisis user=postgres") as c:
    c.execute(
        """
        INSERT INTO watch_region (name, geom)
        SELECT 'test-north-china',
               ST_GeomFromText('POLYGON((114 38, 119 38, 119 42, 114 42, 114 38))',4326)::geography
        WHERE NOT EXISTS (SELECT 1 FROM watch_region WHERE name='test-north-china')
        """
    )
    c.commit()
    rows = c.execute("SELECT id, name FROM watch_region").fetchall()
    print("watch_regions", rows)
