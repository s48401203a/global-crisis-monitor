-- 09-watch-sample.sql · 洪水关注点逐日径流样本；基线 = 近 90 天样本中位数
CREATE TABLE IF NOT EXISTS watch_sample (
    point_id    INT NOT NULL REFERENCES watch_point(id) ON DELETE CASCADE,
    day         DATE NOT NULL,
    discharge   REAL NOT NULL,
    kind        TEXT NOT NULL DEFAULT 'forecast',   -- reanalysis | forecast
    PRIMARY KEY (point_id, day)
);

-- event 增列：聚合信号标记（GDELT 国家×日）与生命周期关闭时间
ALTER TABLE event ADD COLUMN IF NOT EXISTS is_aggregate BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE event ADD COLUMN IF NOT EXISTS closed_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS idx_event_updated ON event (updated_at DESC);

-- 记录已执行的迁移（migrate.sh 用）
CREATE TABLE IF NOT EXISTS schema_migration (
    name        TEXT PRIMARY KEY,
    applied_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
