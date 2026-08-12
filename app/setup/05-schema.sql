-- D:\crisis\setup\05-schema.sql
-- 执行:psql -U postgres -d crisis -f D:\crisis\setup\05-schema.sql

-- ========== 主表:内部事件(前端与告警只读这张表)==========
CREATE TABLE event (
    id              BIGSERIAL PRIMARY KEY,

    -- 两级分类:大类用于告警阈值分组,细类用于前端图层
    category        TEXT NOT NULL,   -- natural | conflict
    type            TEXT NOT NULL,   -- earthquake|cyclone|flood|wildfire|
                                     -- volcano|drought|armed_clash|crisis_signal

    -- 严重度:0.0-1.0 归一化,仅用于地图热力与排序
    -- 告警阈值按 category 分别配置,不跨类共用(见 8.6)
    severity        REAL NOT NULL DEFAULT 0,
    -- 置信度:自然灾害恒为 1.0;冲突信号按交叉验证程度取 0.2-0.9
    confidence      REAL NOT NULL DEFAULT 1.0,

    status          TEXT NOT NULL DEFAULT 'active',
                                     -- unconfirmed|active|revised|closed|deleted

    -- 物理量与单位分开存,避免震级/风速/过火面积混为一列
    magnitude_value REAL,
    magnitude_unit  TEXT,           -- M | kts | acres | m3/s | fatalities

    centroid        GEOGRAPHY(POINT,4326) NOT NULL,
    footprint       GEOGRAPHY(GEOMETRY,4326),  -- 台风路径线 / 洪水面 / 火场轮廓
    country_iso3    TEXT,           -- 由 centroid 空间连接得出,便于按国家聚合

    -- 三个时间字段缺一不可,详见下方说明
    occurred_at     TIMESTAMPTZ NOT NULL,
    first_seen_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

    headline        TEXT,
    primary_source  TEXT,           -- 该事件采信哪个源的坐标与量级
    metrics         JSONB NOT NULL DEFAULT '{}'::jsonb,
    actors          JSONB,          -- 冲突行动方,自然灾害为 NULL
    revision        INT NOT NULL DEFAULT 1
);

CREATE INDEX idx_event_centroid  ON event USING GIST (centroid);
CREATE INDEX idx_event_occurred  ON event (occurred_at DESC);
CREATE INDEX idx_event_cat_type  ON event (category, type);
CREATE INDEX idx_event_active    ON event (occurred_at DESC)
                                     WHERE status IN ('active','revised');

-- ========== 源观测:保留每个源的原始记录,可追溯可回放 ==========
CREATE TABLE observation (
    id              BIGSERIAL PRIMARY KEY,
    event_id        BIGINT REFERENCES event(id) ON DELETE CASCADE,
    source          TEXT NOT NULL,   -- usgs|emsc|gdacs|eonet|gdelt|openmeteo
    source_event_id TEXT NOT NULL,
    raw             JSONB NOT NULL,  -- 原始响应完整留存
    ingested_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (source, source_event_id)   -- ← upsert 的落点,红线:绝不能用纯 INSERT
);
CREATE INDEX idx_obs_event ON observation (event_id);

-- ========== 数据源健康:静默失败比报错更危险 ==========
CREATE TABLE source_health (
    source          TEXT PRIMARY KEY,
    last_success_at TIMESTAMPTZ,
    last_attempt_at TIMESTAMPTZ,
    last_error      TEXT,
    consecutive_failures INT NOT NULL DEFAULT 0,
    total_success   BIGINT NOT NULL DEFAULT 0,
    total_failure   BIGINT NOT NULL DEFAULT 0,
    next_run_at     TIMESTAMPTZ       -- 供前端显示"下次轮询倒计时"
);

-- ========== 地理围栏:关注区域 ==========
CREATE TABLE watch_region (
    id              SERIAL PRIMARY KEY,
    name            TEXT NOT NULL,
    geom            GEOGRAPHY(POLYGON,4326) NOT NULL,
    enabled         BOOLEAN NOT NULL DEFAULT true
);
CREATE INDEX idx_watch_geom ON watch_region USING GIST (geom);

-- ========== 洪水关注点(Open-Meteo 按点查询)==========
CREATE TABLE watch_point (
    id              SERIAL PRIMARY KEY,
    name            TEXT NOT NULL,
    lat             DOUBLE PRECISION NOT NULL,
    lon             DOUBLE PRECISION NOT NULL,
    baseline_discharge REAL,   -- 历史基线,首次采样后回填
    trigger_ratio   REAL NOT NULL DEFAULT 2.0,  -- 超基线倍数触发
    enabled         BOOLEAN NOT NULL DEFAULT true
);

-- ========== 告警记录与静默窗口(替代 Redis)==========
CREATE TABLE alert (
    id              BIGSERIAL PRIMARY KEY,
    event_id        BIGINT REFERENCES event(id) ON DELETE CASCADE,
    rule_name       TEXT NOT NULL,
    channel         TEXT NOT NULL,   -- web|telegram|webhook
    dispatched_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    delivered       BOOLEAN NOT NULL DEFAULT false,
    detail          TEXT
);
CREATE INDEX idx_alert_event ON alert (event_id);

CREATE TABLE alert_mute (
    event_id        BIGINT PRIMARY KEY REFERENCES event(id) ON DELETE CASCADE,
    muted_until     TIMESTAMPTZ NOT NULL,
    last_severity   REAL NOT NULL   -- 等级跃升时可突破静默
);

-- ========== 国家边界(Natural Earth 导入,用于底图与国家质心)==========
CREATE TABLE country (
    iso3            TEXT PRIMARY KEY,
    name_zh         TEXT,
    name_en         TEXT NOT NULL,
    geom            GEOGRAPHY(MULTIPOLYGON,4326),
    centroid        GEOGRAPHY(POINT,4326) NOT NULL
);
CREATE INDEX idx_country_geom ON country USING GIST (geom);
