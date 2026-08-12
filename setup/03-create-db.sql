-- D:\crisis\setup\03-create-db.sql
-- 执行:psql -U postgres -f D:\crisis\setup\03-create-db.sql

-- 关键:LOCALE_PROVIDER builtin 是 PG17 的新能力,可用 C.UTF-8
-- 必须基于 template0,否则报 locale 与操作系统不兼容
CREATE DATABASE crisis
  ENCODING 'UTF8'
  LOCALE_PROVIDER 'builtin' BUILTIN_LOCALE 'C.UTF-8'
  TEMPLATE template0;

\connect crisis

CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS pg_trgm;      -- 多语言标题模糊匹配
CREATE EXTENSION IF NOT EXISTS btree_gin;

SELECT PostGIS_Full_Version();
