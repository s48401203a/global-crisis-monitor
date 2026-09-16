-- 10-reliability.sql · 同步游标、当前/峰值严重度、采集结果口径
-- 幂等；由 setup/migrate.sh 在事务中执行。

-- 变更序号：按语句分配，增量按 change_seq 分页。延迟提交仍可能晚于更大序号可见，
-- 客户端必须以快照对账补齐，不能把截断页的 server_time 当作无损水位。
CREATE SEQUENCE IF NOT EXISTS event_change_seq;

ALTER TABLE event ADD COLUMN IF NOT EXISTS change_seq BIGINT;
UPDATE event SET change_seq = nextval('event_change_seq') WHERE change_seq IS NULL;
ALTER TABLE event ALTER COLUMN change_seq SET DEFAULT nextval('event_change_seq');
ALTER TABLE event ALTER COLUMN change_seq SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_event_change_seq ON event (change_seq);

-- 当前严重度可随源侧降级下降；峰值只升不降，供历史，不参与前端计数。
ALTER TABLE event ADD COLUMN IF NOT EXISTS severity_peak REAL;
UPDATE event SET severity_peak = GREATEST(COALESCE(severity_peak, 0), COALESCE(severity, 0))
 WHERE severity_peak IS NULL;
ALTER TABLE event ALTER COLUMN severity_peak SET DEFAULT 0;
ALTER TABLE event ALTER COLUMN severity_peak SET NOT NULL;

ALTER TABLE source_health ADD COLUMN IF NOT EXISTS last_ingest_status TEXT;
ALTER TABLE source_health ADD COLUMN IF NOT EXISTS last_ingest_ok INT NOT NULL DEFAULT 0;
ALTER TABLE source_health ADD COLUMN IF NOT EXISTS last_ingest_fail INT NOT NULL DEFAULT 0;
