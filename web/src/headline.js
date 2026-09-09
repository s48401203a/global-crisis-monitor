/** 英文标题 → 中文展示：地名词表翻译、方位/警报词表、事件标题。 */
import { countryLabel, typeLabel } from "./grade.js";
import { getLang } from "./i18n/index.js";

const PLACE_ZH = {
  // 国家/地区
  indonesia: "印度尼西亚",
  china: "中国",
  japan: "日本",
  philippines: "菲律宾",
  "united states": "美国",
  usa: "美国",
  "u.s.": "美国",
  russia: "俄罗斯",
  chile: "智利",
  peru: "秘鲁",
  mexico: "墨西哥",
  canada: "加拿大",
  turkey: "土耳其",
  türkiye: "土耳其",
  greece: "希腊",
  italy: "意大利",
  iran: "伊朗",
  pakistan: "巴基斯坦",
  india: "印度",
  afghanistan: "阿富汗",
  taiwan: "台湾",
  "papua new guinea": "巴布亚新几内亚",
  "new zealand": "新西兰",
  australia: "澳大利亚",
  fiji: "斐济",
  tonga: "汤加",
  vanuatu: "瓦努阿图",
  "solomon islands": "所罗门群岛",
  alaska: "阿拉斯加",
  hawaii: "夏威夷",
  "puerto rico": "波多黎各",
  venezuela: "委内瑞拉",
  colombia: "哥伦比亚",
  ecuador: "厄瓜多尔",
  argentina: "阿根廷",
  bolivia: "玻利维亚",
  guatemala: "危地马拉",
  nicaragua: "尼加拉瓜",
  "costa rica": "哥斯达黎加",
  iceland: "冰岛",
  portugal: "葡萄牙",
  spain: "西班牙",
  france: "法国",
  germany: "德国",
  romania: "罗马尼亚",
  algeria: "阿尔及利亚",
  morocco: "摩洛哥",
  ethiopia: "埃塞俄比亚",
  kenya: "肯尼亚",
  "south africa": "南非",
  myanmar: "缅甸",
  thailand: "泰国",
  vietnam: "越南",
  "viet nam": "越南",
  laos: "老挝",
  cambodia: "柬埔寨",
  malaysia: "马来西亚",
  "south korea": "韩国",
  "north korea": "朝鲜",
  mongolia: "蒙古",
  nepal: "尼泊尔",
  bangladesh: "孟加拉国",
  "sri lanka": "斯里兰卡",
  "saudi arabia": "沙特阿拉伯",
  yemen: "也门",
  syria: "叙利亚",
  iraq: "伊拉克",
  ukraine: "乌克兰",
  poland: "波兰",
  norway: "挪威",
  sweden: "瑞典",
  "united kingdom": "英国",
  uk: "英国",
  brazil: "巴西",
  cuba: "古巴",
  haiti: "海地",
  jamaica: "牙买加",
  "dominican republic": "多米尼加",
  panama: "巴拿马",
  "el salvador": "萨尔瓦多",
  honduras: "洪都拉斯",
  // 美国州
  ca: "加州",
  california: "加州",
  ak: "阿拉斯加州",
  hi: "夏威夷州",
  nv: "内华达州",
  or: "俄勒冈州",
  wa: "华盛顿州",
  tx: "得克萨斯州",
  ok: "俄克拉荷马州",
  mt: "蒙大拿州",
  id: "爱达荷州",
  ut: "犹他州",
  az: "亚利桑那州",
  nm: "新墨西哥州",
  co: "科罗拉多州",
  wy: "怀俄明州",
  ny: "纽约州",
  pr: "波多黎各",
  nc: "北卡罗来纳州",
  sc: "南卡罗来纳州",
  fl: "佛罗里达州",
  mo: "密苏里州",
  ar: "阿肯色州",
  tn: "田纳西州",
  // 常见海域/区域词
  sea: "海",
  region: "地区",
  island: "岛",
  islands: "群岛",
  coast: "沿岸",
  ridge: "海岭",
  trench: "海沟",
  valley: "谷",
  bay: "湾",
  strait: "海峡",
  peninsula: "半岛",
  lake: "湖",
  eastern: "东部",
  western: "西部",
  northern: "北部",
  southern: "南部",
  central: "中部",
  near: "附近",
  off: "近海",
  offshore: "近海",
  the: "",
  of: "",
  // 常见地名（印尼等）
  ceram: "塞兰",
  flores: "弗洛勒斯",
  sumba: "松巴",
  java: "爪哇",
  sumatra: "苏门答腊",
  sulawesi: "苏拉威西",
  bali: "巴厘",
  lombok: "龙目",
  molucca: "马鲁古",
  banda: "班达",
  timor: "帝汶",
  halmahera: "哈马黑拉",
  minahasa: "米纳哈萨",
  sunda: "巽他",
  mentawai: "明打威",
  sichuan: "四川",
  yunnan: "云南",
  xinjiang: "新疆",
  tibet: "西藏",
  qinghai: "青海",
  gansu: "甘肃",
  "taiwan region": "台湾地区",
  honshu: "本州",
  hokkaido: "北海道",
  kyushu: "九州",
  shikoku: "四国",
  okinawa: "冲绳",
  kuril: "千岛",
  aleutian: "阿留申",
  "the geysers": "盖瑟斯",
  idyllwild: "艾德尔怀尔德",
  "san francisco": "旧金山",
  "los angeles": "洛杉矶",
  tokyo: "东京",
  manila: "马尼拉",
  jakarta: "雅加达",
  "mexico city": "墨西哥城",
  "south of": "以南",
  "north of": "以北",
  "east of": "以东",
  "west of": "以西",
  "southeast of": "东南方向",
  "southwest of": "西南方向",
  "northeast of": "东北方向",
  "northwest of": "西北方向",
  "near the coast of": "沿岸附近",
  "near east coast of": "东海岸附近",
  "near west coast of": "西海岸附近",
};

const DIR_ZH = {
  N: "正北",
  S: "正南",
  E: "正东",
  W: "正西",
  NE: "东北",
  NW: "西北",
  SE: "东南",
  SW: "西南",
  NNE: "北北东",
  ENE: "东北东",
  ESE: "东南东",
  SSE: "南南东",
  SSW: "南南西",
  WSW: "西南西",
  WNW: "西北西",
  NNW: "北北西",
};

const ALERT_ZH = {
  green: "绿色",
  yellow: "黄色",
  orange: "橙色",
  red: "红色",
  Green: "绿色",
  Yellow: "黄色",
  Orange: "橙色",
  Red: "红色",
};

function translatePlaceToken(token) {
  const t = token.trim();
  if (!t) return "";
  const low = t.toLowerCase();
  if (PLACE_ZH[low] !== undefined) return PLACE_ZH[low];
  // 全大写多词区域名：逐词译
  if (/^[A-Z][A-Z\s\-']+$/.test(t) || /^[A-Z0-9\s,\-'.]+$/.test(t)) {
    const words = t.replace(/,/g, " , ").split(/\s+/).filter(Boolean);
    const parts = words
      .map((w) => {
        if (w === ",") return "，";
        const lw = w.toLowerCase().replace(/^\(|\)$/g, "");
        if (PLACE_ZH[lw] !== undefined) return PLACE_ZH[lw];
        // 保留专有名：首字母大写转可读，未知则音译占位保留原文小写词
        if (/^[A-Z]+$/.test(w) && w.length > 1) {
          return PLACE_ZH[w.toLowerCase()] || titleCaseWord(w);
        }
        return PLACE_ZH[lw] || w;
      })
      .filter((x) => x !== "");
    return parts
      .join("")
      .replace(/\s*，\s*/g, "，")
      .replace(/\s+/g, " ")
      .trim();
  }
  return t;
}

function titleCaseWord(w) {
  const low = w.toLowerCase();
  return PLACE_ZH[low] || w.charAt(0) + w.slice(1).toLowerCase();
}

function translatePlacePhrase(s) {
  if (!s) return "";
  let t = s.trim();
  // 先替换长短语
  const phrases = Object.keys(PLACE_ZH).sort((a, b) => b.length - a.length);
  let low = t.toLowerCase();
  for (const p of phrases) {
    if (p.length < 3) continue;
    if (low.includes(p)) {
      const re = new RegExp(p.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "ig");
      t = t.replace(re, PLACE_ZH[p]);
      low = t.toLowerCase();
    }
  }
  // 剩余全大写片段
  t = t.replace(/[A-Z][A-Z][A-Z\s\-']*[A-Z]/g, (m) => translatePlaceToken(m.trim()) || m);
  return t
    .replace(/\s+/g, " ")
    .replace(/\s*,\s*/g, "，")
    .trim();
}

/**
 * 将数据源英文标题转为中文展示文案
 * @param {object} p 事件 properties
 */
function chineseHeadline(p) {
  const raw = (p.headline || "").trim();
  const typ = typeLabel(p.type);
  if (!raw) {
    const c = p.country ? `（${countryLabel(p.country)}）` : "";
    return `${typ}${c}`;
  }

  // 已是中文则直接返回
  if (/[\u4e00-\u9fff]/.test(raw) && !/[A-Za-z]{4,}/.test(raw)) return raw;

  let s = raw;

  // GDACS 类: "Orange M 6.3 Earthquake in China at: ..."
  let m = s.match(
    /^(Green|Yellow|Orange|Red)\s+M\s*([\d.]+)\s+Earthquake\s+in\s+(.+?)\s+at:\s*(.+)$/i,
  );
  if (m) {
    const alert = ALERT_ZH[m[1]] || m[1];
    const place = translatePlacePhrase(m[3]);
    return `${alert}预警 · M${m[2]} ${typ} · ${place}`;
  }
  m = s.match(
    /^(Green|Yellow|Orange|Red)\s+(Tropical Cyclone|Earthquake|Forest fires?|Eruption|Flood|Drought)\s+(.+)$/i,
  );
  if (m) {
    const alert = ALERT_ZH[m[1]] || m[1];
    const rest = translatePlacePhrase(m[3].replace(/\s+from:.*$/i, "").replace(/\s+at:.*$/i, ""));
    return `${alert}预警 · ${typ} · ${rest}`;
  }

  // USGS: "2 km ESE of The Geysers, CA"
  m = s.match(/^([\d.]+)\s*km\s+([A-Z]{1,3})\s+of\s+(.+)$/i);
  if (m) {
    const dir = DIR_ZH[m[2].toUpperCase()] || m[2];
    let place = m[3].trim();
    // 末尾州代码
    const sm = place.match(/^(.*?),\s*([A-Z]{2})$/);
    if (sm) {
      const city = translatePlacePhrase(sm[1]);
      const st = PLACE_ZH[sm[2].toLowerCase()] || sm[2];
      place = `${st}${city}`;
    } else {
      place = translatePlacePhrase(place);
    }
    return `${place}${dir}约 ${m[1]} 公里 · ${typ}`;
  }

  // "XX km N of Y"
  m = s.match(
    /^([\d.]+)\s*km\s+(north|south|east|west|northeast|northwest|southeast|southwest)\s+of\s+(.+)$/i,
  );
  if (m) {
    const dirMap = {
      north: "正北",
      south: "正南",
      east: "正东",
      west: "正西",
      northeast: "东北",
      northwest: "西北",
      southeast: "东南",
      southwest: "西南",
    };
    const place = translatePlacePhrase(m[3]);
    return `${place}${dirMap[m[2].toLowerCase()] || m[2]}约 ${m[1]} 公里 · ${typ}`;
  }

  // EMSC 全大写: "CERAM SEA, INDONESIA" / "EASTERN SICHUAN, CHINA"
  if (/^[A-Z0-9\s,.\-']+$/.test(s) && s.length > 2) {
    const parts = s.split(",").map((x) => translatePlaceToken(x.trim()));
    const place = parts.filter(Boolean).join("，");
    return `${place} · ${typ}`;
  }

  // "Wildfire NAME, County, State"
  m = s.match(/^Wildfire\s+(.+)$/i);
  if (m) {
    return `野火 · ${translatePlacePhrase(m[1])}`;
  }
  m = s.match(/^Incident Complex\s+(.+)$/i);
  if (m) {
    return `火灾复合体 · ${translatePlacePhrase(m[1])}`;
  }
  m = s.match(/^Tropical Storm\s+(.+)$/i);
  if (m) {
    return `热带风暴 ${m[1]}`;
  }
  m = s.match(/^Hurricane\s+(.+)$/i);
  if (m) {
    return `飓风 ${m[1]}`;
  }

  // 通用：国家名、方向短语替换 + 后缀类型
  let out = translatePlacePhrase(s);
  // 清理残留英文杂讯（短词保留）
  out = out
    .replace(/\bM\s*([\d.]+)\b/g, "M$1")
    .replace(/\bearthquake\b/gi, "地震")
    .replace(/\bwildfire\b/gi, "野火")
    .replace(/\bflood\b/gi, "洪水")
    .replace(/\bvolcano\b|\beruption\b/gi, "火山")
    .replace(/\bdrought\b/gi, "干旱")
    .replace(/\bcyclone\b|\btyphoon\b|\bhurricane\b/gi, "气旋")
    .replace(/\bforest fires?\b/gi, "森林火灾")
    .replace(/\bat:\s*/gi, "· ")
    .replace(/\bfrom:\s*/gi, "自 ")
    .replace(/\bto:\s*/gi, "至 ")
    .replace(/\s+/g, " ")
    .trim();

  // 若仍几乎全是英文，降级为「类型 · 国家」
  const latinRatio = out.replace(/[^A-Za-z]/g, "").length / Math.max(out.length, 1);
  if (latinRatio > 0.55) {
    const ctry = p.country ? PLACE_ZH[String(p.country).toLowerCase()] || p.country : "";
    const mag =
      p.magnitude != null && p.magnitude !== "" && p.magnitude !== "null" ? ` M${p.magnitude}` : "";
    return ctry ? `${ctry}${mag} · ${typ}` : `${typ}${mag} · ${out.slice(0, 40)}`;
  }

  // 标题里还没有类型字样时补上
  if (!/地震|野火|洪水|暴雨|预警|火山|干旱|气旋|台风|冲突|危机/.test(out)) {
    out = `${out} · ${typ}`;
  }
  return out;
}

/**
 * 列表/弹窗标题：中文界面做汉化；英文界面保留原文（或类型+国家）
 */
function eventHeadline(p) {
  if (getLang() === "en") {
    const raw = (p.headline || "").trim();
    if (raw) return raw;
    const c = p.country ? ` (${countryLabel(p.country)})` : "";
    return `${typeLabel(p.type)}${c}`;
  }
  return chineseHeadline(p);
}

export { eventHeadline, chineseHeadline, translatePlacePhrase, translatePlaceToken };
