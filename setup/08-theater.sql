-- 08-theater.sql · 战区基线层独立成表（从 event 表移出，不再计入事件统计/告警）
CREATE TABLE IF NOT EXISTS theater (
    id          TEXT PRIMARY KEY,            -- 如 war:UKR，稳定不变
    iso3        TEXT,
    name_zh     TEXT NOT NULL,
    name_en     TEXT,
    geom        GEOGRAPHY(POINT,4326) NOT NULL,
    level       TEXT NOT NULL DEFAULT 'medium',   -- high | medium | low
    note_zh     TEXT,
    note_en     TEXT,
    enabled     BOOLEAN NOT NULL DEFAULT true,
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_theater_geom ON theater USING GIST (geom);

-- 种子：与原 war_hotspots.HOTSPOTS 一致；坐标可被 migrate_theaters.py 用 country 质心校准
INSERT INTO theater (id, iso3, name_zh, name_en, geom, level, note_zh)
SELECT v.id, v.iso3, v.zh, v.en, ST_MakePoint(v.lon, v.lat)::geography, v.level, v.note
  FROM (VALUES
    ('war:UKR',     'UKR', '乌克兰—俄罗斯战争',            'Ukraine–Russia war',              31.2, 48.4, 'high',   '国家间大规模战争'),
    ('war:RUS-UKR', 'RUS', '俄罗斯—乌克兰战争（俄方战区）', 'Russia–Ukraine war theater',      40.0, 51.0, 'high',   '国家间战争相关公开战区'),
    ('war:ISR-PSE', 'PSE', '巴以/加沙武装冲突',            'Israel–Palestine armed conflict', 34.45, 31.5, 'high',  '国家/准国家武装冲突'),
    ('war:IRN',     'IRN', '伊朗相关地区军事对峙',         'Iran regional military tension',  53.7, 32.4, 'medium', '国家间代理人与军事对峙'),
    ('war:HORMUZ',  NULL,  '霍尔木兹海峡军事与航运对抗',   'Strait of Hormuz',                56.5, 26.6, 'high',   '国家间军事紧张下的战略水道冲突风险'),
    ('war:YEM',     'YEM', '也门内战与红海武装袭扰',       'Yemen war / Red Sea',             48.5, 15.5, 'high',   '内战 + 跨境/航运武装冲突'),
    ('war:SDN',     'SDN', '苏丹内战',                     'Sudan civil war',                 30.2, 15.5, 'high',   '武装派别间战争级冲突'),
    ('war:MMR',     'MMR', '缅甸内战/地方武装冲突',        'Myanmar armed conflict',          96.1, 21.9, 'medium', '政权与地方武装战争级冲突'),
    ('war:SYR',     'SYR', '叙利亚武装冲突',               'Syria armed conflict',            38.0, 35.0, 'medium', '多国代理人与地方武装冲突'),
    ('war:LBN',     'LBN', '黎巴嫩边境跨境武装冲突',       'Lebanon border clashes',          35.5, 33.9, 'medium', '跨境军事交火'),
    ('war:SAHEL',   'MLI', '萨赫勒国家间/武装团体战争',    'Sahel armed conflict',            -2.0, 17.0, 'medium', '国家军队与武装团体战争级冲突'),
    ('war:COD',     'COD', '刚果（金）东部武装冲突',       'DRC eastern war',                 29.0, -1.5, 'high',   '武装团体与国家军队战争级冲突')
  ) AS v(id, iso3, zh, en, lon, lat, level, note)
 WHERE NOT EXISTS (SELECT 1 FROM theater t WHERE t.id = v.id);
