/**
 * 多功能组合关键字：空格=且，OR/|=或，-排除，"短语"，
 * 字段 类型:/国家:/来源:/类别:/标题:/震级:/严重:
 * 省/市地名按坐标落点匹配（事件只有国家码时也能搜「河南」）。
 */
import { pointMatchesPlaceToken } from "./region-gazetteer.js";

const FIELD_ALIASES = {
  类型: "type",
  type: "type",
  t: "type",
  国家: "country",
  地区: "country",
  城市: "country",
  city: "country",
  country: "country",
  c: "country",
  来源: "source",
  源: "source",
  source: "source",
  s: "source",
  类别: "cat",
  分类: "cat",
  category: "cat",
  cat: "cat",
  标题: "headline",
  headline: "headline",
  h: "headline",
  震级: "mag",
  mag: "mag",
  m: "mag",
  严重: "sev",
  sev: "sev",
  severity: "sev",
};

function tokenize(raw) {
  const out = [];
  const re = /"([^"]+)"|(\S+)/g;
  let m;
  while ((m = re.exec(raw))) {
    if (m[1] != null) out.push({ quoted: true, text: m[1] });
    else out.push({ quoted: false, text: m[2] });
  }
  return out;
}

function resolveField(name) {
  if (!name) return null;
  return FIELD_ALIASES[name] || FIELD_ALIASES[name.toLowerCase()] || null;
}

export function parseSearchQuery(raw) {
  const text = String(raw || "").trim();
  if (!text) return null;
  const groups = [[]];
  for (const tok of tokenize(text)) {
    if (!tok.quoted && /^(OR|\|)$/i.test(tok.text)) {
      if (groups[groups.length - 1].length) groups.push([]);
      continue;
    }
    let body = tok.text;
    let negate = false;
    if (!tok.quoted && body.startsWith("-") && body.length > 1) {
      negate = true;
      body = body.slice(1);
    }
    let field = null;
    let value = body;
    const fm = body.match(/^([\u4e00-\u9fffA-Za-z]+)\s*[=:：]\s*(.+)$/);
    if (fm) {
      const mapped = resolveField(fm[1]);
      if (mapped) {
        field = mapped;
        value = fm[2];
      }
    }
    groups[groups.length - 1].push({
      field,
      value: String(value).trim().toLowerCase(),
      negate,
    });
  }
  const cleaned = groups.filter((g) => g.length && g.every((t) => t.value));
  return cleaned.length ? cleaned : null;
}

function matchNumeric(n, spec) {
  if (!Number.isFinite(n)) return false;
  const m = String(spec).match(/^(>=|<=|>|<|=)?\s*([+-]?[\d.]+)$/);
  if (!m) return String(n).toLowerCase().includes(String(spec));
  const op = m[1] || "=";
  const v = Number(m[2]);
  if (!Number.isFinite(v)) return false;
  if (op === ">") return n > v;
  if (op === ">=") return n >= v;
  if (op === "<") return n < v;
  if (op === "<=") return n <= v;
  return Math.abs(n - v) < 0.051;
}

function fieldText(rec, field) {
  if (!field) return rec.blob || "";
  if (field === "type") return rec.type || "";
  if (field === "country") return rec.country || "";
  if (field === "source") return rec.source || "";
  if (field === "cat") return rec.cat || "";
  if (field === "headline") return rec.headline || "";
  return rec.blob || "";
}

function matchTerm(rec, term) {
  let hit;
  if (term.field === "mag") hit = matchNumeric(rec.mag, term.value);
  else if (term.field === "sev") hit = matchNumeric(rec.sev, term.value);
  else {
    hit = fieldText(rec, term.field).includes(term.value);
    const allowPlace = !term.field || term.field === "country";
    if (!hit && allowPlace) {
      hit = pointMatchesPlaceToken(Number(rec.lon), Number(rec.lat), term.value);
    }
  }
  return term.negate ? !hit : hit;
}

export function matchSearchRecord(rec, parsed) {
  if (!parsed || !parsed.length) return true;
  return parsed.some((andGroup) => andGroup.every((term) => matchTerm(rec, term)));
}
