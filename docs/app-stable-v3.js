
const DATA_URL = "data/all_matches.csv";
const RATINGS_URL = "data/current_ratings.csv";
const HISTORY_LEDGER_URL = "data/historical_ledger_2017_2024.csv";
const RATING_EVENTS_URL = "data/rating_events.csv";
const RATING_SCHOOL_EVENTS_URL = "data/rating_school_events.csv";
let allMatches = [];
let ledgerMatches = [];
let currentStats = new Map();
let serverRatings = [];
let schoolMaster = new Map();
let selectedSchools = new Set();
let ratingEvents = [];
let ratingSchoolEvents = [];
const LINEAGE_STORAGE_KEY = "hsbbl_school_lineage_v1";
const LOCAL_AREAS_STORAGE_KEY = "hsbbl_local_areas_v1";
const REP_AREAS_STORAGE_KEY = "hsbbl_rep_areas_v1";
let schoolLineage = [];
let rankingPage = 1;
let ledgerPage = 1;
let masterPage = 1;
let ratingEventMap = new Map();
let ledgerUiSetupDone = false;
let masterUiSetupDone = false;
let serverRatingMap = new Map();
let schoolEventMap = new Map();

let localAreas = [
  {prefecture:"北海道",local_area_id:"HKD-01",local_area_name:"札幌",active:true},
  {prefecture:"青森",local_area_id:"AOM-01",local_area_name:"八戸",active:true},
  {prefecture:"愛知",local_area_id:"AIC-01",local_area_name:"名古屋",active:true},
  {prefecture:"静岡",local_area_id:"SIZ-01",local_area_name:"東部",active:true},
  {prefecture:"石川",local_area_id:"ISK-01",local_area_name:"能登",active:true}
];
let repAreas = [
  {rep_area_id:"HKD-N",prefecture:"北海道",rep_area_name:"北北海道",area_type:"regular_split"},
  {rep_area_id:"HKD-S",prefecture:"北海道",rep_area_name:"南北海道",area_type:"regular_split"},
  {rep_area_id:"TKY-E",prefecture:"東京",rep_area_name:"東東京",area_type:"regular_split"},
  {rep_area_id:"TKY-W",prefecture:"東京",rep_area_name:"西東京",area_type:"regular_split"},
  {rep_area_id:"STM-E",prefecture:"埼玉",rep_area_name:"東埼玉",area_type:"commemorative_split"},
  {rep_area_id:"STM-W",prefecture:"埼玉",rep_area_name:"西埼玉",area_type:"commemorative_split"},
  {rep_area_id:"CHB-E",prefecture:"千葉",rep_area_name:"東千葉",area_type:"commemorative_split"},
  {rep_area_id:"CHB-W",prefecture:"千葉",rep_area_name:"西千葉",area_type:"commemorative_split"},
  {rep_area_id:"KNG-N",prefecture:"神奈川",rep_area_name:"北神奈川",area_type:"commemorative_split"},
  {rep_area_id:"KNG-S",prefecture:"神奈川",rep_area_name:"南神奈川",area_type:"commemorative_split"},
  {rep_area_id:"AIC-E",prefecture:"愛知",rep_area_name:"東愛知",area_type:"commemorative_split"},
  {rep_area_id:"AIC-W",prefecture:"愛知",rep_area_name:"西愛知",area_type:"commemorative_split"},
  {rep_area_id:"OSK-N",prefecture:"大阪",rep_area_name:"北大阪",area_type:"commemorative_split"},
  {rep_area_id:"OSK-S",prefecture:"大阪",rep_area_name:"南大阪",area_type:"commemorative_split"},
  {rep_area_id:"FUK-N",prefecture:"福岡",rep_area_name:"北福岡",area_type:"commemorative_split"},
  {rep_area_id:"FUK-S",prefecture:"福岡",rep_area_name:"南福岡",area_type:"commemorative_split"}
];

const MASTER_DISTRICTS = ["北海道","東北","関東・東京","東海","北信越","近畿","中国","四国","九州","不明"];
const MASTER_PREFECTURES = ["北海道","青森","岩手","宮城","秋田","山形","福島","茨城","栃木","群馬","埼玉","千葉","東京","神奈川","新潟","富山","石川","福井","山梨","長野","岐阜","静岡","愛知","三重","滋賀","京都","大阪","兵庫","奈良","和歌山","鳥取","島根","岡山","広島","山口","徳島","香川","愛媛","高知","福岡","佐賀","長崎","熊本","大分","宮崎","鹿児島","沖縄","北北海道","南北海道","東東京","西東京","不明"];
let masterIndexKind = "region";

const MASTER_STORAGE_KEY = "hsbbl_school_master_v3";

const REGION_CODE = {
  "北海道":"01","東北":"02","関東・東京":"03","東海":"04",
  "北信越":"05","近畿":"06","中国":"07","四国":"08","九州":"09","不明":"00"
};

const PREF_CODE = {
  "北海道":"01","青森":"02","岩手":"03","宮城":"04","秋田":"05","山形":"06","福島":"07",
  "茨城":"08","栃木":"09","群馬":"10","埼玉":"11","千葉":"12","東京":"13","神奈川":"14","新潟":"15",
  "富山":"16","石川":"17","福井":"18","山梨":"19","長野":"20","岐阜":"21","静岡":"22","愛知":"23",
  "三重":"24","滋賀":"25","京都":"26","大阪":"27","兵庫":"28","奈良":"29","和歌山":"30","鳥取":"31",
  "島根":"32","岡山":"33","広島":"34","山口":"35","徳島":"36","香川":"37","愛媛":"38","高知":"39",
  "福岡":"40","佐賀":"41","長崎":"42","熊本":"43","大分":"44","宮崎":"45","鹿児島":"46","沖縄":"47",
  "北北海道":"01","南北海道":"01","東東京":"13","西東京":"13"
};

const DISTRICT_COLORS = {
  "北海道":"#5B8FF9",
  "東北":"#61DDAA",
  "関東・東京":"#65789B",
  "北信越":"#F6BD16",
  "東海":"#7262FD",
  "近畿":"#78D3F8",
  "中国":"#9661BC",
  "四国":"#F6903D",
  "九州":"#E8684A",
  "不明":"#B8BDC5"
};

const REGION_LABEL = {
  hokkaido:"北海道",
  tohoku:"東北",
  kanto_tokyo:"関東・東京",
  kanto:"関東・東京",
  hokushinetsu:"北信越",
  tokai:"東海",
  kinki:"近畿",
  chugoku:"中国",
  shikoku:"四国",
  kyushu:"九州",
  national:"全国"
};

const LEVEL_WEIGHT = {
  branch: 0.65,
  district_qualifier: 0.65,
  first_qualifier: 0.65,
  qualifier_league: 0.60,
  repechage: 0.60,
  prefecture: 0.90,
  regional: 1.15,
  national: 1.35
};

function csvParse(text){
  const rows = [];
  let row = [], field = "", quoted = false;
  for(let i=0;i<text.length;i++){
    const c = text[i];
    if(quoted){
      if(c === '"' && text[i+1] === '"'){ field += '"'; i++; }
      else if(c === '"'){ quoted = false; }
      else field += c;
    }else{
      if(c === '"') quoted = true;
      else if(c === ","){ row.push(field); field = ""; }
      else if(c === "\n"){
        row.push(field); rows.push(row); row=[]; field="";
      }else if(c !== "\r") field += c;
    }
  }
  if(field.length || row.length){ row.push(field); rows.push(row); }
  if(!rows.length) return [];
  const head = rows[0].map(x=>x.replace(/^\uFEFF/,""));
  return rows.slice(1)
    .filter(r=>r.some(x=>x.trim()!==""))
    .map(r=>Object.fromEntries(head.map((h,i)=>[h,r[i] ?? ""])));
}

function getLevel(note){
  const m = String(note||"").match(/(?:^|;)level=([^;]+)/);
  return m ? m[1] : "";
}

function noteValue(note,key){
  const m = String(note||"").match(new RegExp(`(?:^|;)${key}=([^;]+)`));
  return m ? m[1] : "";
}

function normalizeRows(rows){
  return rows.map((r,idx)=>({
    ...r,
    _id:idx,
    year:String(r.year||"").trim(),
    season:String(r.season||"").trim(),
    region:String(r.region||"").trim(),
    prefecture:String(r.prefecture||"").trim(),
    sub_area:String(r.sub_area||noteValue(r.note,"local_district")||noteValue(r.note,"branch")||noteValue(r.note,"sub_area")||"").trim(),
    date:String(r.date||"").trim(),
    team1:String(r.team1||"").trim(),
    team2:String(r.team2||"").trim(),
    team1_prefecture:String(r.team1_prefecture||noteValue(r.note,"team1_pref")||"").trim(),
    team2_prefecture:String(r.team2_prefecture||noteValue(r.note,"team2_pref")||"").trim(),
    source_ref:String(r.source_ref||"").trim(),
    source_status:String(r.source_status||"").trim(),
    score1:Number(r.score1),
    score2:Number(r.score2),
    level:getLevel(r.note)
  })).filter(r=>r.team1 && r.team2 && Number.isFinite(r.score1) && Number.isFinite(r.score2));
}

function uniq(arr){
  return [...new Set(arr.filter(Boolean))].sort((a,b)=>String(a).localeCompare(String(b),"ja"));
}

function fillSelect(id, vals){
  const el = document.getElementById(id);
  const first = el.options[0].outerHTML;
  el.innerHTML = first + vals.map(v=>`<option value="${esc(v)}">${esc(v)}</option>`).join("");
}

function esc(s){
  return String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));
}

function selected(id){ return document.getElementById(id).value; }

function specialPrefecture(r){
  const t = `${r.tournament||""} ${r.note||""}`;
  if(r.prefecture==="北海道"){
    if(t.includes("北北海道")) return "北北海道";
    if(t.includes("南北海道")) return "南北海道";
  }
  if(r.prefecture==="東京"){
    if(t.includes("東東京")) return "東東京";
    if(t.includes("西東京")) return "西東京";
  }
  return r.prefecture || "";
}

function buildSchoolMeta(rows){
  const meta = new Map();

  function scorePref(pref){
    if(["北北海道","南北海道","東東京","西東京"].includes(pref)) return 4;
    if(pref) return 2;
    return 0;
  }

  function offer(team, row){
    if(!team) return;
    const district = REGION_LABEL[row.region] && REGION_LABEL[row.region] !== "全国"
      ? REGION_LABEL[row.region]
      : "";
    const pref = specialPrefecture(row);
    const cur = meta.get(team) || {district:"", prefecture:"", score:-1};

    const s = scorePref(pref);
    if(s > cur.score){
      meta.set(team,{
        district: district || cur.district,
        prefecture: pref || cur.prefecture,
        score:s
      });
    }else if(!cur.district && district){
      cur.district = district;
      meta.set(team,cur);
    }
  }

  rows.forEach(r=>{
    offer(r.team1,r);
    offer(r.team2,r);
  });

  return meta;
}

function districtForSchool(team, meta){
  const x = meta.get(team);
  return x?.district || "不明";
}

function prefForSchool(team, meta){
  const x = meta.get(team);
  return x?.prefecture || "不明";
}

function stableShortHash(s){
  let h=2166136261;
  for(let i=0;i<s.length;i++){
    h ^= s.charCodeAt(i);
    h = Math.imul(h,16777619);
  }
  return (h>>>0).toString(16).toUpperCase().padStart(8,"0").slice(-4);
}

function provisionalSchoolId(team, district, pref, localDistrict="00"){
  const rc = REGION_CODE[district] || "00";
  const pc = PREF_CODE[pref] || "00";
  const lc = String(localDistrict||"00").replace(/\D/g,"").padStart(2,"0").slice(-2);
  return `${rc}${pc}${lc}${stableShortHash(team)}`;
}

function loadMasterFromStorage(){
  try{
    const raw = localStorage.getItem(MASTER_STORAGE_KEY);
    if(!raw) return new Map();
    const arr = JSON.parse(raw);
    return new Map(arr.map(x=>[
      x.canonical_name,
      {
        furigana:"",
        local_district:"",
        local_district_id:"",
        representative_area_id:"",
        representative_area:x.prefecture||"",
        aliases:[x.canonical_name],
        status:"active",
        established_year:"",
        closed_year:"",
        successor_id:"",
        ...x
      }
    ]));
  }catch(e){
    return new Map();
  }
}

function saveMasterToStorage(){
  localStorage.setItem(MASTER_STORAGE_KEY, JSON.stringify([...schoolMaster.values()]));
}

function loadLineage(){
  try{
    schoolLineage = JSON.parse(localStorage.getItem(LINEAGE_STORAGE_KEY) || "[]");
    if(!Array.isArray(schoolLineage)) schoolLineage = [];
  }catch(e){ schoolLineage = []; }
}
function saveLineage(){
  localStorage.setItem(LINEAGE_STORAGE_KEY, JSON.stringify(schoolLineage));
}

function loadAreaMasters(){
  try{
    const a = JSON.parse(localStorage.getItem(LOCAL_AREAS_STORAGE_KEY)||"null");
    if(Array.isArray(a)) localAreas = a;
  }catch(e){}
  try{
    const r = JSON.parse(localStorage.getItem(REP_AREAS_STORAGE_KEY)||"null");
    if(Array.isArray(r)) repAreas = r;
  }catch(e){}
}
function saveAreaMasters(){
  localStorage.setItem(LOCAL_AREAS_STORAGE_KEY, JSON.stringify(localAreas));
  localStorage.setItem(REP_AREAS_STORAGE_KEY, JSON.stringify(repAreas));
}
function localAreaName(pref, id, fallback=""){
  const hit = localAreas.find(x=>x.prefecture===pref && x.local_area_id===id);
  return hit?.local_area_name || fallback || id || "";
}
function repAreaName(id, fallback=""){
  const hit = repAreas.find(x=>x.rep_area_id===id);
  return hit?.rep_area_name || fallback || id || "";
}
function addLineageEvent(event){
  schoolLineage.push({
    id:`L${Date.now()}${Math.random().toString(16).slice(2,6)}`,
    created_at:new Date().toISOString(),
    ...event
  });
  saveLineage();
}
function lineageForSchool(schoolId){
  return schoolLineage
    .filter(x=>x.school_id===schoolId || x.related_school_id===schoolId)
    .sort((a,b)=>String(a.event_year||"").localeCompare(String(b.event_year||"")) || String(a.created_at||"").localeCompare(String(b.created_at||"")));
}

function initSchoolMaster(){
  const detected = buildSchoolMeta(allMatches);
  const saved = loadMasterFromStorage();
  const names = uniq(allMatches.flatMap(r=>[r.team1,r.team2]));

  schoolMaster = new Map();

  // まず保存済みの canonical レコードをそのまま復元する。
  // 統合元の名前は aliases に残るため、raw match names から再生成しない。
  for(const item of saved.values()){
    schoolMaster.set(item.canonical_name, {
      furigana:"",
      local_district:"",
      representative_area:item.prefecture||"",
      aliases:[item.canonical_name],
      ...item,
      aliases:uniq([item.canonical_name, ...(item.aliases||[])])
    });
  }

  // 保存済み canonical / alias の全名称を索引化。
  const claimedNames = new Set();
  for(const item of schoolMaster.values()){
    claimedNames.add(item.canonical_name);
    for(const alias of (item.aliases||[])) claimedNames.add(alias);
  }

  // 未登録の raw school name だけ新規学校として追加する。
  names.forEach(name=>{
    if(claimedNames.has(name)) return;

    const m = detected.get(name) || {};
    const district = m.district || "不明";
    const pref = m.prefecture || "不明";

    schoolMaster.set(name, {
      school_id: provisionalSchoolId(name,district,pref,"00"),
      canonical_name:name,
      furigana:"",
      district,
      prefecture:pref,
      local_district:"",
      local_district_id:"",
      representative_area:pref,
      representative_area_id:"",
      aliases:[name],
      status:"active",
      established_year:"",
      closed_year:"",
      successor_id:""
    });
  });
}

function resolveCanonicalName(raw){
  for(const item of schoolMaster.values()){
    if(item.canonical_name===raw) return item.canonical_name;
    if((item.aliases||[]).includes(raw)) return item.canonical_name;
  }
  return raw;
}

function schoolRecord(name){
  const canonical = resolveCanonicalName(name);
  return schoolMaster.get(canonical) || null;
}

function filteredMatches(){
  const y = selected("yearFilter");
  const season = selected("seasonFilter");
  const region = selected("regionFilter");
  const pref = selected("prefFilter");
  const level = selected("levelFilter");

  return allMatches.filter(r=>{
    if(y!=="all" && r.year!==y) return false;
    if(season!=="all" && r.season!==season) return false;
    if(region!=="all" && r.region!==region) return false;
    if(pref!=="all" && r.prefecture!==pref) return false;
    if(level!=="all" && r.level!==level) return false;
    return true;
  });
}

function calcRatings(matches){
  const stats = new Map();

  function ensure(team){
    if(!stats.has(team)){
      stats.set(team,{
        team, rating:1500, games:0,wins:0,losses:0,draws:0,
        pf:0,pa:0, history:[]
      });
    }
    return stats.get(team);
  }

  const sorted = [...matches].sort((a,b)=>{
    const d=(a.date||"").localeCompare(b.date||"");
    return d || a._id-b._id;
  });

  for(const m of sorted){
    const t1 = resolveCanonicalName(m.team1);
    const t2 = resolveCanonicalName(m.team2);
    const a = ensure(t1), b = ensure(t2);
    const ea = 1/(1+Math.pow(10,(b.rating-a.rating)/400));
    const eb = 1-ea;
    let sa=.5,sb=.5;
    if(m.score1>m.score2){sa=1;sb=0;}
    else if(m.score2>m.score1){sa=0;sb=1;}

    const weight = LEVEL_WEIGHT[m.level] ?? .90;
    const k = 24 * weight;

    a.rating += k*(sa-ea);
    b.rating += k*(sb-eb);

    a.games++; b.games++;
    a.pf += m.score1; a.pa += m.score2;
    b.pf += m.score2; b.pa += m.score1;

    if(sa===1){a.wins++;b.losses++;}
    else if(sb===1){b.wins++;a.losses++;}
    else {a.draws++;b.draws++;}

    a.history.push({date:m.date,rating:a.rating,opponent:b.team,for:m.score1,against:m.score2,round:m.round,level:m.level});
    b.history.push({date:m.date,rating:b.rating,opponent:a.team,for:m.score2,against:m.score1,round:m.round,level:m.level});
  }

  return stats;
}

function hasLocalSchoolMerges(){
  return [...schoolMaster.values()].some(x => (x.aliases||[]).length > 1);
}

function render(){
  const matches = filteredMatches();
  const schoolMeta = buildSchoolMeta(allMatches);

  const hasScopeFilter =
    selected("yearFilter")!=="all" ||
    selected("seasonFilter")!=="all" ||
    selected("regionFilter")!=="all" ||
    selected("prefFilter")!=="all" ||
    selected("levelFilter")!=="all";

  if(!hasScopeFilter && serverRatings.length && !hasLocalSchoolMerges()){
    currentStats = new Map(serverRatings.map(r=>[
      r.school,
      {
        team:r.school,
        rating:Number(r.rating),
        games:Number(r.games),
        wins:Number(r.wins),
        losses:Number(r.losses),
        draws:Number(r.draws),
        pf:Number(r.runs_for),
        pa:Number(r.runs_against),
        history:[],
        serverPref:r.prefecture||"",
        serverRegion:r.region||"",
        historyPrior:Number(r.history_prior||0)
      }
    ]));
    document.getElementById("ratingMode").textContent = "正式Rating v1";
  }else{
    currentStats = calcRatings(matches);
    const mode = document.getElementById("ratingMode");
    if(mode){
      mode.textContent = hasLocalSchoolMerges() && !hasScopeFilter
        ? "統合反映中（ブラウザ再計算）"
        : "フィルタ内Elo";
    }
  }

  const q = document.getElementById("schoolSearch").value.trim().toLowerCase();

  let list = [...currentStats.values()]
    .filter(s=>!q || s.team.toLowerCase().includes(q))
    .sort((a,b)=>b.rating-a.rating || b.games-a.games || a.team.localeCompare(b.team,"ja"));

  const rankingPageSize = Number(document.getElementById("rankingPageSize")?.value || 100);
  const rankingTotalPages = Math.max(1, Math.ceil(list.length / rankingPageSize));
  rankingPage = Math.min(Math.max(1, rankingPage), rankingTotalPages);
  const rankingStart = (rankingPage - 1) * rankingPageSize;
  const rankingRows = list.slice(rankingStart, rankingStart + rankingPageSize);

  const rankingInfo = document.getElementById("rankingPageInfo");
  if(rankingInfo) rankingInfo.textContent = `${rankingPage} / ${rankingTotalPages}（${list.length.toLocaleString()}校）`;
  const rankingPrev = document.getElementById("rankingPrev");
  const rankingNext = document.getElementById("rankingNext");
  if(rankingPrev) rankingPrev.disabled = rankingPage <= 1;
  if(rankingNext) rankingNext.disabled = rankingPage >= rankingTotalPages;

  document.getElementById("matchCount").textContent = matches.length.toLocaleString();
  document.getElementById("schoolCount").textContent = currentStats.size.toLocaleString();
  document.getElementById("latestDate").textContent =
    matches.map(x=>x.date).filter(Boolean).sort().at(-1) || "-";

  const tbody = document.querySelector("#rankingTable tbody");
  tbody.innerHTML = rankingRows.map((s,i)=>{
    const pct = s.games ? (s.wins/s.games*100).toFixed(1)+"%" : "-";
    const diff=s.pf-s.pa;
    const rec = schoolRecord(s.team);
    const district = rec?.district || s.serverRegion || districtForSchool(s.team, schoolMeta);
    const pref = rec?.prefecture || s.serverPref || prefForSchool(s.team, schoolMeta);
    const sid = rec?.school_id || provisionalSchoolId(s.team,district,pref,"00");
    const color = DISTRICT_COLORS[district] || DISTRICT_COLORS["不明"];
    return `<tr>
      <td class="rank">${rankingStart+i+1}</td>
      <td><span class="id-badge">${esc(sid)}</span></td>
      <td><button class="school-link" data-team="${esc(s.team)}">${esc(s.team)}</button></td>
      <td><span class="region-chip"><span class="region-dot" style="background:${color}"></span>${esc(district)}</span></td>
      <td class="pref-label">${esc(pref)}</td>
      <td class="rating">${Math.round(s.rating)}</td>
      <td>${s.games}</td>
      <td>${s.wins}</td>
      <td>${s.losses}</td>
      <td>${pct}</td>
      <td class="${diff>0?"pos":diff<0?"neg":""}">${diff>0?"+":""}${diff}</td>
    </tr>`;
  }).join("");

  tbody.querySelectorAll(".school-link").forEach(btn=>{
    btn.addEventListener("click",()=>showDetail(btn.dataset.team));
  });

  renderLedger();
}

function showDetail(team){
  const s = currentStats.get(team);
  if(!s) return;

  const meta = buildSchoolMeta(allMatches);
  const rec = schoolRecord(team);
  const district = rec?.district || districtForSchool(team, meta);
  const pref = rec?.prefecture || prefForSchool(team, meta);
  const sid = rec?.school_id || provisionalSchoolId(team,district,pref,"00");
  const color = DISTRICT_COLORS[district] || DISTRICT_COLORS["不明"];

  const panel = document.getElementById("detailPanel");
  const diff=s.pf-s.pa;
  const recent=[...s.history].slice(-8).reverse();

  panel.innerHTML = `
    <div class="school-title">
      <div>
        <h3>${esc(s.team)}</h3>
        <div class="school-title-affiliation">
          <span class="school-region-bar" style="background:${color}"></span>
          <span>${esc(district)} / ${esc(pref)}</span>
        </div>
        <div class="school-meta"><span class="id-badge">${esc(sid)}</span>　${serverRatings.length && s.history.length===0 ? `正式Rating v1 / 歴史prior ${s.historyPrior>=0?"+":""}${(s.historyPrior||0).toFixed(1)}` : "現在のフィルタ条件内で計算"}</div>
      </div>
      <div class="big">${Math.round(s.rating)}</div>
    </div>

    <div class="mini-grid">
      <div class="mini"><span>試合</span><strong>${s.games}</strong></div>
      <div class="mini"><span>勝敗</span><strong>${s.wins}-${s.losses}${s.draws?`-${s.draws}`:""}</strong></div>
      <div class="mini"><span>得失点</span><strong class="${diff>0?"pos":diff<0?"neg":""}">${diff>0?"+":""}${diff}</strong></div>
    </div>

    <div class="chart-wrap">
      <div class="chart-title">Rating推移</div>
      ${sparkline(s.history)}
    </div>

    <div class="matches">
      <h4>直近試合</h4>
      ${recent.map(m=>`
        <div class="match">
          <div class="date">${esc(m.date)}</div>
          <div>${esc(m.opponent)}</div>
          <div class="score">${m.for}-${m.against}</div>
        </div>
      `).join("") || "<p>試合なし</p>"}
    </div>
  `;
}

function sparkline(history){
  if(!history.length) return `<svg viewBox="0 0 320 150"></svg>`;
  const vals = history.map(x=>x.rating);
  const min=Math.min(...vals,1480), max=Math.max(...vals,1520);
  const span=Math.max(1,max-min);
  const w=320,h=150,p=18;
  const pts=vals.map((v,i)=>{
    const x=p+(w-2*p)*(history.length===1?0.5:i/(history.length-1));
    const y=h-p-(h-2*p)*(v-min)/span;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");
  return `<svg viewBox="0 0 320 150" preserveAspectRatio="none">
    <line x1="0" x2="320" y1="75" y2="75" stroke="#e5e7eb" stroke-width="1"/>
    <polyline points="${pts}" fill="none" stroke="#17191c" stroke-width="2.2" vector-effect="non-scaling-stroke"/>
  </svg>`;
}


function seasonLabel(s){
  return ({
    spring:"春",summer:"夏",autumn:"秋",
    senbatsu:"選抜",koshien:"夏甲子園",jingu:"神宮"
  })[s] || s || "";
}

function levelLabel(l){
  return ({
    branch:"支部",
    district_qualifier:"地区予選",
    first_qualifier:"一次予選",
    qualifier_league:"予選リーグ",
    repechage:"敗者復活",
    prefecture:"県大会",
    regional:"地区大会",
    national:"全国大会"
  })[l] || l || "";
}


function eventMatchKey(r){
  return [
    r.year||"",r.season||"",r.date||"",r.tournament||"",r.round||"",
    r.team1||"",String(r.score1),r.team2||"",String(r.score2)
  ].join("|");
}
function ratingEventForMatch(r){
  return ratingEventMap.get(eventMatchKey(r)) || null;
}
function serverRatingForSchool(name){
  const canonical = resolveCanonicalName(name);
  if(serverRatingMap.has(canonical)) return serverRatingMap.get(canonical);
  const rec = schoolMaster.get(canonical);
  for(const alias of (rec?.aliases||[])){
    if(serverRatingMap.has(alias)) return serverRatingMap.get(alias);
  }
  return null;
}
function schoolEventsFor(name){
  const canonical = resolveCanonicalName(name);
  const rec = schoolMaster.get(canonical);
  const aliases = new Set([canonical, ...(rec?.aliases||[])]);
  const merged = [];
  const seen = new Set();
  for(const alias of aliases){
    for(const e of (schoolEventMap.get(alias)||[])){
      const k = `${e.match_key}|${e.school}|${e.raw_team}`;
      if(!seen.has(k)){ seen.add(k); merged.push(e); }
    }
  }
  return merged.sort((a,b)=>(a.date||"").localeCompare(b.date||"") || (a.match_key||"").localeCompare(b.match_key||""));
}
function fmtR(v){
  const n=Number(v);
  return Number.isFinite(n) ? n.toFixed(1) : "-";
}
function fmtDelta(v){
  const n=Number(v);
  if(!Number.isFinite(n)) return "-";
  return `${n>=0?"+":""}${n.toFixed(2)}`;
}
function buildFastIndexes(){
  ratingEventMap = new Map();
  for(const e of ratingEvents){
    if(e.match_key) ratingEventMap.set(e.match_key,e);
  }

  serverRatingMap = new Map();
  for(const r of serverRatings){
    const n = Number(r.rating);
    if(r.school && Number.isFinite(n)) serverRatingMap.set(r.school,n);
  }

  schoolEventMap = new Map();
  for(const e of ratingSchoolEvents){
    for(const key of [e.school,e.raw_team]){
      if(!key) continue;
      if(!schoolEventMap.has(key)) schoolEventMap.set(key,[]);
      schoolEventMap.get(key).push(e);
    }
  }
}

function debounce(fn, wait=180){
  let t;
  return (...args)=>{
    clearTimeout(t);
    t=setTimeout(()=>fn(...args),wait);
  };
}

function ledgerScope(level){
  if(level==="national") return "national";
  if(level==="regional") return "regional";
  if(level==="prefecture") return "prefecture";
  if(["branch","district_qualifier","first_qualifier","qualifier_league","repechage","preliminary"].includes(level)) return "subpref";
  return "";
}

function ledgerPrefValues(r){
  return uniq([
    specialPrefecture(r),
    r.prefecture,
    r.team1_prefecture,
    r.team2_prefecture
  ]);
}

function sourceKind(r){
  if(String(r.source_url||"").trim()) return "web";
  if(String(r.source_ref||"").trim() || String(r.source_status||"").includes("元帳")) return "ledger";
  return "missing";
}

function filteredLedgerMatches(){
  const year = selected("ledgerYear");
  const season = selected("ledgerSeason");
  const scope = selected("ledgerScope");
  const region = selected("ledgerRegion");
  const pref = selected("ledgerPref");
  const sub = selected("ledgerSubArea");
  const source = selected("ledgerSource");
  const school = document.getElementById("ledgerSchool").value.trim().toLowerCase();

  const sourceRows = ledgerMatches.length ? ledgerMatches : allMatches;
  return sourceRows.filter(r=>{
    if(year!=="all" && r.year!==year) return false;
    if(season!=="all" && r.season!==season) return false;
    if(scope!=="all" && ledgerScope(r.level)!==scope) return false;
    if(region!=="all" && r.region!==region) return false;
    if(pref!=="all" && !ledgerPrefValues(r).includes(pref)) return false;
    if(sub!=="all" && r.sub_area!==sub) return false;
    if(source!=="all" && sourceKind(r)!==source) return false;
    if(school){
      const a = resolveCanonicalName(r.team1).toLowerCase();
      const b = resolveCanonicalName(r.team2).toLowerCase();
      const ra = String(r.team1||"").toLowerCase();
      const rb = String(r.team2||"").toLowerCase();
      if(!a.includes(school) && !b.includes(school) && !ra.includes(school) && !rb.includes(school)) return false;
    }
    return true;
  });
}

function sortLedgerRows(rows){
  const mode = selected("ledgerSort");
  return [...rows].sort((a,b)=>{
    if(mode==="year_asc"){
      return Number(a.year)-Number(b.year) || (a.date||"").localeCompare(b.date||"") || a._id-b._id;
    }
    if(mode==="date_desc"){
      return (b.date||"0000").localeCompare(a.date||"0000") || Number(b.year)-Number(a.year) || b._id-a._id;
    }
    if(mode==="school"){
      const aa = resolveCanonicalName(a.team1);
      const bb = resolveCanonicalName(b.team1);
      return aa.localeCompare(bb,"ja") || Number(b.year)-Number(a.year);
    }
    return Number(b.year)-Number(a.year) || (b.date||"").localeCompare(a.date||"") || b._id-a._id;
  });
}

function renderLedger(){
  const tbody = document.querySelector("#ledgerTable tbody");
  if(!tbody) return;
  const filtered = filteredLedgerMatches();
  const allRows = sortLedgerRows(filtered);
  document.getElementById("ledgerCount").textContent = `${allRows.length.toLocaleString()}試合`;

  const pageSize = Number(document.getElementById("ledgerPageSize")?.value || 100);
  const totalPages = Math.max(1,Math.ceil(allRows.length/pageSize));
  ledgerPage = Math.min(Math.max(1,ledgerPage),totalPages);
  const start = (ledgerPage-1)*pageSize;
  const rows = allRows.slice(start,start+pageSize);

  const pageInfo = document.getElementById("ledgerPageInfo");
  if(pageInfo) pageInfo.textContent = `${ledgerPage} / ${totalPages}`;
  const prev = document.getElementById("ledgerPrev");
  const next = document.getElementById("ledgerNext");
  if(prev) prev.disabled = ledgerPage<=1;
  if(next) next.disabled = ledgerPage>=totalPages;

  const webCount = filtered.filter(r=>sourceKind(r)==="web").length;
  const ledgerCount = filtered.filter(r=>sourceKind(r)==="ledger").length;
  const missingCount = filtered.filter(r=>sourceKind(r)==="missing").length;
  document.getElementById("ledgerSourceSummary").innerHTML = `
    <span class="source-stat source-web">Web URLあり ${webCount.toLocaleString()}</span>
    <span class="source-stat source-ledger">元帳あり・URL未登録 ${ledgerCount.toLocaleString()}</span>
    <span class="source-stat source-missing">未登録 ${missingCount.toLocaleString()}</span>
  `;

  tbody.innerHTML = rows.map(r=>{
    const ev = ratingEventForMatch(r);
    const district = REGION_LABEL[r.region] || r.region || "";
    const prefs = ledgerPrefValues(r).join(" / ");
    const url = String(r.source_url||"").trim();
    const ref = String(r.source_ref||"").trim();
    let source = '<span class="source-missing-text">未登録</span>';
    if(url){
      source = `<a class="source-link" href="${esc(url)}" target="_blank" rel="noopener">Web</a>`;
    }else if(ref){
      source = `<span class="source-ref" title="${esc(r.source_status||"")}">${esc(ref)}</span>`;
    }
    return `<tr>
      <td>${esc(r.year)}</td>
      <td>${esc(seasonLabel(r.season))}</td>
      <td>${esc(levelLabel(r.level))}</td>
      <td>${esc(district)}</td>
      <td>${esc(prefs)}</td>
      <td>${esc(r.sub_area||"")}</td>
      <td>${esc(r.date||"")}</td>
      <td>${esc(r.tournament||"")}</td>
      <td>${esc(r.round||"")}</td>
      <td>${esc(resolveCanonicalName(r.team1))}${resolveCanonicalName(r.team1)!==r.team1?`<div class="school-meta">元表記: ${esc(r.team1)}</div>`:""}</td>
      <td>${r.score1}</td>
      <td>${esc(resolveCanonicalName(r.team2))}${resolveCanonicalName(r.team2)!==r.team2?`<div class="school-meta">元表記: ${esc(r.team2)}</div>`:""}</td>
      <td>${r.score2}</td>
      <td>${ev ? `${fmtR(ev.team1_rating_before)}<div class="school-meta">${fmtR(ev.team2_rating_before)}</div>` : "-"}</td>
      <td>${ev ? `${(Number(ev.team1_expected)*100).toFixed(1)}%<div class="school-meta">${(Number(ev.team2_expected)*100).toFixed(1)}%</div>` : "-"}</td>
      <td>${ev ? `<span class="${Number(ev.team1_delta)>=0?"rating-up":"rating-down"}">${fmtDelta(ev.team1_delta)}</span><div class="school-meta ${Number(ev.team2_delta)>=0?"rating-up":"rating-down"}">${fmtDelta(ev.team2_delta)}</div>` : "-"}</td>
      <td>${ev ? `${fmtR(ev.team1_rating_after)}<div class="school-meta">${fmtR(ev.team2_rating_after)}</div>` : "-"}</td>
      <td>${source}</td>
    </tr>`;
  }).join("");
}

function setupLedgerUi(){
  if(ledgerUiSetupDone) return;
  ledgerUiSetupDone = true;
  fillSelect("ledgerYear", uniq(ledgerMatches.map(x=>x.year)).sort((a,b)=>Number(b)-Number(a)));
  fillSelect("ledgerRegion", uniq(ledgerMatches.map(x=>x.region)));
  fillSelect("ledgerPref", uniq(ledgerMatches.flatMap(ledgerPrefValues)));
  fillSelect("ledgerSubArea", uniq(ledgerMatches.map(x=>x.sub_area)));

  ["ledgerYear","ledgerSeason","ledgerScope","ledgerRegion","ledgerPref","ledgerSubArea","ledgerSource","ledgerSort"]
    .forEach(id=>document.getElementById(id)?.addEventListener("change",()=>{ledgerPage=1;renderLedger();}));
  document.getElementById("ledgerSchool")?.addEventListener("input",debounce(()=>{ledgerPage=1;renderLedger();},180));
  document.getElementById("ledgerPrev")?.addEventListener("click",()=>{ if(ledgerPage>1){ledgerPage--;renderLedger();} });
  document.getElementById("ledgerNext")?.addEventListener("click",()=>{ ledgerPage++;renderLedger(); });
  document.getElementById("ledgerPageSize")?.addEventListener("change",()=>{ledgerPage=1;renderLedger();});

  document.getElementById("ledgerReset")?.addEventListener("click",()=>{
    ["ledgerYear","ledgerSeason","ledgerScope","ledgerRegion","ledgerPref","ledgerSubArea","ledgerSource"]
      .forEach(id=>document.getElementById(id).value="all");
    document.getElementById("ledgerSort").value="year_desc";
    document.getElementById("ledgerSchool").value="";
    ledgerPage=1;
    renderLedger();
  });
}

function setupTabs(){
  document.querySelectorAll(".view-tab").forEach(btn=>{
    btn.addEventListener("click",()=>{
      document.querySelectorAll(".view-tab").forEach(x=>x.classList.remove("active"));
      btn.classList.add("active");
      const view = btn.dataset.view;
      document.getElementById("rankingView").classList.toggle("hidden", view!=="ranking");
      document.getElementById("ledgerView").classList.toggle("hidden", view!=="ledger");
      document.getElementById("masterView").classList.toggle("hidden", view!=="master");
      try{
        if(view==="master") renderMasterTable();
        if(view==="ledger"){
          if(!ledgerMatches.length){
            const count=document.getElementById("ledgerCount");
            if(count) count.textContent="補助台帳を読込中…";
          }
          renderLedger();
        }
      }catch(err){
        console.error(`view render failed: ${view}`,err);
        document.getElementById("status").innerHTML =
          `表示エラー: ${esc(err.message||String(err))} <small class="build-tag">UI-FREEZE-FIX-2</small>`;
      }
    });
  });
}



function idParts(x){
  const id = String(x?.school_id || "").padEnd(10,"0");
  return {
    region_id:id.slice(0,2),
    pref_id:id.slice(2,4),
    local_id:id.slice(4,6),
    school_code:id.slice(6)
  };
}

function masterSortKey(x, mode){
  const p = idParts(x);
  const rating = serverRatingForSchool(x.canonical_name);
  if(mode==="region_pref_local") return `${x.district||"~~~~"}|${x.prefecture||"~~~~"}|${x.local_district||"~~~~"}|${x.furigana||x.canonical_name}`;
  if(mode==="district") return `${x.district||"~~~~"}|${x.prefecture||"~~~~"}|${x.local_district||"~~~~"}|${x.furigana||x.canonical_name}`;
  if(mode==="prefecture") return `${x.prefecture||"~~~~"}|${x.local_district||"~~~~"}|${x.furigana||x.canonical_name}`;
  if(mode==="local_name") return `${x.district||"~~~~"}|${x.prefecture||"~~~~"}|${x.local_district||"~~~~"}|${x.furigana||x.canonical_name}`;
  if(mode==="rating_desc") return `${String(99999-(rating??-9999)).padStart(10,"0")}|${x.canonical_name}`;
  if(mode==="status") return `${x.status||"active"}|${x.prefecture||""}|${x.canonical_name}`;
  if(mode==="region_id") return `${p.region_id}|${p.pref_id}|${p.local_id}|${x.furigana||x.canonical_name}`;
  if(mode==="pref_id") return `${p.pref_id}|${p.region_id}|${p.local_id}|${x.furigana||x.canonical_name}`;
  if(mode==="local_id") return `${p.region_id}|${p.pref_id}|${p.local_id}|${x.furigana||x.canonical_name}`;
  if(mode==="furigana") return `${x.furigana||"~~~~"}|${x.canonical_name}`;
  if(mode==="name") return x.canonical_name;
  return `${x.school_id}|${x.canonical_name}`;
}

function renderMasterIndex(rows){
  const wrap = document.getElementById("indexChips");
  if(!wrap) return;

  const counts = new Map();
  rows.forEach(x=>{
    const p = idParts(x);
    const key = masterIndexKind==="pref" ? p.pref_id : p.region_id;
    counts.set(key,(counts.get(key)||0)+1);
  });

  wrap.innerHTML = [...counts.entries()]
    .sort((a,b)=>a[0].localeCompare(b[0],"ja",{numeric:true}))
    .map(([id,count])=>`<button type="button" class="index-chip" data-index-id="${esc(id)}">${esc(id)} <span>${count}</span></button>`)
    .join("");

  wrap.querySelectorAll(".index-chip").forEach(btn=>{
    btn.addEventListener("click",()=>{
      const id = btn.dataset.indexId;
      const target = document.querySelector(`[data-${masterIndexKind}-anchor="${CSS.escape(id)}"]`);
      if(target) target.scrollIntoView({behavior:"smooth",block:"start"});
    });
  });
}

function updateBulkMergeBar(){
  const bar = document.getElementById("bulkMergeBar");
  const count = document.getElementById("selectedSchoolCount");
  if(!bar || !count) return;
  count.textContent = selectedSchools.size;
  bar.classList.toggle("hidden", selectedSchools.size < 1);
  const btn = document.getElementById("openBulkMergeBtn");
  if(btn){
    btn.disabled = selectedSchools.size < 2;
    btn.textContent = selectedSchools.size < 2 ? "あと1校選択" : "選択校を統合";
  }
}

function setSelected(name, checked){
  if(checked) selectedSchools.add(name);
  else selectedSchools.delete(name);
  updateBulkMergeBar();
}

function uniqueMatchesForNames(names){
  const aliases = new Set();
  names.forEach(name=>{
    const rec = schoolMaster.get(name);
    aliases.add(name);
    (rec?.aliases||[]).forEach(a=>aliases.add(a));
  });
  return allMatches.filter(r=>aliases.has(r.team1) || aliases.has(r.team2));
}

function buildBulkMergePreview(names, destination){
  const records = names.map(n=>schoolMaster.get(n)).filter(Boolean);
  const allRows = [];
  const seen = new Set();
  const duplicateKeys = new Set();
  const conflictMap = new Map();
  let scoreConflicts = 0;

  records.forEach(rec=>{
    matchesForSchoolName(rec.canonical_name).forEach(r=>{
      const exact = normalizedMatchKey(r);
      if(seen.has(exact)) duplicateKeys.add(exact);
      else{
        seen.add(exact);
        allRows.push(r);
      }

      const ck = scoreConflictKey(r);
      const score = `${r.score1}-${r.score2}`;
      if(conflictMap.has(ck) && conflictMap.get(ck)!==score) scoreConflicts++;
      else conflictMap.set(ck,score);
    });
  });

  const districts = new Set(records.map(r=>r.district).filter(Boolean));
  const prefs = new Set(records.map(r=>r.prefecture).filter(Boolean));

  return {
    records,
    destination:schoolMaster.get(destination),
    mergedMatchCount:allRows.length,
    duplicateCount:duplicateKeys.size,
    scoreConflicts,
    districtConflict:districts.size>1,
    prefConflict:prefs.size>1
  };
}

function openBulkMergeModal(){
  const names = [...selectedSchools].filter(n=>schoolMaster.has(n));
  if(names.length < 2) return;

  const modal = document.getElementById("bulkMergeModal");
  const body = document.getElementById("bulkMergeModalBody");
  modal.classList.remove("hidden");

  const render = (destination)=>{
    const p = buildBulkMergePreview(names,destination);

    body.innerHTML = `
      <div class="bulk-destination">
        <label>統合先（残す学校ID）</label>
        <select id="bulkDestinationSelect">
          ${names.map(n=>{
            const r=schoolMaster.get(n);
            return `<option value="${esc(n)}" ${n===destination?"selected":""}>${esc(r.school_id)} / ${esc(r.canonical_name)} / ${esc(r.prefecture||"")}</option>`;
          }).join("")}
        </select>
      </div>

      <div class="bulk-grid">
        ${p.records.map(r=>`
          <div class="bulk-card">
            <div class="bulk-card-head">
              <strong>${esc(r.canonical_name)}</strong>
              <small>${esc(r.school_id)} / ${esc(r.district||"")} / ${esc(r.prefecture||"")}</small>
            </div>
            ${renderMergeHistory(r.canonical_name)}
          </div>
        `).join("")}
      </div>

      <div class="bulk-summary">
        <h4 style="margin:0 0 10px">統合プレビュー</h4>
        <div class="check-grid">
          <div class="check-item"><span>統合後の試合数</span><strong>${p.mergedMatchCount}</strong></div>
          <div class="check-item"><span>完全重複試合</span><strong class="${p.duplicateCount?"warn":"okay"}">${p.duplicateCount}</strong></div>
          <div class="check-item"><span>スコア差異</span><strong class="${p.scoreConflicts?"warn":"okay"}">${p.scoreConflicts}</strong></div>
          <div class="check-item"><span>地区不一致</span><strong class="${p.districtConflict?"warn":"okay"}">${p.districtConflict?"あり":"なし"}</strong></div>
          <div class="check-item"><span>県不一致</span><strong class="${p.prefConflict?"warn":"okay"}">${p.prefConflict?"あり":"なし"}</strong></div>
          <div class="check-item"><span>統合ID数</span><strong>${p.records.length}</strong></div>
        </div>
      </div>

      <div class="bulk-final-actions">
        <button type="button" class="merge-cancel" id="bulkCancelBtn">キャンセル</button>
        <button type="button" class="merge-confirm" id="bulkConfirmBtn">この内容で統合</button>
      </div>
    `;

    document.getElementById("bulkDestinationSelect").addEventListener("change",e=>render(e.target.value));
    document.getElementById("bulkCancelBtn").addEventListener("click",closeBulkMergeModal);
    document.getElementById("bulkConfirmBtn").addEventListener("click",()=>{
      performBulkMerge(names,destination);
    });
  };

  render(names[0]);
}

function closeBulkMergeModal(){
  document.getElementById("bulkMergeModal")?.classList.add("hidden");
}

function performBulkMerge(names,destinationName){
  const dest = schoolMaster.get(destinationName);
  if(!dest) return;

  const sources = names
    .filter(n=>n!==destinationName)
    .map(n=>schoolMaster.get(n))
    .filter(Boolean);

  if(!confirm(`${sources.length}個のIDを「${dest.canonical_name}」へ統合します。`)) return;

  sources.forEach(src=>{
    addLineageEvent({
      school_id:dest.school_id,
      event_year:"",
      event_type:"dedupe",
      old_name:src.canonical_name,
      new_name:dest.canonical_name,
      related_school_id:src.school_id,
      status_after:dest.status||"active",
      note:"同一校の重複ID名寄せ。実際の学校統合ではない"
    });
    dest.aliases = uniq(
      (dest.aliases||[])
        .concat(src.aliases||[])
        .concat([src.canonical_name])
    );
    if(!dest.furigana && src.furigana) dest.furigana = src.furigana;
    if(!dest.local_district && src.local_district) dest.local_district = src.local_district;
    schoolMaster.delete(src.canonical_name);
  });

  schoolMaster.set(dest.canonical_name,dest);
  selectedSchools.clear();
  saveMasterToStorage();

  closeBulkMergeModal();
  renderMasterTable();
  render();
  showMasterEditor(dest.canonical_name);
  updateBulkMergeBar();
}


const PREFECTURE_ROW_COLORS = {"北海道": "#f8f3d8", "青森": "#d8ebf8", "岩手": "#e1eef9", "宮城": "#d8e6f8", "秋田": "#e1eaf9", "山形": "#d8e2f8", "福島": "#e1e7f9", "茨城": "#d8f8dd", "栃木": "#e1f9e6", "群馬": "#d8f8e0", "埼玉": "#e1f9e8", "千葉": "#d8f8e4", "東京": "#e1f9eb", "神奈川": "#d8f8e7", "新潟": "#e5d8f8", "富山": "#ede1f9", "石川": "#ebd8f8", "福井": "#f1e1f9", "長野": "#f0d8f8", "岐阜": "#f8e2d8", "静岡": "#f9ebe1", "愛知": "#f8e9d8", "三重": "#f9f0e1", "滋賀": "#f8d8e0", "京都": "#f9e1e5", "大阪": "#f8d8dc", "兵庫": "#f9e1e2", "奈良": "#f8d9d8", "和歌山": "#f9e3e1", "鳥取": "#d8f8f3", "島根": "#e1f9f8", "岡山": "#d8f7f8", "広島": "#e1f6f9", "山口": "#d8f1f8", "徳島": "#ecf8d8", "香川": "#eef9e1", "愛媛": "#e5f8d8", "高知": "#e8f9e1", "福岡": "#f8d8f2", "佐賀": "#f9e1f4", "長崎": "#f8d8ef", "熊本": "#f9e1f2", "大分": "#f8d8ed", "宮崎": "#f9e1ef", "鹿児島": "#f8d8ea", "沖縄": "#f9e1ed", "北北海道": "#f8eece", "南北海道": "#f9f8d7", "東東京": "#d4f7db", "西東京": "#d9f7e8"};
const PREFECTURE_ROW_ACCENTS = {"北海道": "#cab52b", "青森": "#2b88ca", "岩手": "#2b7dca", "宮城": "#2b72ca", "秋田": "#2b68ca", "山形": "#2b5dca", "福島": "#2b53ca", "茨城": "#2bca40", "栃木": "#2bca49", "群馬": "#2bca52", "埼玉": "#2bca5b", "千葉": "#2bca63", "東京": "#2bca6c", "神奈川": "#2bca75", "新潟": "#6d2bca", "富山": "#7a2bca", "石川": "#882bca", "福井": "#952bca", "長野": "#a22bca", "岐阜": "#ca5b2b", "静岡": "#ca6c2b", "愛知": "#ca7e2b", "三重": "#ca902b", "滋賀": "#ca2b53", "京都": "#ca2b48", "大阪": "#ca2b3d", "兵庫": "#ca2b33", "奈良": "#ca2d2b", "和歌山": "#ca382b", "鳥取": "#2bcab5", "島根": "#2bcac2", "岡山": "#2bc5ca", "広島": "#2bb7ca", "山口": "#2baaca", "徳島": "#90ca2b", "香川": "#7eca2b", "愛媛": "#6cca2b", "高知": "#5bca2b", "福岡": "#ca2baf", "佐賀": "#ca2ba8", "長崎": "#ca2ba0", "熊本": "#ca2b99", "大分": "#ca2b91", "宮崎": "#ca2b8a", "鹿児島": "#ca2b82", "沖縄": "#ca2b7a", "北北海道": "#bc9924", "南北海道": "#c2bc29", "東東京": "#28b845", "西東京": "#2db470"};

function schoolColorKey(x){
  // 北海道・東京は、その学校に代表区分が設定されていれば
  // 北/南、東/西を別色で表示する。
  const rep = String(x.representative_area||"").trim();
  if(["北北海道","南北海道","東東京","西東京"].includes(rep)) return rep;
  return String(x.prefecture||"").trim();
}

function schoolRowColor(x){
  const key = schoolColorKey(x);
  return {
    bg: PREFECTURE_ROW_COLORS[key] || "#ffffff",
    accent: PREFECTURE_ROW_ACCENTS[key] || "#c8ccd2"
  };
}

function renderMasterTable(){
  const q = (document.getElementById("masterSearch")?.value || "").trim().toLowerCase();
  const districtFilter = document.getElementById("masterDistrictFilter")?.value || "all";
  const prefFilter = document.getElementById("masterPrefFilter")?.value || "all";
  const localFilter = document.getElementById("masterLocalFilter")?.value || "all";
  const statusFilter = document.getElementById("masterStatusFilter")?.value || "all";

  const rows = [...schoolMaster.values()]
    .filter(x=>{
      if(districtFilter!=="all" && (x.district||"")!==districtFilter) return false;
      if(prefFilter!=="all" && (x.prefecture||"")!==prefFilter) return false;
      if(localFilter!=="all" && (x.local_district||"")!==localFilter) return false;
      if(statusFilter!=="all" && (x.status||"active")!==statusFilter) return false;
      const hay = [
        x.school_id,x.canonical_name,x.furigana,x.district,x.prefecture,x.local_district,
        x.status,x.successor_id,
        ...(x.aliases||[])
      ].join(" ").toLowerCase();
      return !q || hay.includes(q);
    })
    .sort((a,b)=>{
      const mode = document.getElementById("masterSort")?.value || "school_id";
      return masterSortKey(a,mode).localeCompare(masterSortKey(b,mode),"ja",{numeric:true});
    });

  const masterPageSize = Number(document.getElementById("masterPageSize")?.value || 100);
  const masterTotalPages = Math.max(1, Math.ceil(rows.length / masterPageSize));
  masterPage = Math.min(Math.max(1, masterPage), masterTotalPages);
  const masterStart = (masterPage - 1) * masterPageSize;
  const pagedRows = rows.slice(masterStart, masterStart + masterPageSize);

  const masterInfo = document.getElementById("masterPageInfo");
  if(masterInfo) masterInfo.textContent = `${masterPage} / ${masterTotalPages}（${rows.length.toLocaleString()}校）`;
  const masterPrev = document.getElementById("masterPrev");
  const masterNext = document.getElementById("masterNext");
  if(masterPrev) masterPrev.disabled = masterPage <= 1;
  if(masterNext) masterNext.disabled = masterPage >= masterTotalPages;

  const tbody = document.querySelector("#masterTable tbody");
  if(!tbody) return;
  tbody.innerHTML = pagedRows.map(x=>{
    const p=idParts(x);
    const rowColor = schoolRowColor(x);
    return `
    <tr data-name="${esc(x.canonical_name)}" class="master-anchor prefecture-school-row"
        data-color-key="${esc(schoolColorKey(x))}"
        style="--school-row-bg:${rowColor.bg};--school-row-accent:${rowColor.accent};">
      <td class="select-col"><input class="school-select" type="checkbox" data-select-name="${esc(x.canonical_name)}" ${selectedSchools.has(x.canonical_name)?"checked":""}></td>
      <td class="edit-col"><button type="button" class="row-edit-btn" data-edit-name="${esc(x.canonical_name)}">編集</button></td>
      <td><span class="id-badge">${esc(x.school_id)}</span></td>
      <td><strong>${esc(x.canonical_name)}</strong></td>
      <td>${esc(x.furigana||"")}</td>
      <td>${esc(x.district||"")}</td>
      <td>${esc(x.prefecture||"")}</td>
      <td>${esc(x.local_district||"")}</td>
      <td><span class="status-badge status-${esc(x.status||"active")}">${esc({active:"現存",closed:"廃校",merged:"統合",planned:"新設予定"}[x.status||"active"]||x.status)}</span></td>
      <td><button type="button" class="rating-history-btn" data-rating-name="${esc(x.canonical_name)}">${serverRatingForSchool(x.canonical_name)==null?"-":fmtR(serverRatingForSchool(x.canonical_name))}</button></td>
      <td>${(x.aliases||[]).length} / ${lineageForSchool(x.school_id).length}</td>
    </tr>
  `;
  }).join("");

  updateBulkMergeBar();

  tbody.querySelectorAll("tr").forEach(tr=>{
    tr.addEventListener("click",(e)=>{
      if(e.target.closest(".school-select") || e.target.closest(".row-edit-btn")) return;
      showMasterEditor(tr.dataset.name);
    });
  });

  tbody.querySelectorAll(".row-edit-btn").forEach(btn=>{
    btn.addEventListener("click",(e)=>{
      e.preventDefault();
      e.stopPropagation();
      showMasterEditor(btn.dataset.editName);
    });
  });

  tbody.querySelectorAll(".school-select").forEach(cb=>{
    cb.addEventListener("change",()=>setSelected(cb.dataset.selectName,cb.checked));
  });
  tbody.querySelectorAll(".rating-history-btn").forEach(btn=>{
    btn.addEventListener("click",(e)=>{
      e.preventDefault(); e.stopPropagation();
      showRatingHistory(btn.dataset.ratingName);
    });
  });
}


function matchesForSchoolName(name){
  const rec = schoolMaster.get(name);
  const aliases = new Set([name, ...((rec?.aliases)||[])]);
  return allMatches.filter(r=>aliases.has(r.team1) || aliases.has(r.team2));
}

function normalizedMatchKey(r){
  const a = [r.team1,r.team2].sort().join("||");
  return `${r.date}||${a}||${r.score1}-${r.score2}`;
}

function scoreConflictKey(r){
  const a = [r.team1,r.team2].sort().join("||");
  return `${r.date}||${a}`;
}

function renderMergeHistory(name){
  const rows = matchesForSchoolName(name)
    .sort((a,b)=>(b.date||"").localeCompare(a.date||"") || b._id-a._id);

  if(!rows.length){
    return `<div class="merge-history"><div class="merge-game"><div class="date">-</div><div>対戦履歴なし</div><div></div></div></div>`;
  }

  return `<div class="merge-history">` + rows.slice(0,80).map(r=>{
    const mine1 = (r.team1===name) || ((schoolMaster.get(name)?.aliases||[]).includes(r.team1));
    const opp = mine1 ? r.team2 : r.team1;
    const fs = mine1 ? r.score1 : r.score2;
    const ag = mine1 ? r.score2 : r.score1;
    return `<div class="merge-game">
      <div class="date">${esc(r.date)}</div>
      <div>${esc(opp)} <span style="color:#8a8f96">(${esc(r.tournament||"")})</span></div>
      <div><strong>${fs}-${ag}</strong></div>
    </div>`;
  }).join("") + `</div>`;
}

function buildMergePreview(targetName, sourceName){
  const target = schoolMaster.get(targetName);
  const source = schoolMaster.get(sourceName);
  if(!target || !source) return null;

  const tMatches = matchesForSchoolName(targetName);
  const sMatches = matchesForSchoolName(sourceName);

  const tKeys = new Set(tMatches.map(normalizedMatchKey));
  const duplicateCount = sMatches.filter(r=>tKeys.has(normalizedMatchKey(r))).length;

  const tConflict = new Map();
  tMatches.forEach(r=>tConflict.set(scoreConflictKey(r), `${r.score1}-${r.score2}`));
  let scoreConflictCount = 0;
  sMatches.forEach(r=>{
    const k = scoreConflictKey(r);
    if(tConflict.has(k) && tConflict.get(k)!==`${r.score1}-${r.score2}`){
      scoreConflictCount++;
    }
  });

  const districtConflict = target.district && source.district && target.district!==source.district;
  const prefConflict = target.prefecture && source.prefecture && target.prefecture!==source.prefecture;
  const mergedCount = tMatches.length + sMatches.length - duplicateCount;

  return {
    target, source, tMatches, sMatches,
    duplicateCount, scoreConflictCount,
    districtConflict, prefConflict, mergedCount
  };
}

function showMergePreview(targetName, sourceName){
  const p = buildMergePreview(targetName, sourceName);
  const area = document.getElementById("mergePreviewArea");
  if(!p || !area) return;

  area.classList.remove("hidden");
  area.innerHTML = `
    <div class="merge-summary">
      <div class="merge-card">
        <h5>統合先</h5>
        <div class="merge-meta">
          <span>ID</span><strong>${esc(p.target.school_id)}</strong>
          <span>表示名</span><strong>${esc(p.target.canonical_name)}</strong>
          <span>所属</span><strong>${esc(p.target.district||"")} / ${esc(p.target.prefecture||"")}</strong>
          <span>対戦数</span><strong>${p.tMatches.length}</strong>
        </div>
        ${renderMergeHistory(p.target.canonical_name)}
      </div>

      <div class="merge-card">
        <h5>統合元</h5>
        <div class="merge-meta">
          <span>ID</span><strong>${esc(p.source.school_id)}</strong>
          <span>表示名</span><strong>${esc(p.source.canonical_name)}</strong>
          <span>所属</span><strong>${esc(p.source.district||"")} / ${esc(p.source.prefecture||"")}</strong>
          <span>対戦数</span><strong>${p.sMatches.length}</strong>
        </div>
        ${renderMergeHistory(p.source.canonical_name)}
      </div>
    </div>

    <div class="merge-checks">
      <h5>統合後の整合性チェック</h5>
      <div class="check-grid">
        <div class="check-item">
          <span>統合後の試合数</span>
          <strong>${p.mergedCount}</strong>
        </div>
        <div class="check-item">
          <span>完全重複試合</span>
          <strong class="${p.duplicateCount ? "warn":"okay"}">${p.duplicateCount}</strong>
        </div>
        <div class="check-item">
          <span>同日同カード・スコア差異</span>
          <strong class="${p.scoreConflictCount ? "warn":"okay"}">${p.scoreConflictCount}</strong>
        </div>
        <div class="check-item">
          <span>地区の不一致</span>
          <strong class="${p.districtConflict ? "warn":"okay"}">${p.districtConflict ? "あり":"なし"}</strong>
        </div>
        <div class="check-item">
          <span>都道府県の不一致</span>
          <strong class="${p.prefConflict ? "warn":"okay"}">${p.prefConflict ? "あり":"なし"}</strong>
        </div>
        <div class="check-item">
          <span>統合元の別名</span>
          <strong>${(p.source.aliases||[]).length}</strong>
        </div>
      </div>

      <div class="merge-confirm-row">
        <button class="merge-cancel" id="cancelMergeBtn">キャンセル</button>
        <button class="merge-confirm" id="confirmMergeBtn">確認して統合する</button>
      </div>
    </div>
  `;

  document.getElementById("cancelMergeBtn").addEventListener("click",()=>{
    area.classList.add("hidden");
    area.innerHTML="";
  });

  document.getElementById("confirmMergeBtn").addEventListener("click",()=>{
    if(p.scoreConflictCount>0){
      const proceed = confirm(
        `同日同カードでスコアが異なる試合が ${p.scoreConflictCount} 件あります。\nそれでも統合しますか？`
      );
      if(!proceed) return;
    }

    p.target.aliases = uniq(
      (p.target.aliases||[])
        .concat(p.source.aliases||[])
        .concat([p.source.canonical_name,p.target.canonical_name])
    );

    if(!p.target.furigana && p.source.furigana) p.target.furigana = p.source.furigana;
    if(!p.target.local_district && p.source.local_district) p.target.local_district = p.source.local_district;

    schoolMaster.delete(p.source.canonical_name);
    schoolMaster.set(p.target.canonical_name,p.target);
    saveMasterToStorage();

    renderMasterTable();
    render();
    showMasterEditor(p.target.canonical_name);
  });
}


function openMasterEditorPopup(){
  const editor = document.getElementById("masterEditor");
  let backdrop = document.getElementById("masterEditorBackdrop");
  if(!backdrop){
    backdrop = document.createElement("div");
    backdrop.id = "masterEditorBackdrop";
    backdrop.className = "master-editor-backdrop";
    document.body.appendChild(backdrop);
    backdrop.addEventListener("click",closeMasterEditorPopup);
  }
  editor?.classList.add("popup-open");
  backdrop.classList.remove("hidden");
  document.body.classList.add("modal-lock");
}

function closeMasterEditorPopup(){
  const editor = document.getElementById("masterEditor");
  const backdrop = document.getElementById("masterEditorBackdrop");
  editor?.classList.remove("popup-open");
  backdrop?.classList.add("hidden");
  document.body.classList.remove("modal-lock");
}


function optionList(values,current){
  return values.map(v=>`<option value="${esc(v)}" ${v===current?"selected":""}>${esc(v)}</option>`).join("");
}

function showMasterEditor(name){
  const x = schoolMaster.get(name);
  if(!x) return;
  const editor = document.getElementById("masterEditor");

  editor.innerHTML = `
    <div class="school-title">
      <div>
        <h3>${esc(x.canonical_name)}</h3>
        <div class="school-meta">学校IDと表記揺れを編集</div>
      </div>
      <span class="id-badge">${esc(x.school_id)}</span>
      <button type="button" class="icon-btn mobile-editor-close" id="closeMasterEditorBtn" aria-label="閉じる">×</button>
    </div>

    <div class="master-form" style="margin-top:16px">
      <div class="field">
        <label>学校ID</label>
        <input id="editSchoolId" value="${esc(x.school_id)}">
      </div>
      <div class="field">
        <label>表示名</label>
        <input id="editCanonicalName" value="${esc(x.canonical_name)}">
      </div>
      <div class="field">
        <label>フリガナ</label>
        <input id="editFurigana" placeholder="例：アナンヒカリ" value="${esc(x.furigana||"")}">
      </div>
      <div class="field">
        <label>所属地区（9地区）</label>
        <select id="editDistrict">${optionList(MASTER_DISTRICTS,x.district||"不明")}</select>
      </div>
      <div class="field">
        <label>都道府県 / 南北・東西</label>
        <select id="editPref">${optionList(MASTER_PREFECTURES,x.prefecture||"不明")}</select>
      </div>
      <div class="field">
        <label>県内地区</label>
        <input id="editLocalDistrict" placeholder="例：名古屋" value="${esc(x.local_district||"")}">
      </div>
      <div class="field">
        <label>大会代表区分（表示名）</label>
        <input id="editRepArea" placeholder="例：西愛知" value="${esc(x.representative_area||repAreaName(x.representative_area_id,""))}">
      </div>
      <div class="field">
        <label>代表区分ID</label>
        <select id="editRepAreaId">
          <option value="">未設定</option>
          ${repAreas.filter(a=>a.prefecture===(x.prefecture||"")).map(a=>`<option value="${esc(a.rep_area_id)}" ${a.rep_area_id===(x.representative_area_id||"")?"selected":""}>${esc(a.rep_area_id)} / ${esc(a.rep_area_name)}</option>`).join("")}
        </select>
      </div>
      <div class="field">
        <label>学校状態</label>
        <select id="editStatus">
          ${optionList(["active","closed","merged","planned"],x.status||"active")}
        </select>
      </div>
      <div class="field">
        <label>新設/開校年</label>
        <input id="editEstablishedYear" inputmode="numeric" value="${esc(x.established_year||"")}">
      </div>
      <div class="field">
        <label>廃校/統合年</label>
        <input id="editClosedYear" inputmode="numeric" value="${esc(x.closed_year||"")}">
      </div>
      <div class="field">
        <label>後継学校ID</label>
        <input id="editSuccessorId" placeholder="統合・移行先ID" value="${esc(x.successor_id||"")}">
      </div>
      <div class="wide">
        <label>別名 / 表記揺れ（1行1名称）</label>
        <textarea id="editAliases">${esc((x.aliases||[]).join("\n"))}</textarea>
      </div>
      <div class="note">
        IDは現状「地区コード + 都道府県コード + 県内地区コード + 4桁仮コード」の試作です。
        県内地区マスタが整った段階で正式採番へ切り替えます。
      </div>

      <div class="merge-box">
        <h4>重複学校をこの学校へ統合</h4>
        <p>統合元の学校名を選ぶと、その学校の別名・試合・Ratingをこの学校IDへ集約します。</p>
        <div class="merge-row">
          <input id="mergeSourceName" list="mergeSchoolCandidates" placeholder="例：阿南光(徳島)">
          <datalist id="mergeSchoolCandidates"></datalist>
          <button class="merge-btn" id="previewMergeBtn">統合内容を確認</button>
        </div>
        <div class="danger-note">統合後、統合元の学校レコードは一覧から消え、名称はこの学校の別名として残ります。</div>
      </div>

      <button class="save-btn" id="saveMasterBtn">この内容で保存</button>
    </div>
  `;

  const candidateList = document.getElementById("mergeSchoolCandidates");
  candidateList.innerHTML = [...schoolMaster.values()]
    .filter(y=>y.canonical_name!==x.canonical_name)
    .sort((a,b)=>a.canonical_name.localeCompare(b.canonical_name,"ja"))
    .map(y=>`<option value="${esc(y.canonical_name)}">${esc(y.school_id)} ${esc(y.prefecture||"")}</option>`)
    .join("");

  document.getElementById("previewMergeBtn")?.addEventListener("click",()=>{
    const sourceName = document.getElementById("mergeSourceName").value.trim();
    if(!sourceName || sourceName===x.canonical_name) return;

    if(!schoolMaster.get(sourceName)){
      alert("統合元の学校名が見つかりません。候補から選択してください。");
      return;
    }

    showMergePreview(x.canonical_name, sourceName);
  });

  openMasterEditorPopup();
  document.getElementById("closeMasterEditorBtn")?.addEventListener("click",closeMasterEditorPopup);
  document.getElementById("openSchoolRatingBtn")?.addEventListener("click",()=>showRatingHistory(x.canonical_name));

  document.getElementById("saveMasterBtn").addEventListener("click",()=>{
    const oldName = x.canonical_name;
    const oldId = x.school_id;
    const oldStatus = x.status||"active";
    const newName = document.getElementById("editCanonicalName").value.trim() || oldName;
    const updated = {
      ...x,
      school_id: document.getElementById("editSchoolId").value.trim() || x.school_id,
      canonical_name: newName,
      furigana: document.getElementById("editFurigana").value.trim(),
      district: document.getElementById("editDistrict").value.trim(),
      prefecture: document.getElementById("editPref").value.trim(),
      local_district: document.getElementById("editLocalDistrict").value.trim(),
      local_district_id: document.getElementById("editLocalDistrictId")?.value || "",
      representative_area: document.getElementById("editRepArea").value.trim(),
      representative_area_id: document.getElementById("editRepAreaId")?.value || "",
      status: document.getElementById("editStatus").value,
      established_year: document.getElementById("editEstablishedYear").value.trim(),
      closed_year: document.getElementById("editClosedYear").value.trim(),
      successor_id: document.getElementById("editSuccessorId").value.trim(),
      aliases: uniq(
        document.getElementById("editAliases").value
          .split(/\r?\n/)
          .map(s=>s.trim())
          .filter(Boolean)
          .concat([newName])
      )
    };

    schoolMaster.delete(oldName);
    schoolMaster.set(newName, updated);

    // Rename keeps the same permanent school ID and is recorded as lineage.
    if(newName!==oldName){
      addLineageEvent({
        school_id:updated.school_id,
        event_year:"",
        event_type:"rename",
        old_name:oldName,
        new_name:newName,
        related_school_id:"",
        status_after:updated.status,
        note:"UI自動記録"
      });
    }
    if(updated.status!==oldStatus){
      addLineageEvent({
        school_id:updated.school_id,
        event_year:updated.closed_year||updated.established_year||"",
        event_type:updated.status==="closed"?"close":updated.status==="merged"?"merge":"status",
        old_name:oldName,
        new_name:newName,
        related_school_id:updated.successor_id||"",
        status_after:updated.status,
        note:"UI自動記録"
      });
    }

    // Textarea is the editable source of truth for this school's manual lineage rows.
    schoolLineage = schoolLineage.filter(h=>h.school_id!==oldId);
    const lineageLines = document.getElementById("editLineage").value.split(/\r?\n/).map(s=>s.trim()).filter(Boolean);
    lineageLines.forEach(line=>{
      const [event_year,event_type,old_name,new_name,related_school_id,...noteParts] = line.split("|");
      schoolLineage.push({
        id:`L${Date.now()}${Math.random().toString(16).slice(2,8)}`,
        created_at:new Date().toISOString(),
        school_id:updated.school_id,
        event_year:(event_year||"").trim(),
        event_type:(event_type||"").trim(),
        old_name:(old_name||"").trim(),
        new_name:(new_name||"").trim(),
        related_school_id:(related_school_id||"").trim(),
        status_after:updated.status,
        note:noteParts.join("|").trim()
      });
    });
    saveLineage();
    saveMasterToStorage();
    renderMasterTable();
    setTimeout(()=>render(),0);
    closeMasterEditorPopup();
    showSaveToast(`保存しました：${newName}`);
  });
}

function exportMasterCsv(){
  const header = [
    "school_id","canonical_name","furigana","district","prefecture",
    "local_district","local_district_id","representative_area","representative_area_id","status","established_year","closed_year","successor_id","aliases"
  ];
  const lines = [header.join(",")];

  for(const x of [...schoolMaster.values()].sort((a,b)=>a.canonical_name.localeCompare(b.canonical_name,"ja"))){
    const row = [
      x.school_id,x.canonical_name,x.furigana||"",x.district,x.prefecture,
      x.local_district,x.local_district_id||"",x.representative_area,x.representative_area_id||"",x.status||"active",x.established_year||"",x.closed_year||"",x.successor_id||"",(x.aliases||[]).join("|")
    ].map(v=>`"${String(v??"").replaceAll('"','""')}"`);
    lines.push(row.join(","));
  }

  const blob = new Blob(["\uFEFF"+lines.join("\n")],{type:"text/csv;charset=utf-8"});
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href=url;
  a.download="school_master_ui_export.csv";
  a.click();
  URL.revokeObjectURL(url);
}

async function importMasterCsv(file){
  const text = await file.text();
  const rows = csvParse(text);
  const m = new Map();
  rows.forEach(r=>{
    const name = String(r.canonical_name||"").trim();
    if(!name) return;
    m.set(name,{
      school_id:String(r.school_id||"").trim(),
      canonical_name:name,
      furigana:String(r.furigana||"").trim(),
      district:String(r.district||"").trim(),
      prefecture:String(r.prefecture||"").trim(),
      local_district:String(r.local_district||"").trim(),
      local_district_id:String(r.local_district_id||"").trim(),
      representative_area:String(r.representative_area||"").trim(),
      representative_area_id:String(r.representative_area_id||"").trim(),
      status:String(r.status||"active").trim()||"active",
      established_year:String(r.established_year||"").trim(),
      closed_year:String(r.closed_year||"").trim(),
      successor_id:String(r.successor_id||"").trim(),
      aliases:String(r.aliases||"").split("|").map(s=>s.trim()).filter(Boolean)
    });
  });
  if(m.size){
    schoolMaster = m;
    saveMasterToStorage();
    renderMasterTable();
    render();
  }
}



function ratingHistorySvg(events){
  const pts = events.filter(e=>Number.isFinite(Number(e.rating_after)));
  if(pts.length<2) return `<div class="empty-mini">Rating履歴がまだありません。</div>`;
  const W=760,H=180,P=24;
  const vals=pts.map(e=>Number(e.rating_after));
  const min=Math.min(...vals), max=Math.max(...vals);
  const range=Math.max(10,max-min);
  const xy=vals.map((v,i)=>{
    const x=P+(W-2*P)*(i/(vals.length-1));
    const y=H-P-(H-2*P)*((v-(min-range*.08))/(range*1.16));
    return [x,y];
  });
  const poly=xy.map(p=>p.join(",")).join(" ");
  return `<svg class="rating-chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Rating推移">
    <line x1="${P}" y1="${H-P}" x2="${W-P}" y2="${H-P}" class="chart-axis"/>
    <polyline points="${poly}" class="chart-line"/>
    ${xy.map((p,i)=>`<circle cx="${p[0]}" cy="${p[1]}" r="${i===xy.length-1?4:2.2}" class="chart-dot"/>`).join("")}
    <text x="${P}" y="16" class="chart-label">max ${max.toFixed(1)}</text>
    <text x="${W-P-90}" y="${H-6}" class="chart-label">min ${min.toFixed(1)}</text>
  </svg>`;
}

function showRatingHistory(name){
  const canonical = resolveCanonicalName(name);
  const events = schoolEventsFor(canonical);
  const modal = document.getElementById("ratingHistoryModal");
  const body = document.getElementById("ratingHistoryBody");
  document.getElementById("ratingHistoryTitle").textContent = `${canonical} / Rating履歴`;
  const current = serverRatingForSchool(canonical);
  const lineage = schoolMaster.get(canonical) ? lineageForSchool(schoolMaster.get(canonical).school_id) : [];

  body.innerHTML = `
    <div class="rating-summary">
      <div><span>現在Rating</span><strong>${current==null?"-":fmtR(current)}</strong></div>
      <div><span>Rating対象試合</span><strong>${events.length}</strong></div>
      <div><span>改名・統廃合履歴</span><strong>${lineage.length}</strong></div>
    </div>
    ${ratingHistorySvg(events)}
    <div class="table-wrap rating-history-wrap">
      <table class="rating-history-table">
        <thead><tr><th>日付</th><th>大会</th><th>相手</th><th>結果</th><th>試合前</th><th>変動</th><th>試合後</th><th>分配</th></tr></thead>
        <tbody>
          ${[...events].reverse().map(e=>`
            <tr>
              <td>${esc(e.date||"")}</td>
              <td>${esc(e.tournament||"")}<div class="school-meta">${esc(e.round||"")}</div></td>
              <td>${esc(e.opponent||"")}</td>
              <td>${esc(e.score_for)}-${esc(e.score_against)}</td>
              <td>${fmtR(e.rating_before)}</td>
              <td class="${Number(e.rating_delta)>=0?"rating-up":"rating-down"}">${fmtDelta(e.rating_delta)}</td>
              <td>${fmtR(e.rating_after)}</td>
              <td>${Number(e.is_union_member)===1 ? `${(Number(e.share)*100).toFixed(1)}%` : "100%"}</td>
            </tr>`).join("") || `<tr><td colspan="8">Ratingイベント未生成。Build Rating Events v2を実行してください。</td></tr>`}
        </tbody>
      </table>
    </div>
    ${lineage.length ? `<div class="lineage-summary"><h4>改名・統廃合履歴</h4>${lineage.map(h=>`<div><strong>${esc(h.event_year||"-")}</strong> ${esc(h.event_type||"")}　${esc(h.old_name||"")} → ${esc(h.new_name||"")} ${h.related_school_id?`<span class="id-badge">${esc(h.related_school_id)}</span>`:""} <small>${esc(h.note||"")}</small></div>`).join("")}</div>` : ""}
  `;
  modal.classList.remove("hidden");
}
function closeRatingHistory(){
  document.getElementById("ratingHistoryModal")?.classList.add("hidden");
}

function renderLocalAreaList(){
  const el=document.getElementById("localAreaList"); if(!el) return;
  const rows=[...localAreas].sort((a,b)=>`${a.prefecture}|${a.local_area_id}`.localeCompare(`${b.prefecture}|${b.local_area_id}`,"ja"));
  el.innerHTML=rows.map((a,i)=>`<div class="area-row">
    <span>${esc(a.prefecture)}</span><code>${esc(a.local_area_id)}</code><strong>${esc(a.local_area_name)}</strong>
    <button type="button" data-del-local="${i}" class="ghost mini">削除</button>
  </div>`).join("");
  el.querySelectorAll("[data-del-local]").forEach(btn=>btn.addEventListener("click",()=>{
    localAreas.splice(Number(btn.dataset.delLocal),1); saveAreaMasters(); renderLocalAreaList(); renderMasterTable();
  }));
}
function renderRepAreaList(){
  const el=document.getElementById("repAreaList"); if(!el) return;
  const rows=[...repAreas].sort((a,b)=>`${a.prefecture}|${a.rep_area_id}`.localeCompare(`${b.prefecture}|${b.rep_area_id}`,"ja"));
  el.innerHTML=rows.map((a,i)=>`<div class="area-row">
    <span>${esc(a.prefecture)}</span><code>${esc(a.rep_area_id)}</code><strong>${esc(a.rep_area_name)}</strong>
    <small>${esc(a.area_type)}</small>
    <button type="button" data-del-rep="${i}" class="ghost mini">削除</button>
  </div>`).join("");
  el.querySelectorAll("[data-del-rep]").forEach(btn=>btn.addEventListener("click",()=>{
    repAreas.splice(Number(btn.dataset.delRep),1); saveAreaMasters(); renderRepAreaList(); renderMasterTable();
  }));
}
function openLocalAreaModal(){ renderLocalAreaList(); document.getElementById("localAreaModal")?.classList.remove("hidden"); }
function openRepAreaModal(){ renderRepAreaList(); document.getElementById("repAreaModal")?.classList.remove("hidden"); }
function showSaveToast(message){
  let t = document.getElementById("saveToast");
  if(!t){
    t = document.createElement("div");
    t.id = "saveToast";
    t.className = "save-toast";
    document.body.appendChild(t);
  }
  t.textContent = message;
  t.classList.add("show");
  clearTimeout(window.__saveToastTimer);
  window.__saveToastTimer = setTimeout(()=>t.classList.remove("show"),2200);
}

function setupMasterUi(){
  if(masterUiSetupDone) return;
  masterUiSetupDone = true;
  const search = document.getElementById("masterSearch");
  if(search) search.addEventListener("input",debounce(()=>{masterPage=1;renderMasterTable();},180));

  const sort = document.getElementById("masterSort");
  if(sort) sort.addEventListener("change",()=>{masterPage=1;renderMasterTable();});
  ["masterDistrictFilter","masterPrefFilter","masterLocalFilter","masterStatusFilter"].forEach(id=>{
    document.getElementById(id)?.addEventListener("change",()=>{masterPage=1;renderMasterTable();});
  });
  document.getElementById("manageLocalAreasBtn")?.addEventListener("click",openLocalAreaModal);
  document.getElementById("manageRepAreasBtn")?.addEventListener("click",openRepAreaModal);
  document.getElementById("closeLocalAreaModal")?.addEventListener("click",()=>document.getElementById("localAreaModal")?.classList.add("hidden"));
  document.getElementById("closeRepAreaModal")?.addEventListener("click",()=>document.getElementById("repAreaModal")?.classList.add("hidden"));
  document.getElementById("addLocalAreaBtn")?.addEventListener("click",()=>{
    const prefecture=document.getElementById("areaPrefInput").value.trim();
    const local_area_id=document.getElementById("areaIdInput").value.trim();
    const local_area_name=document.getElementById("areaNameInput").value.trim();
    if(!prefecture||!local_area_id||!local_area_name) return;
    localAreas.push({prefecture,local_area_id,local_area_name,active:true});
    saveAreaMasters(); renderLocalAreaList(); renderMasterTable();
  });
  document.getElementById("addRepAreaBtn")?.addEventListener("click",()=>{
    const prefecture=document.getElementById("repPrefInput").value.trim();
    const rep_area_id=document.getElementById("repIdInput").value.trim();
    const rep_area_name=document.getElementById("repNameInput").value.trim();
    const area_type=document.getElementById("repTypeInput").value;
    if(!prefecture||!rep_area_id||!rep_area_name) return;
    repAreas.push({prefecture,rep_area_id,rep_area_name,area_type});
    saveAreaMasters(); renderRepAreaList(); renderMasterTable();
  });
  document.getElementById("masterPrev")?.addEventListener("click",()=>{if(masterPage>1){masterPage--;renderMasterTable();}});
  document.getElementById("masterNext")?.addEventListener("click",()=>{masterPage++;renderMasterTable();});
  document.getElementById("masterPageSize")?.addEventListener("change",()=>{masterPage=1;renderMasterTable();});
  document.getElementById("closeRatingHistoryBtn")?.addEventListener("click",closeRatingHistory);
  document.getElementById("ratingHistoryModal")?.addEventListener("click",e=>{
    if(e.target.id==="ratingHistoryModal") closeRatingHistory();
  });

  document.getElementById("clearSelectionBtn")?.addEventListener("click",()=>{
    selectedSchools.clear();
    renderMasterTable();
  });
  document.getElementById("openBulkMergeBtn")?.addEventListener("click",openBulkMergeModal);
  document.getElementById("closeBulkMergeBtn")?.addEventListener("click",closeBulkMergeModal);
  document.getElementById("bulkMergeModal")?.addEventListener("click",(e)=>{
    if(e.target.id==="bulkMergeModal") closeBulkMergeModal();
  });

  document.getElementById("masterEditorBackdrop")?.addEventListener("click",closeMasterEditorPopup);

  const exp = document.getElementById("exportAliasBtn");
  if(exp) exp.addEventListener("click",exportMasterCsv);

  const imp = document.getElementById("importAliasInput");
  if(imp) imp.addEventListener("change",async()=>{
    if(imp.files?.[0]) await importMasterCsv(imp.files[0]);
    imp.value="";
  });
}



async function fetchTextWithTimeout(url, timeoutMs=12000){
  const ctl = new AbortController();
  const timer = setTimeout(()=>ctl.abort(), timeoutMs);
  try{
    const res = await fetch(url,{cache:"no-store",signal:ctl.signal});
    if(!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
    return await res.text();
  }finally{
    clearTimeout(timer);
  }
}

async function boot(){
  const statusEl = document.getElementById("status");
  const setStatus = msg => {
    if(statusEl) statusEl.innerHTML = `${msg} <small class="build-tag">UI-STABLE-V3</small>`;
  };

  setStatus("UI起動中…");
  await new Promise(resolve=>setTimeout(resolve,0));

  try{
    // 1) まず最小限のランキング表示だけを作る。
    setStatus("ランキング読込中…");
    try{
      const ratingText = await fetchTextWithTimeout(RATINGS_URL,10000);
      serverRatings = csvParse(ratingText);
    }catch(err){
      console.warn("current_ratings load failed",err);
      serverRatings = [];
    }

    // 2) 本体試合CSVを読み込む。重い補助データは後回し。
    setStatus("試合台帳読込中…");
    const text = await fetchTextWithTimeout(DATA_URL,15000);
    allMatches = normalizeRows(csvParse(text));

    initSchoolMaster();
    loadLineage();
    loadAreaMasters();

    fillSelect("yearFilter", uniq(allMatches.map(x=>x.year)));
    fillSelect("regionFilter", uniq(allMatches.map(x=>x.region)));
    fillSelect("prefFilter", uniq(allMatches.map(x=>x.prefecture)));

    // 初期ランキングは serverRatings を優先して軽く表示。
    buildFastIndexes();
    setupTabs();

    ["yearFilter","seasonFilter","regionFilter","prefFilter","levelFilter"]
      .forEach(id=>document.getElementById(id)?.addEventListener("change",()=>{rankingPage=1;render();}));

    document.getElementById("schoolSearch")?.addEventListener("input",debounce(()=>{rankingPage=1;render();},180));

    document.getElementById("rankingPrev")?.addEventListener("click",()=>{if(rankingPage>1){rankingPage--;render();}});
    document.getElementById("rankingNext")?.addEventListener("click",()=>{rankingPage++;render();});
    document.getElementById("rankingPageSize")?.addEventListener("change",()=>{rankingPage=1;render();});

    document.getElementById("resetBtn")?.addEventListener("click",()=>{
      ["yearFilter","seasonFilter","regionFilter","prefFilter","levelFilter"]
        .forEach(id=>{ const el=document.getElementById(id); if(el) el.value="all"; });
      const s=document.getElementById("schoolSearch"); if(s) s.value="";
      rankingPage=1;
      const d=document.getElementById("detailPanel");
      if(d) d.innerHTML = `
        <div class="empty-state">
          <div class="ball">●</div>
          <h3>学校を選択</h3>
          <p>ランキングの学校名をクリックすると、戦績とRating推移を表示します。</p>
        </div>`;
      render();
    });

    setStatus(`${allMatches.length.toLocaleString()}試合 読込済み`);
    await new Promise(resolve=>requestAnimationFrame(resolve));
    render();

    // 3) 学校マスタはUIだけ先に使えるようにする。
    try{
      fillSelect("masterDistrictFilter", uniq([...schoolMaster.values()].map(x=>x.district)));
      fillSelect("masterPrefFilter", uniq([...schoolMaster.values()].map(x=>x.prefecture)));
      fillSelect("masterLocalFilter", uniq([...schoolMaster.values()].map(x=>x.local_district)));
      setupMasterUi();
    }catch(err){
      console.error("master setup failed",err);
    }

    // 4) 補助データは初期画面を出した後にバックグラウンドで読む。
    setTimeout(async()=>{
      try{
        const jobs = await Promise.allSettled([
          fetchTextWithTimeout(RATING_EVENTS_URL,12000),
          fetchTextWithTimeout(RATING_SCHOOL_EVENTS_URL,12000),
          fetchTextWithTimeout(HISTORY_LEDGER_URL,12000)
        ]);

        if(jobs[0].status==="fulfilled") ratingEvents = csvParse(jobs[0].value);
        if(jobs[1].status==="fulfilled") ratingSchoolEvents = csvParse(jobs[1].value);

        let historicalLedger = [];
        if(jobs[2].status==="fulfilled"){
          historicalLedger = normalizeRows(csvParse(jobs[2].value));
        }

        const ledgerSeen = new Set();
        ledgerMatches = [...allMatches, ...historicalLedger].filter(r=>{
          const key=[r.year,r.season,r.round,r.team1,r.score1,r.team2,r.score2,r.tournament].join("|");
          if(ledgerSeen.has(key)) return false;
          ledgerSeen.add(key); return true;
        }).map((r,i)=>({...r,_id:i}));

        buildFastIndexes();
        setupLedgerUi();
        setStatus(`${allMatches.length.toLocaleString()}試合 / 台帳${ledgerMatches.length.toLocaleString()}試合 読込済み`);
      }catch(err){
        console.error("background data load failed",err);
        // 初期ランキングと学校マスタはそのまま使用可能。
        setStatus(`${allMatches.length.toLocaleString()}試合 読込済み（補助台帳は後読込失敗）`);
      }
    },50);

  }catch(e){
    console.error(e);
    setStatus(`読込エラー: ${e?.name==="AbortError"?"タイムアウト":(e?.message||String(e))}`);
    const wrap=document.querySelector(".wrap");
    if(wrap){
      wrap.insertAdjacentHTML(
        "afterbegin",
        `<div class="panel load-error-panel" style="padding:16px;margin-bottom:16px">
          <strong>初期データの読込に失敗しました。</strong>
          <p style="margin:6px 0 0;color:#6d737c;font-size:13px">
            表示: ${esc(e?.message||String(e))}
          </p>
        </div>`
      );
    }
  }
}
boot();
