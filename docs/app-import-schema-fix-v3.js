
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
let serverRatingById = new Map();
let schoolEventMap = new Map();
let schoolEventById = new Map();
let detectedSchoolGeo = new Map();
let schoolByIdMap = new Map();
let matchTeamLinkMap = new Map();
let schoolMatchCache = new Map();
let identityIndexDirty = true;


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
const GITHUB_SYNC_CONFIG_KEY = "hsbbl_github_sync_v1";
const GITHUB_SYNC_TOKEN_KEY = "hsbbl_github_sync_token_v1";
const SHARED_MASTER_PATH = "master/school_master_shared.json";
const MATCH_EDITS_PATH = "master/match_edits_shared.json";
let matchEditsState = {version:1,updated_at:"",manual_matches:[],overrides:[],team_links:[]};
let matchEditsSha = "";

const FAST_SAVE_DELAY_MS = 3200;
const MATCH_EDITS_PENDING_KEY = "hsbbl_match_edits_pending_v1";
let masterSaveTimer=null;
let matchSaveTimer=null;
let masterSaveInFlight=false;
let matchSaveInFlight=false;
let masterSaveDirty=false;
let matchSaveDirty=false;
let masterQueuedMessage="Update shared school master";
let matchQueuedMessage="Update match ledger edits";

function fastSaveStatus(text,state="pending"){
  let el=document.getElementById("fastSaveStatus");
  if(!el){
    el=document.createElement("div");
    el.id="fastSaveStatus";
    el.className="fast-save-status";
    document.body.appendChild(el);
  }
  el.className=`fast-save-status ${state}`;
  el.textContent=text;
  el.classList.add("show");
  clearTimeout(el._hideTimer);
  if(state==="saved"){
    el._hideTimer=setTimeout(()=>el.classList.remove("show"),1800);
  }
}

function persistPendingMatchEdits(){
  try{ localStorage.setItem(MATCH_EDITS_PENDING_KEY,JSON.stringify(matchEditsState)); }catch(e){}
}
function clearPendingMatchEdits(){
  try{ localStorage.removeItem(MATCH_EDITS_PENDING_KEY); }catch(e){}
}
function restorePendingMatchEdits(){
  try{
    const raw=localStorage.getItem(MATCH_EDITS_PENDING_KEY);
    if(!raw) return;
    const pending=JSON.parse(raw);
    matchEditsState=mergeMatchEditStates(matchEditsState,pending);
  }catch(e){ console.warn("pending match edits restore failed",e); }
}

function queueSharedMasterSave(message="Update shared school master"){
  masterQueuedMessage=message;
  masterSaveDirty=true;
  fastSaveStatus("学校マスタ：保存待ち","pending");
  clearTimeout(masterSaveTimer);
  masterSaveTimer=setTimeout(flushSharedMasterSave,FAST_SAVE_DELAY_MS);
}

async function flushSharedMasterSave(){
  if(masterSaveInFlight){ masterSaveDirty=true; return; }
  if(!masterSaveDirty) return;
  const cfg=loadGitHubSyncConfig();
  if(!cfg.owner||!cfg.repo||!githubSessionToken){
    fastSaveStatus("学校マスタ：端末保存済み（GitHub未設定）","saved");
    return;
  }
  masterSaveDirty=false;
  masterSaveInFlight=true;
  fastSaveStatus("学校マスタ：GitHub保存中","saving");
  try{
    await pushSharedMasterToGitHub(masterQueuedMessage);
    fastSaveStatus("学校マスタ：保存済み","saved");
  }catch(err){
    console.error(err);
    masterSaveDirty=true;
    fastSaveStatus("学校マスタ：再保存待ち","error");
    clearTimeout(masterSaveTimer);
    masterSaveTimer=setTimeout(flushSharedMasterSave,6000);
  }finally{
    masterSaveInFlight=false;
    if(masterSaveDirty){
      clearTimeout(masterSaveTimer);
      masterSaveTimer=setTimeout(flushSharedMasterSave,FAST_SAVE_DELAY_MS);
    }
  }
}

function queueMatchEditsSave(message="Update match ledger edits"){
  matchQueuedMessage=message;
  matchSaveDirty=true;
  persistPendingMatchEdits();
  fastSaveStatus("対戦台帳：保存待ち","pending");
  clearTimeout(matchSaveTimer);
  matchSaveTimer=setTimeout(flushMatchEditsSave,FAST_SAVE_DELAY_MS);
}

async function flushMatchEditsSave(){
  if(matchSaveInFlight){ matchSaveDirty=true; return; }
  if(!matchSaveDirty) return;
  const cfg=loadGitHubSyncConfig();
  if(!cfg.owner||!cfg.repo||!githubSessionToken){
    fastSaveStatus("対戦台帳：端末保存済み（GitHub未設定）","saved");
    return;
  }
  matchSaveDirty=false;
  matchSaveInFlight=true;
  fastSaveStatus("対戦台帳：GitHub保存中","saving");
  try{
    await pushMatchEditsShared(matchQueuedMessage);
    clearPendingMatchEdits();
    fastSaveStatus("対戦台帳：保存済み","saved");
  }catch(err){
    console.error(err);
    matchSaveDirty=true;
    fastSaveStatus("対戦台帳：再保存待ち","error");
    clearTimeout(matchSaveTimer);
    matchSaveTimer=setTimeout(flushMatchEditsSave,6000);
  }finally{
    matchSaveInFlight=false;
    if(matchSaveDirty){
      clearTimeout(matchSaveTimer);
      matchSaveTimer=setTimeout(flushMatchEditsSave,FAST_SAVE_DELAY_MS);
    }
  }
}

window.addEventListener("pagehide",()=>{
  // ブラウザ終了時にも未保存内容はlocalStorageへ残し、次回起動時に復元する。
  if(matchSaveDirty||matchSaveInFlight) persistPendingMatchEdits();
});


let sharedMasterState = null;
let sharedMasterSha = "";
let githubSessionToken = "";


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


function inferredInningsAndFinish(r){
  const explicit = Number(r?.innings);
  let innings = Number.isFinite(explicit) && explicit>0 ? explicit : null;
  let finish = String(r?.finish_type||"").trim().toLowerCase();
  const text = `${r?.note||""} ${r?.round||""} ${r?.tournament||""}`;

  if(!innings){
    let m=text.match(/(?:延長|タイブレーク)?\s*(\d{1,2})回/);
    if(m) innings=Number(m[1]);
  }
  if(!finish){
    if(/コールド/.test(text)) finish="cold";
    else if(/タイブレーク/.test(text)) finish="tiebreak";
    else if(/延長/.test(text) || (innings && innings>9)) finish="extra";
    else finish="normal";
  }
  // 入力がない試合は標準の9回通常決着として扱う。
  if(!innings) innings=9;
  return {innings,finish_type:finish||"normal"};
}

function inningFactor(innings,finishType){
  const n=Number(innings);
  const f=String(finishType||"").toLowerCase();
  if(!Number.isFinite(n) || n<=0) return 1;
  if(f==="cold" && n>=5 && n<=8) return 1 + (9-n)*0.02;
  if(n>9) return Math.max(0.80,1-(n-9)*0.02);
  return 1;
}

function scoreKey(v){
  const n=Number(v);
  return Number.isFinite(n) ? String(n) : String(v??"").trim();
}

function matchEditKey(r){
  if(r?.edit_key) return String(r.edit_key);
  if(r?.manual_id) return String(r.manual_id);
  return [
    r?.year||"",r?.season||"",r?.date||"",r?.tournament||"",r?.round||"",
    r?.team1||"",scoreKey(r?.score1),r?.team2||"",scoreKey(r?.score2)
  ].join("¦");
}

function setNoteLevel(note,level){
  const parts=String(note||"").split(";").map(x=>x.trim()).filter(Boolean)
    .filter(x=>!x.startsWith("level="));
  if(level) parts.unshift(`level=${level}`);
  return parts.join(";");
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
    innings:inferredInningsAndFinish(r).innings,
    finish_type:inferredInningsAndFinish(r).finish_type,
    edit_key:String(r.edit_key||"").trim(),
    manual_id:String(r.manual_id||"").trim(),
    team1_school_id:String(r.team1_school_id||"").trim(),
    team2_school_id:String(r.team2_school_id||"").trim(),
    team1_canonical:String(r.team1_canonical||"").trim(),
    team2_canonical:String(r.team2_canonical||"").trim(),
    level:getLevel(r.note)
  })).filter(r=>r.team1 && r.team2 && Number.isFinite(r.score1) && Number.isFinite(r.score2));
}

function uniq(arr){
  return [...new Set(arr.filter(Boolean))].sort((a,b)=>String(a).localeCompare(String(b),"ja"));
}


function refillSelectPreserve(id, values){
  const el=document.getElementById(id);
  if(!el) return;
  const before=el.value;
  fillSelect(id,values);
  const exists=[...el.options].some(o=>o.value===before);
  el.value=exists ? before : "all";
}

function scrollMasterListTop(){
  const wrap=document.querySelector(".master-table-wrap");
  if(wrap){
    wrap.scrollTo({top:0,behavior:"instant"});
  }
  const list=document.querySelector(".master-list");
  if(list && list.scrollTop>0){
    list.scrollTo({top:0,behavior:"instant"});
  }
  const table=document.getElementById("masterTable");
  if(table){
    table.scrollIntoView({block:"start",behavior:"instant"});
  }
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


function inferGitHubRepo(){
  const host=location.hostname||"";
  if(host.endsWith(".github.io")){
    const owner=host.split(".")[0];
    const seg=location.pathname.split("/").filter(Boolean);
    return {owner,repo:seg[0]||`${owner}.github.io`,branch:"main"};
  }
  return {owner:"",repo:"HS-BB-L",branch:"main"};
}

function loadGitHubSyncConfig(){
  let cfg=inferGitHubRepo();
  try{
    const saved=JSON.parse(localStorage.getItem(GITHUB_SYNC_CONFIG_KEY)||"null");
    if(saved) cfg={...cfg,...saved};
  }catch(e){}
  const remembered=localStorage.getItem(GITHUB_SYNC_TOKEN_KEY)||"";
  const session=sessionStorage.getItem(GITHUB_SYNC_TOKEN_KEY)||"";
  githubSessionToken=String(session||remembered||"").replace(/\s+/g,"");
  return cfg;
}

function saveGitHubSyncConfig(cfg,token,remember){
  localStorage.setItem(GITHUB_SYNC_CONFIG_KEY,JSON.stringify(cfg));
  if(token){
    sessionStorage.setItem(GITHUB_SYNC_TOKEN_KEY,token);
    githubSessionToken=token;
    if(remember) localStorage.setItem(GITHUB_SYNC_TOKEN_KEY,token);
    else localStorage.removeItem(GITHUB_SYNC_TOKEN_KEY);
  }
  updateGitHubSyncStatus();
}

function updateGitHubSyncStatus(extra=""){
  const el=document.getElementById("schoolMasterSyncStatus");
  if(!el) return;
  const cfg=loadGitHubSyncConfig();
  const connected=!!(cfg.owner&&cfg.repo&&githubSessionToken);
  el.classList.toggle("sync-on",connected);
  el.classList.toggle("sync-off",!connected);
  el.textContent=connected ? `共有同期 ON${extra?` / ${extra}`:""}` : "共有同期 未設定";
}

function sharedRawUrl(cfg){
  if(!cfg.owner||!cfg.repo) return "";
  return `https://raw.githubusercontent.com/${encodeURIComponent(cfg.owner)}/${encodeURIComponent(cfg.repo)}/${encodeURIComponent(cfg.branch||"main")}/${SHARED_MASTER_PATH}`;
}

async function loadSharedMasterFromGitHub({force=false}={}){
  const cfg=loadGitHubSyncConfig();
  let lastError=null;

  // Tokenがある端末では認証済みGitHub APIを最優先。
  if(cfg.owner && cfg.repo && githubSessionToken){
    try{
      const data=await githubApi(`/contents/${SHARED_MASTER_PATH}?ref=${encodeURIComponent(cfg.branch||"main")}`);
      if(data?.content){
        const clean=String(data.content).replace(/\s+/g,"");
        const binary=atob(clean);
        const bytes=Uint8Array.from(binary,c=>c.charCodeAt(0));
        const text=new TextDecoder("utf-8").decode(bytes);
        const state=JSON.parse(text);
        if(state && Array.isArray(state.schools)){
          sharedMasterState=state;
          sharedMasterSha=data.sha||"";
          updateGitHubSyncStatus(state.updated_at ? `更新 ${String(state.updated_at).replace("T"," ").slice(0,16)}` : "共有読込済み");
          return state;
        }
      }
      lastError=new Error("共有マスタJSONの形式が不正です");
    }catch(err){
      lastError=err;
      console.warn("shared master API load failed",err);
      if(String(err?.message||err).includes("GitHub 404")) lastError=null;
    }
  }

  // public repoならrawからも読める。
  if(cfg.owner && cfg.repo){
    try{
      const url=sharedRawUrl(cfg)+`?t=${Date.now()}`;
      const res=await fetch(url,{cache:"no-store"});
      if(res.ok){
        const state=await res.json();
        if(state && Array.isArray(state.schools)){
          sharedMasterState=state;
          updateGitHubSyncStatus(state.updated_at ? `更新 ${String(state.updated_at).replace("T"," ").slice(0,16)}` : "共有読込済み");
          return state;
        }
      }else if(res.status!==404){
        lastError=new Error(`raw GitHub HTTP ${res.status}`);
      }
    }catch(err){ lastError=err; }
  }

  // 最後に前回Actionでdeploy済みのPagesコピーを読む。
  try{
    const res=await fetch(`data/school_master_shared.json?t=${Date.now()}`,{cache:"no-store"});
    if(res.ok){
      const state=await res.json();
      if(state && Array.isArray(state.schools)){
        sharedMasterState=state;
        updateGitHubSyncStatus(state.updated_at ? `更新 ${String(state.updated_at).replace("T"," ").slice(0,16)}` : "Pages読込済み");
        return state;
      }
    }else if(res.status!==404){
      lastError=new Error(`Pages HTTP ${res.status}`);
    }
  }catch(err){ lastError=err; }

  if(force){
    if(lastError) throw lastError;
    throw new Error("共有マスタがまだGitHubに作成されていません");
  }
  return null;
}
function applySharedMasterState(state){
  if(!state || !Array.isArray(state.schools)) return false;
  schoolMaster=new Map(state.schools.map(x=>[
    x.canonical_name,
    {
      furigana:"",
      local_district:"",
      local_district_id:"",
      representative_area:"",
      representative_area_id:"",
      aliases:[x.canonical_name],
      status:"active",
      established_year:"",
      closed_year:"",
      successor_id:"",
      ...x,
      aliases:uniq([x.canonical_name,...(x.aliases||[])])
    }
  ]));
  if(Array.isArray(state.lineage)) schoolLineage=state.lineage;
  if(Array.isArray(state.local_areas)) localAreas=state.local_areas;
  if(Array.isArray(state.representative_areas)) repAreas=state.representative_areas;
  saveMasterToStorage();
  saveLineage();
  saveAreaMasters();
  return true;
}

function currentSharedMasterState(){
  return {
    version:1,
    updated_at:new Date().toISOString(),
    schools:[...schoolMaster.values()].sort((a,b)=>a.canonical_name.localeCompare(b.canonical_name,"ja")),
    lineage:schoolLineage,
    local_areas:localAreas,
    representative_areas:repAreas
  };
}

function utf8ToBase64(str){
  const bytes=new TextEncoder().encode(str);
  let binary="";
  const chunk=0x8000;
  for(let i=0;i<bytes.length;i+=chunk){
    binary += String.fromCharCode(...bytes.subarray(i,i+chunk));
  }
  return btoa(binary);
}

async function githubApi(path,opts={}){
  const cfg=loadGitHubSyncConfig();
  const token=githubSessionToken;
  if(!cfg.owner||!cfg.repo) throw new Error("GitHub owner / repository が未設定です");
  if(!token) throw new Error("GitHubトークンが未設定です");
  const url=`https://api.github.com/repos/${encodeURIComponent(cfg.owner)}/${encodeURIComponent(cfg.repo)}${path}`;
  const res=await fetch(url,{
    ...opts,
    headers:{
      "Accept":"application/vnd.github+json",
      "X-GitHub-Api-Version":"2022-11-28",
      "Authorization":`Bearer ${token}`,
      ...(opts.headers||{})
    }
  });
  if(!res.ok){
    let detail="";
    try{ detail=(await res.json()).message||""; }catch(e){}
    throw new Error(`GitHub ${res.status}${detail?`: ${detail}`:""}`);
  }
  return await res.json();
}

async function getSharedMasterSha(){
  const cfg=loadGitHubSyncConfig();
  try{
    const data=await githubApi(`/contents/${SHARED_MASTER_PATH}?ref=${encodeURIComponent(cfg.branch||"main")}`);
    sharedMasterSha=data.sha||"";
    return sharedMasterSha;
  }catch(err){
    if(String(err.message).includes("GitHub 404")){
      sharedMasterSha="";
      return "";
    }
    throw err;
  }
}

async function fetchRemoteSharedMasterForWrite(){
  const cfg=loadGitHubSyncConfig();
  try{
    const data=await githubApi(`/contents/${SHARED_MASTER_PATH}?ref=${encodeURIComponent(cfg.branch||"main")}`);
    let state=null;
    if(data?.content){
      const clean=String(data.content).replace(/\s+/g,"");
      const binary=atob(clean);
      const bytes=Uint8Array.from(binary,c=>c.charCodeAt(0));
      const text=new TextDecoder("utf-8").decode(bytes);
      state=JSON.parse(text);
    }
    return {sha:data?.sha||"", state};
  }catch(err){
    if(String(err?.message||err).includes("GitHub 404")) return {sha:"",state:null};
    throw err;
  }
}

function mergeSharedMasterStates(remoteState, localState){
  // Remote is the base so edits from another device are not discarded.
  if(!remoteState || !Array.isArray(remoteState.schools)) return localState;

  const merged={...remoteState,...localState};
  const byId=new Map();

  for(const s of remoteState.schools||[]){
    const key=s.school_id || s.canonical_name;
    if(key) byId.set(key,{...s});
  }
  for(const s of localState.schools||[]){
    const key=s.school_id || s.canonical_name;
    if(key) byId.set(key,{...(byId.get(key)||{}),...s});
  }
  merged.schools=[...byId.values()];

  // For list-like master data, merge by stable keys rather than replacing wholesale.
  const mergeList=(a,b,keyFn)=>{
    const m=new Map();
    for(const x of a||[]){ const k=keyFn(x); if(k) m.set(k,{...x}); }
    for(const x of b||[]){ const k=keyFn(x); if(k) m.set(k,{...(m.get(k)||{}),...x}); }
    return [...m.values()];
  };

  merged.lineage=mergeList(
    remoteState.lineage,localState.lineage,
    x=>[x.school_id,x.event_year,x.event_type,x.old_name,x.new_name].join("|")
  );
  merged.local_areas=mergeList(
    remoteState.local_areas,localState.local_areas,
    x=>x.local_area_id || [x.prefecture,x.local_area_name].join("|")
  );
  merged.representative_areas=mergeList(
    remoteState.representative_areas,localState.representative_areas,
    x=>x.rep_area_id || [x.prefecture,x.rep_area_name].join("|")
  );

  merged.version=Math.max(Number(remoteState.version||1),Number(localState.version||1));
  merged.updated_at=new Date().toISOString();
  return merged;
}

async function pushSharedMasterToGitHub(message="Update shared school master"){
  const cfg=loadGitHubSyncConfig();
  let localState=currentSharedMasterState();
  let sha=sharedMasterSha||"";
  let lastError=null;

  for(let attempt=1;attempt<=4;attempt++){
    try{
      // 初回は起動時に取得済みのSHAをそのまま使い、余計なGETを省く。
      if(!sha && attempt===1){
        const remote=await fetchRemoteSharedMasterForWrite();
        sha=remote.sha||"";
        localState=mergeSharedMasterStates(remote.state,localState);
      }
      const content=JSON.stringify(localState,null,2)+"\n";
      const body={message,content:utf8ToBase64(content),branch:cfg.branch||"main"};
      if(sha) body.sha=sha;

      const data=await githubApi(`/contents/${SHARED_MASTER_PATH}`,{
        method:"PUT",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify(body)
      });
      sharedMasterSha=data?.content?.sha||"";
      sharedMasterState=localState;
      updateGitHubSyncStatus("GitHub保存済み");
      return data;
    }catch(err){
      lastError=err;
      if(!/GitHub (409|422)/.test(String(err?.message||err)) || attempt===4) break;
      const remote=await fetchRemoteSharedMasterForWrite();
      sha=remote.sha||"";
      // リモートを土台に、現在の端末編集を上書きして再試行。
      localState=mergeSharedMasterStates(remote.state,currentSharedMasterState());
      await new Promise(r=>setTimeout(r,[250,500,900,1500][attempt-1]));
    }
  }
  throw new Error(`${lastError?.message||lastError}\nPC/スマホの同時更新が重なったため再試行します。`);
}
function openGitHubSyncModal(){
  const cfg=loadGitHubSyncConfig();
  document.getElementById("githubOwnerInput").value=cfg.owner||"";
  document.getElementById("githubRepoInput").value=cfg.repo||"HS-BB-L";
  document.getElementById("githubBranchInput").value=cfg.branch||"main";
  document.getElementById("githubTokenInput").value=githubSessionToken||"";
  document.getElementById("githubRememberToken").checked=!!localStorage.getItem(GITHUB_SYNC_TOKEN_KEY);
  document.getElementById("githubSyncMessage").textContent="";
  document.getElementById("githubSyncModal")?.classList.remove("hidden");
}

function closeGitHubSyncModal(){
  document.getElementById("githubSyncModal")?.classList.add("hidden");
}

function readGitHubSyncForm(){
  return {
    cfg:{
      owner:(document.getElementById("githubOwnerInput")?.value||"").trim(),
      repo:(document.getElementById("githubRepoInput")?.value||"").trim(),
      branch:(document.getElementById("githubBranchInput")?.value||"main").trim()
    },
    token:(document.getElementById("githubTokenInput")?.value||"").replace(/\s+/g,""),
    remember:!!document.getElementById("githubRememberToken")?.checked
  };
}

async function reloadSharedMasterUi(){
  const btn=document.getElementById("reloadSharedMasterBtn");
  const old=btn?.textContent||"共有マスタ再読込";
  if(btn){btn.disabled=true;btn.textContent="再読込中…";}
  try{
    const state=await loadSharedMasterFromGitHub({force:true});
    applySharedMasterState(state);
    refillSelectPreserve("masterDistrictFilter", uniq([...schoolMaster.values()].map(v=>v.district)));
    refillSelectPreserve("masterPrefFilter", uniq([...schoolMaster.values()].map(v=>v.prefecture)));
    refillSelectPreserve("masterLocalFilter", uniq([...schoolMaster.values()].map(v=>v.local_district)));
    masterPage=1;
    renderMasterTable();
    render();
    showSaveDialog(`共有マスタを再読込しました\n${state.schools.length.toLocaleString()}校`);
  }finally{
    if(btn){btn.disabled=false;btn.textContent=old;}
  }
}

async function publishCurrentMasterAsShared(){
  const cfg=loadGitHubSyncConfig();
  if(!cfg.owner || !cfg.repo || !githubSessionToken){
    showSaveDialog("GitHub同期設定を先に完了してください");
    return;
  }
  if(!confirm("現在この端末に表示されている学校マスタを、GitHub共有マスタとして保存します。よろしいですか？")) return;
  const btn=document.getElementById("publishSharedMasterBtn");
  const old=btn?.textContent||"現在マスタを共有へ初期登録";
  if(btn){btn.disabled=true;btn.textContent="共有へ保存中…";}
  try{
    await pushSharedMasterToGitHub("Initialize shared school master");
    showSaveDialog(`共有マスタをGitHubへ保存しました\n${schoolMaster.size.toLocaleString()}校\n\nRatingは約45秒後に自動再計算されます`);
  }catch(err){
    console.error(err);
    showSaveDialog(`共有マスタ初期登録に失敗しました\n${err.message}\n\nToken権限: Contents = Read and write を確認してください`);
  }finally{
    if(btn){btn.disabled=false;btn.textContent=old;}
  }
}

function emptyMatchEditsState(){
  return {version:1,updated_at:"",manual_matches:[],overrides:[],team_links:[]};
}

async function fetchGithubJsonFile(path){
  const cfg=loadGitHubSyncConfig();
  try{
    const data=await githubApi(`/contents/${path}?ref=${encodeURIComponent(cfg.branch||"main")}`);
    if(!data?.content) return {sha:data?.sha||"",state:null};
    const binary=atob(String(data.content).replace(/\s+/g,""));
    const bytes=Uint8Array.from(binary,c=>c.charCodeAt(0));
    const text=new TextDecoder("utf-8").decode(bytes);
    return {sha:data.sha||"",state:JSON.parse(text)};
  }catch(err){
    if(String(err?.message||err).includes("GitHub 404")) return {sha:"",state:null};
    throw err;
  }
}

async function loadMatchEditsShared(){
  const cfg=loadGitHubSyncConfig();

  if(cfg.owner && cfg.repo && githubSessionToken){
    try{
      const x=await fetchGithubJsonFile(MATCH_EDITS_PATH);
      if(x.state){
        matchEditsState={...emptyMatchEditsState(),...x.state};
        matchEditsSha=x.sha||"";
        return matchEditsState;
      }
    }catch(err){
      console.warn("match edits API load failed",err);
    }
  }

  try{
    const res=await fetch(`data/match_edits_shared.json?t=${Date.now()}`,{cache:"no-store"});
    if(res.ok){
      matchEditsState={...emptyMatchEditsState(),...(await res.json())};
      return matchEditsState;
    }
  }catch(err){
    console.warn("match edits Pages load failed",err);
  }

  matchEditsState=emptyMatchEditsState();
  return matchEditsState;
}

function mergeMatchEditStates(remote,local){
  const out={...emptyMatchEditsState(),...(remote||{}),...(local||{})};
  const mergeBy=(a,b,keyFn)=>{
    const m=new Map();
    for(const x of a||[]){ const k=keyFn(x); if(k) m.set(k,{...x}); }
    for(const x of b||[]){ const k=keyFn(x); if(k) m.set(k,{...(m.get(k)||{}),...x}); }
    return [...m.values()];
  };
  out.manual_matches=mergeBy(remote?.manual_matches,local?.manual_matches,x=>x.manual_id);
  out.overrides=mergeBy(remote?.overrides,local?.overrides,x=>x.edit_key);
  out.team_links=mergeBy(remote?.team_links,local?.team_links,x=>`${x.edit_key}|${x.side}`);
  out.updated_at=new Date().toISOString();
  return out;
}

async function pushMatchEditsShared(message="Update match ledger edits"){
  const cfg=loadGitHubSyncConfig();
  if(!cfg.owner||!cfg.repo||!githubSessionToken) throw new Error("GitHub同期設定が必要です");

  let local={...matchEditsState,updated_at:new Date().toISOString()};
  let sha=matchEditsSha||"";
  let lastErr=null;

  for(let attempt=1;attempt<=4;attempt++){
    try{
      if(!sha && attempt===1){
        const remote=await fetchGithubJsonFile(MATCH_EDITS_PATH);
        sha=remote.sha||"";
        local=mergeMatchEditStates(remote.state,local);
      }
      const body={
        message,
        branch:cfg.branch||"main",
        content:utf8ToBase64(JSON.stringify(local,null,2)+"\n")
      };
      if(sha) body.sha=sha;

      const data=await githubApi(`/contents/${MATCH_EDITS_PATH}`,{
        method:"PUT",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify(body)
      });
      matchEditsSha=data?.content?.sha||"";
      // 保存中に追加された操作を消さない。
      matchEditsState=mergeMatchEditStates(local,matchEditsState);
      return data;
    }catch(err){
      lastErr=err;
      if(!/GitHub (409|422)/.test(String(err?.message||err)) || attempt===4) break;
      const remote=await fetchGithubJsonFile(MATCH_EDITS_PATH);
      sha=remote.sha||"";
      local=mergeMatchEditStates(remote.state,matchEditsState);
      await new Promise(r=>setTimeout(r,[250,500,900,1500][attempt-1]));
    }
  }
  throw lastErr||new Error("対戦台帳共有保存に失敗しました");
}
function overrideForKey(key){
  return (matchEditsState.overrides||[]).find(x=>x.edit_key===key)||null;
}
function linksForKey(key){
  return (matchEditsState.team_links||[]).filter(x=>x.edit_key===key);
}
function upsertMatchOverride(editKey,changes){
  const list=matchEditsState.overrides||(matchEditsState.overrides=[]);
  const i=list.findIndex(x=>x.edit_key===editKey);
  const item={edit_key:editKey,changes:{...(i>=0?list[i].changes:{}),...changes}};
  if(i>=0) list[i]=item; else list.push(item);
}
function upsertMatchTeamLink(editKey,side,school){
  if(!school) return;
  const list=matchEditsState.team_links||(matchEditsState.team_links=[]);
  const i=list.findIndex(x=>x.edit_key===editKey&&x.side===side);
  const item={
    edit_key:editKey,side,
    school_id:school.school_id||"",
    canonical_name:school.canonical_name||""
  };
  if(i>=0) list[i]=item; else list.push(item);
  matchTeamLinkMap.set(`${editKey}|${side}`,item);
  markIdentityIndexesDirty();
}

function applySharedEditsToRow(row){
  const r={...row};
  const key=matchEditKey(r);
  const ov=overrideForKey(key);
  if(ov?.changes) Object.assign(r,ov.changes);
  for(const l of linksForKey(key)){
    r[`${l.side}_school_id`]=l.school_id||"";
    r[`${l.side}_canonical`]=l.canonical_name||"";
  }
  r.edit_key=key;
  return r;
}

function applyMatchEditsToRows(rows,{includeManual=false}={}){
  let out=(rows||[]).map(applySharedEditsToRow);
  if(includeManual){
    const have=new Set(out.map(r=>r.manual_id).filter(Boolean));
    for(const m of matchEditsState.manual_matches||[]){
      if(m.manual_id && !have.has(m.manual_id)) out.push({...m,edit_key:m.manual_id});
    }
  }
  return out;
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
  markIdentityIndexesDirty();
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
  const saved = sharedMasterState && Array.isArray(sharedMasterState.schools)
    ? new Map(sharedMasterState.schools.map(x=>[x.canonical_name,x]))
    : loadMasterFromStorage();
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
  const name=String(raw||"").trim();
  if(!name) return name;

  // Explicit alias linkage takes priority over a duplicate provisional school
  // whose canonical_name happens to equal the old/raw label.
  for(const item of schoolMaster.values()){
    if(item.canonical_name!==name && (item.aliases||[]).includes(name)){
      return item.canonical_name;
    }
  }
  if(schoolMaster.has(name)) return name;
  for(const item of schoolMaster.values()){
    if((item.aliases||[]).includes(name)) return item.canonical_name;
  }
  return name;
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
    const t1 = effectiveMatchSchoolName(m,"team1");
    const t2 = effectiveMatchSchoolName(m,"team2");
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

  if(serverRatings.length){
    // current_ratings.csv generated by GitHub Actions is authoritative.
    // PC / smartphone / browser all display the same Rating.
    // Filters only narrow schools; they never recalculate Elo here.
    let allowed = null;
    if(hasScopeFilter){
      allowed = new Set();
      for(const m of matches){
        allowed.add(m.team1);
        allowed.add(m.team2);
        allowed.add(effectiveMatchSchoolName(m,"team1"));
        allowed.add(effectiveMatchSchoolName(m,"team2"));
      }
    }

    currentStats = new Map();
    for(const r of serverRatings){
      if(allowed && !allowed.has(r.school) && !allowed.has(resolveCanonicalName(r.school))) continue;
      currentStats.set(r.school,{
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
      });
    }
    document.getElementById("ratingMode").textContent = "GitHub確定Rating";
  }else{
    // Emergency fallback only when the generated server file is missing.
    currentStats = calcRatings(matches);
    document.getElementById("ratingMode").textContent = "暫定（サーバーRating未生成）";
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
    const rowColor = schoolRowColor(rec || {canonical_name:s.team,district,prefecture:pref});
    return `<tr class="ranking-school-row" style="--school-row-bg:${rowColor.bg};--school-row-accent:${rowColor.accent}">
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
        <div class="school-meta"><span class="id-badge">${esc(sid)}</span>　${serverRatings.length ? `GitHub確定Rating / 歴史prior ${s.historyPrior>=0?"+":""}${(s.historyPrior||0).toFixed(1)}` : "暫定計算"}</div>
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
  const rec = schoolMaster.get(canonical);
  if(rec?.school_id && serverRatingById.has(String(rec.school_id))){
    return serverRatingById.get(String(rec.school_id));
  }
  if(serverRatingMap.has(canonical)) return serverRatingMap.get(canonical);
  for(const alias of (rec?.aliases||[])){
    if(serverRatingMap.has(alias)) return serverRatingMap.get(alias);
  }
  return null;
}
function schoolEventsFor(name){
  const canonical = resolveCanonicalName(name);
  const rec = schoolMaster.get(canonical);

  if(rec?.school_id && schoolEventById.has(String(rec.school_id))){
    return [...schoolEventById.get(String(rec.school_id))]
      .sort((a,b)=>(a.date||"").localeCompare(b.date||"") || (a.match_key||"").localeCompare(b.match_key||""));
  }

  const aliases = new Set([canonical, ...(rec?.aliases||[])]);
  const merged = [];
  const seen = new Set();
  for(const alias of aliases){
    for(const e of (schoolEventMap.get(alias)||[])){
      const k = `${e.match_key}|${e.school_id||""}|${e.school}|${e.raw_team}`;
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

function markIdentityIndexesDirty(){
  identityIndexDirty=true;
}

function rebuildIdentityIndexes(){
  schoolByIdMap=new Map();
  for(const s of schoolMaster.values()){
    if(s.school_id) schoolByIdMap.set(String(s.school_id),s);
  }

  matchTeamLinkMap=new Map();
  for(const l of (matchEditsState.team_links||[])){
    if(l?.edit_key && l?.side){
      matchTeamLinkMap.set(`${l.edit_key}|${l.side}`,l);
    }
  }

  schoolMatchCache=new Map();
  const rows=ledgerMatches.length?ledgerMatches:allMatches;

  const add=(key,row)=>{
    if(!key) return;
    if(!schoolMatchCache.has(key)) schoolMatchCache.set(key,[]);
    schoolMatchCache.get(key).push(row);
  };

  for(const r of rows){
    for(const side of ["team1","team2"]){
      const eff=effectiveMatchSchoolUncached(r,side);
      add(eff.school_id?`id:${eff.school_id}`:`name:${eff.canonical}`,r);
    }
  }
  identityIndexDirty=false;
}

function ensureIdentityIndexes(){
  if(identityIndexDirty) rebuildIdentityIndexes();
}

function buildFastIndexes(){
  ratingEventMap = new Map();
  for(const e of ratingEvents){
    if(e.match_key) ratingEventMap.set(e.match_key,e);
  }

  serverRatingMap = new Map();
  serverRatingById = new Map();
  for(const r of serverRatings){
    const n = Number(r.rating);
    if(r.school && Number.isFinite(n)) serverRatingMap.set(r.school,n);
    if(r.school_id && Number.isFinite(n)) serverRatingById.set(String(r.school_id),n);
  }

  schoolEventMap = new Map();
  schoolEventById = new Map();
  for(const e of ratingSchoolEvents){
    if(e.school_id){
      const sid=String(e.school_id);
      if(!schoolEventById.has(sid)) schoolEventById.set(sid,[]);
      schoolEventById.get(sid).push(e);
    }
    for(const key of [e.school,e.raw_team]){
      if(!key) continue;
      if(!schoolEventMap.has(key)) schoolEventMap.set(key,[]);
      schoolEventMap.get(key).push(e);
    }
  }
  markIdentityIndexesDirty();
  ensureIdentityIndexes();
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
      const a = effectiveMatchSchoolName(r,"team1").toLowerCase();
      const b = effectiveMatchSchoolName(r,"team2").toLowerCase();
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
      const aa = effectiveMatchSchoolName(a,"team1");
      const bb = effectiveMatchSchoolName(b,"team1");
      return aa.localeCompare(bb,"ja") || Number(b.year)-Number(a.year);
    }
    return Number(b.year)-Number(a.year) || (b.date||"").localeCompare(a.date||"") || b._id-a._id;
  });
}


let ledgerLinkRawName = "";
let ledgerLinkEditKey = "";
let ledgerLinkSide = "";

function aliasOwner(raw){
  const name=String(raw||"").trim();
  for(const item of schoolMaster.values()){
    if(item.canonical_name!==name && (item.aliases||[]).includes(name)) return item;
  }
  return null;
}

function specificLinkForRow(r,side){
  const key=matchEditKey(r);
  const mapKey=`${key}|${side}`;
  if(matchTeamLinkMap.size){
    const saved=matchTeamLinkMap.get(mapKey);
    if(saved) return saved;
  }else{
    const saved=(matchEditsState.team_links||[]).find(x=>x.edit_key===key && x.side===side);
    if(saved) return saved;
  }

  const sid=String(r?.[`${side}_school_id`]||"").trim();
  const canonical=String(r?.[`${side}_canonical`]||"").trim();
  if(sid || canonical) return {edit_key:key,side,school_id:sid,canonical_name:canonical};
  return null;
}

function effectiveMatchSchoolUncached(r,side){
  const raw=String(r?.[side]||"").trim();
  const specific=specificLinkForRow(r,side);
  if(specific){
    const byId=specific.school_id ? schoolByIdMap.get(String(specific.school_id)) : null;
    const canonical=byId?.canonical_name || specific.canonical_name || raw;
    return {
      raw,
      canonical,
      school_id:byId?.school_id || specific.school_id || "",
      source:"match"
    };
  }

  const canonical=resolveCanonicalName(raw);
  const rec=schoolMaster.get(canonical);
  return {
    raw,
    canonical,
    school_id:rec?.school_id||"",
    source:canonical!==raw?"alias":"raw"
  };
}

function effectiveMatchSchool(r,side){
  if(identityIndexDirty){
    // During a rebuild, avoid recursive ensure calls.
    return effectiveMatchSchoolUncached(r,side);
  }
  return effectiveMatchSchoolUncached(r,side);
}

function effectiveMatchSchoolName(r,side){
  return effectiveMatchSchool(r,side).canonical;
}

function matchBelongsToSchool(r,side,rec){
  const eff=effectiveMatchSchool(r,side);
  if(rec?.school_id && eff.school_id) return eff.school_id===rec.school_id;
  return eff.canonical===rec?.canonical_name;
}

function ledgerLinkButton(r,side){
  const raw=String(r?.[side]||"").trim();
  const specific=specificLinkForRow(r,side);
  const fallback=resolveCanonicalName(raw);
  const shown=specific?.canonical_name || fallback;
  const linked=Boolean(specific);
  const title=linked
    ? `この試合だけ: ${shown}`
    : (fallback!==raw ? `全体別名の暫定解決: ${fallback} / この試合だけ指定できます` : "この試合だけ現在校へ紐づけ");

  return `<button type="button" class="ledger-link-btn ${linked?"linked specific":""}"
    data-ledger-link-key="${esc(matchEditKey(r))}"
    data-ledger-link-side="${esc(side)}"
    data-ledger-link-raw="${esc(raw)}"
    title="${esc(title)}">
    ${linked?"試合紐付済":"紐づけ"}
  </button>`;
}

function renderLedgerLinkCandidates(query=""){
  const wrap=document.getElementById("ledgerLinkCandidates");
  if(!wrap) return;
  const q=String(query||"").trim().toLowerCase();

  let rows=[...schoolMaster.values()]
    .filter(x=>(x.status||"active")!=="merged")
    .filter(x=>{
      if(!q) return true;
      const hay=[x.canonical_name,x.furigana,x.prefecture,x.district,x.school_id,...(x.aliases||[])].join(" ").toLowerCase();
      return hay.includes(q);
    })
    .sort((a,b)=>{
      const aStarts=q && a.canonical_name.toLowerCase().startsWith(q) ? 0 : 1;
      const bStarts=q && b.canonical_name.toLowerCase().startsWith(q) ? 0 : 1;
      return aStarts-bStarts || a.canonical_name.localeCompare(b.canonical_name,"ja");
    })
    .slice(0,50);

  wrap.innerHTML=rows.map(x=>{
    const c=schoolRowColor(x);
    return `<button type="button" class="ledger-link-candidate" data-link-target="${esc(x.canonical_name)}"
      style="--candidate-bg:${c.bg};--candidate-accent:${c.accent}">
      <span class="candidate-color"></span>
      <span><strong>${esc(x.canonical_name)}</strong>
      <small>${esc(x.district||"")} / ${esc(normalizePrefectureName(x.prefecture)||"")} / ${esc(x.school_id||"")}</small></span>
    </button>`;
  }).join("") || `<div class="school-detail-empty">候補なし</div>`;

  wrap.querySelectorAll("[data-link-target]").forEach(btn=>{
    btn.addEventListener("click",()=>linkLedgerMatchTeam(btn.dataset.linkTarget));
  });
}

function openLedgerSchoolLink(editKey,side,raw){
  ledgerLinkEditKey=String(editKey||"").trim();
  ledgerLinkSide=String(side||"").trim();
  ledgerLinkRawName=String(raw||"").trim();

  const modal=document.getElementById("ledgerSchoolLinkModal");
  const label=document.getElementById("ledgerLinkRawLabel");
  const current=document.getElementById("ledgerLinkCurrent");
  const search=document.getElementById("ledgerLinkSchoolSearch");
  if(!modal||!label||!current||!search) return;

  const row=ledgerMatches.find(x=>matchEditKey(x)===ledgerLinkEditKey);
  const specific=row ? specificLinkForRow(row,ledgerLinkSide) : null;
  const fallback=resolveCanonicalName(ledgerLinkRawName);

  label.textContent=`この試合の${ledgerLinkSide==="team1"?"チーム1":"チーム2"}：${ledgerLinkRawName}`;
  if(specific?.canonical_name){
    current.innerHTML=`現在の試合別紐づけ：<strong>${esc(specific.canonical_name)}</strong>
      <div class="school-meta">この変更はこの試合だけに適用されます。</div>`;
  }else if(fallback!==ledgerLinkRawName){
    current.innerHTML=`現在：<strong>${esc(fallback)}</strong>
      <div class="school-meta">全体別名による暫定解決。ここで選ぶと、この試合専用の紐づけになります。</div>`;
  }else{
    current.innerHTML=`現在の試合別紐づけ：<strong>未設定</strong>
      <div class="school-meta">この試合だけに紐づけます。他の「${esc(ledgerLinkRawName)}」には影響しません。</div>`;
  }

  search.value="";
  renderLedgerLinkCandidates("");
  modal.classList.remove("hidden");
  setTimeout(()=>search.focus(),50);
}

function closeLedgerSchoolLink(){
  document.getElementById("ledgerSchoolLinkModal")?.classList.add("hidden");
  ledgerLinkEditKey="";
  ledgerLinkSide="";
  ledgerLinkRawName="";
}

async function linkLedgerMatchTeam(targetName){
  const target=schoolMaster.get(targetName);
  if(!ledgerLinkEditKey || !ledgerLinkSide || !target) return;

  // IMPORTANT: do not edit global aliases here.
  // This is a per-match/per-side identity override only.
  upsertMatchTeamLink(ledgerLinkEditKey,ledgerLinkSide,target);

  const row=ledgerMatches.find(x=>matchEditKey(x)===ledgerLinkEditKey);
  if(row){
    row[`${ledgerLinkSide}_school_id`]=target.school_id||"";
    row[`${ledgerLinkSide}_canonical`]=target.canonical_name||"";
  }

  closeLedgerSchoolLink();
  renderLedger();
  queueMatchEditsSave(`Link match school: ${ledgerLinkRawName} -> ${target.canonical_name}`);
  showSaveToast(`紐づけ反映：${ledgerLinkRawName} → ${target.canonical_name}`);
}


let activeLedgerEditRow = null;

const PREF_TO_DISTRICT = {
  "北海道":"北海道","青森":"東北","岩手":"東北","宮城":"東北","秋田":"東北","山形":"東北","福島":"東北",
  "茨城":"関東・東京","栃木":"関東・東京","群馬":"関東・東京","埼玉":"関東・東京","千葉":"関東・東京","東京":"関東・東京","神奈川":"関東・東京","山梨":"関東・東京",
  "新潟":"北信越","富山":"北信越","石川":"北信越","福井":"北信越","長野":"北信越",
  "岐阜":"東海","静岡":"東海","愛知":"東海","三重":"東海",
  "滋賀":"近畿","京都":"近畿","大阪":"近畿","兵庫":"近畿","奈良":"近畿","和歌山":"近畿",
  "鳥取":"中国","島根":"中国","岡山":"中国","広島":"中国","山口":"中国",
  "徳島":"四国","香川":"四国","愛媛":"四国","高知":"四国",
  "福岡":"九州","佐賀":"九州","長崎":"九州","熊本":"九州","大分":"九州","宮崎":"九州","鹿児島":"九州","沖縄":"九州"
};
const DISTRICT_TO_REGION = {
  "北海道":"hokkaido","東北":"tohoku","関東・東京":"kanto_tokyo","北信越":"hokushinetsu",
  "東海":"tokai","近畿":"kinki","中国":"chugoku","四国":"shikoku","九州":"kyushu"
};

function refreshSchoolMasterDatalist(){
  const dl=document.getElementById("schoolMasterDatalist");
  if(!dl) return;
  dl.innerHTML=[...schoolMaster.values()]
    .filter(x=>(x.status||"active")!=="merged")
    .sort((a,b)=>a.canonical_name.localeCompare(b.canonical_name,"ja"))
    .map(x=>`<option value="${esc(x.canonical_name)}">${esc(x.prefecture||"")} / ${esc(x.school_id||"")}</option>`)
    .join("");
}

function schoolRecordByNameOrId(value){
  const v=String(value||"").trim();
  if(!v) return null;
  if(schoolMaster.has(v)) return schoolMaster.get(v);
  for(const x of schoolMaster.values()){
    if(x.school_id===v || (x.aliases||[]).includes(v)) return x;
  }
  return null;
}

function inningBadge(r){
  const n=Number(r.innings);
  const f=String(r.finish_type||"").toLowerCase();
  const factor=inningFactor(n,f);
  if(!Number.isFinite(n)||n<=0) return "";
  if(n===9 && (f==="normal"||!f)) return "";
  const label=f==="cold"?`${n}回C`:n>9?`延長${n}`:`${n}回`;
  return `<span class="inning-badge ${factor>1?"boost":factor<1?"reduce":""}" title="イニング係数 ${factor.toFixed(2)}">${esc(label)}<small>×${factor.toFixed(2)}</small></span>`;
}

function openManualMatchModal(){
  refreshSchoolMasterDatalist();
  const now=new Date();
  document.getElementById("manualYear").value=now.getFullYear();
  document.getElementById("manualDate").value="";
  document.getElementById("manualTeam1").value="";
  document.getElementById("manualTeam2").value="";
  document.getElementById("manualScore1").value="";
  document.getElementById("manualScore2").value="";
  document.getElementById("manualTournament").value="";
  document.getElementById("manualRound").value="";
  document.getElementById("manualInnings").value="9";
  document.getElementById("manualFinish").value="normal";
  document.getElementById("manualSourceUrl").value="";
  document.getElementById("manualNote").value="";
  document.getElementById("manualMatchModal")?.classList.remove("hidden");
}
function closeManualMatchModal(){ document.getElementById("manualMatchModal")?.classList.add("hidden"); }

async function saveManualMatch(){
  const team1=document.getElementById("manualTeam1").value.trim();
  const team2=document.getElementById("manualTeam2").value.trim();
  const s1=Number(document.getElementById("manualScore1").value);
  const s2=Number(document.getElementById("manualScore2").value);
  const year=document.getElementById("manualYear").value.trim();
  const season=document.getElementById("manualSeason").value;
  const tournament=document.getElementById("manualTournament").value.trim();
  const date=document.getElementById("manualDate").value;
  if(!year||!season||!tournament||!date||!team1||!team2||!Number.isFinite(s1)||!Number.isFinite(s2)){
    alert("年度・季節・大会・日付・両校・得点は必須です。"); return;
  }
  const id=`MAN-${Date.now()}`;
  const level=document.getElementById("manualLevel").value;
  const noteExtra=document.getElementById("manualNote").value.trim();
  const note=[`level=${level}`,"manual=1",noteExtra].filter(Boolean).join(";");
  const row={
    manual_id:id,edit_key:id,year,season,
    region:document.getElementById("manualRegion").value,
    prefecture:document.getElementById("manualPref").value.trim(),
    tournament,round:document.getElementById("manualRound").value.trim(),date,
    team1,score1:s1,team2,score2:s2,
    innings:Number(document.getElementById("manualInnings").value)||"",
    finish_type:document.getElementById("manualFinish").value,
    source_url:document.getElementById("manualSourceUrl").value.trim(),
    note
  };
  matchEditsState.manual_matches.push(row);
  const nr=normalizeRows([row])[0];
  if(nr){
    allMatches.push(nr);
    ledgerMatches.push({...nr,_id:ledgerMatches.length});
    detectedSchoolGeo=buildSchoolMeta(allMatches);
  }
  closeManualMatchModal();
  renderLedger();
  queueMatchEditsSave(`Add manual match: ${team1} ${s1}-${s2} ${team2}`);
  showSaveToast(`試合追加：${team1} ${s1}-${s2} ${team2}`);
}

function openLedgerEdit(r){
  activeLedgerEditRow=r;
  refreshSchoolMasterDatalist();
  const key=matchEditKey(r);
  document.getElementById("ledgerEditKeyLabel").textContent=`編集キー: ${key}`;
  const vals={
    editMatchYear:r.year,editMatchSeason:r.season,editMatchLevel:r.level,editMatchRegion:r.region,
    editMatchPref:r.prefecture,editMatchDate:r.date,editMatchTournament:r.tournament,editMatchRound:r.round,
    editMatchInnings:r.innings||"",editMatchFinish:r.finish_type||"normal",
    editMatchTeam1:r.team1,editMatchScore1:r.score1,editMatchCanonical1:r.team1_canonical||"",
    editMatchTeam2:r.team2,editMatchScore2:r.score2,editMatchCanonical2:r.team2_canonical||"",
    editMatchSourceUrl:r.source_url||"",editMatchNote:r.note||""
  };
  for(const [id,v] of Object.entries(vals)){ const el=document.getElementById(id); if(el) el.value=v??""; }
  document.getElementById("ledgerEditModal")?.classList.remove("hidden");
}
function closeLedgerEdit(){ document.getElementById("ledgerEditModal")?.classList.add("hidden"); activeLedgerEditRow=null; }

async function saveLedgerEdit(){
  const r=activeLedgerEditRow; if(!r) return;
  const key=matchEditKey(r);
  const level=document.getElementById("editMatchLevel").value;
  const note=setNoteLevel(document.getElementById("editMatchNote").value.trim(),level);
  const changes={
    year:document.getElementById("editMatchYear").value.trim(),
    season:document.getElementById("editMatchSeason").value.trim(),
    region:document.getElementById("editMatchRegion").value.trim(),
    prefecture:document.getElementById("editMatchPref").value.trim(),
    date:document.getElementById("editMatchDate").value,
    tournament:document.getElementById("editMatchTournament").value.trim(),
    round:document.getElementById("editMatchRound").value.trim(),
    innings:Number(document.getElementById("editMatchInnings").value)||"",
    finish_type:document.getElementById("editMatchFinish").value,
    team1:document.getElementById("editMatchTeam1").value.trim(),
    score1:Number(document.getElementById("editMatchScore1").value),
    team2:document.getElementById("editMatchTeam2").value.trim(),
    score2:Number(document.getElementById("editMatchScore2").value),
    source_url:document.getElementById("editMatchSourceUrl").value.trim(),
    note
  };
  upsertMatchOverride(key,changes);

  const c1=schoolRecordByNameOrId(document.getElementById("editMatchCanonical1").value);
  const c2=schoolRecordByNameOrId(document.getElementById("editMatchCanonical2").value);
  if(c1) upsertMatchTeamLink(key,"team1",c1);
  if(c2) upsertMatchTeamLink(key,"team2",c2);

  Object.assign(r,changes,{
    level,
    edit_key:key,
    team1_school_id:c1?.school_id||r.team1_school_id||"",
    team1_canonical:c1?.canonical_name||r.team1_canonical||"",
    team2_school_id:c2?.school_id||r.team2_school_id||"",
    team2_canonical:c2?.canonical_name||r.team2_canonical||""
  });
  closeLedgerEdit();
  buildFastIndexes();
  renderLedger();
  queueMatchEditsSave(`Edit match ledger: ${changes.team1} ${changes.score1}-${changes.score2} ${changes.team2}`);
  showSaveToast("対戦台帳を反映しました");
}

function effectiveSchoolRecordForMatch(r,side){
  const sid=String(r[`${side}_school_id`]||"").trim();
  if(sid){
    for(const x of schoolMaster.values()) if(x.school_id===sid) return x;
  }
  const canonical=String(r[`${side}_canonical`]||"").trim() || resolveCanonicalName(r[side]);
  return schoolMaster.get(canonical)||null;
}

function idPrefectureConflicts(){
  const map=new Map();
  for(const r of ledgerMatches){
    if(r.level!=="prefecture") continue;
    const pref=normalizePrefectureName(r.prefecture);
    if(!pref) continue;
    for(const side of ["team1","team2"]){
      const rec=effectiveSchoolRecordForMatch(r,side);
      if(!rec?.school_id) continue;
      if(!map.has(rec.school_id)) map.set(rec.school_id,{school:rec,prefs:new Map()});
      const x=map.get(rec.school_id);
      const arr=x.prefs.get(pref)||[];
      arr.push({r,side});
      x.prefs.set(pref,arr);
    }
  }
  return [...map.values()].filter(x=>x.prefs.size>=2)
    .sort((a,b)=>b.prefs.size-a.prefs.size || a.school.canonical_name.localeCompare(b.school.canonical_name,"ja"));
}

function openIdAudit(){
  const body=document.getElementById("idAuditBody");
  const rows=idPrefectureConflicts();
  body.innerHTML=rows.length ? rows.map((x,xi)=>`
    <div class="id-audit-item">
      <div class="id-audit-title"><strong>${esc(x.school.canonical_name)}</strong><span class="id-badge">${esc(x.school.school_id)}</span>
      <span class="audit-danger">${x.prefs.size}県で検出</span></div>
      <div class="id-audit-prefs">
        ${[...x.prefs.entries()].map(([pref,matches])=>`
          <div class="id-audit-pref">
            <span><strong>${esc(pref)}</strong>　${matches.length}件</span>
            <button class="ghost" data-audit-show="${xi}" data-audit-pref="${esc(pref)}">台帳で確認</button>
            <button class="ghost" data-audit-split="${xi}" data-audit-pref="${esc(pref)}">この県を新IDへ分離</button>
          </div>`).join("")}
      </div>
    </div>`).join("") : `<div class="empty-state"><h3>複数県IDは検出されませんでした</h3><p>県大会階層で同じschool_idが2県以上に出るものを監査しています。</p></div>`;

  body.querySelectorAll("[data-audit-show]").forEach(btn=>btn.addEventListener("click",()=>{
    const x=rows[Number(btn.dataset.auditShow)];
    document.getElementById("idAuditModal").classList.add("hidden");
    document.querySelector('[data-view="ledger"]')?.click();
    const pref=btn.dataset.auditPref;
    const pf=document.getElementById("ledgerPref");
    if([...pf.options].some(o=>o.value===pref)) pf.value=pref;
    document.getElementById("ledgerScope").value="prefecture";
    document.getElementById("ledgerSchool").value=x.school.canonical_name;
    ledgerPage=1; renderLedger();
  }));
  body.querySelectorAll("[data-audit-split]").forEach(btn=>btn.addEventListener("click",async()=>{
    const x=rows[Number(btn.dataset.auditSplit)];
    const pref=btn.dataset.auditPref;
    await splitAuditPrefecture(x,pref);
    openIdAudit();
  }));
  document.getElementById("idAuditModal")?.classList.remove("hidden");
}

async function splitAuditPrefecture(conflict,pref){
  const base=conflict.school;
  const rootName=String(base.canonical_name||"").replace(/(?:（[^（）]+）)+$/,"") || base.canonical_name;
  const defaultName=`${rootName}（${pref}）`;
  const newName=prompt(`${pref}分を別学校IDへ分離します。\n新しい表示名を確認してください。`,defaultName);
  if(!newName) return;
  if(schoolMaster.has(newName)){ alert("その表示名は既に存在します。"); return; }

  const district=PREF_TO_DISTRICT[pref]||base.district||"不明";
  const newId=provisionalSchoolId(newName,district,pref,"00");
  const rec={
    ...base,school_id:newId,canonical_name:newName,district,prefecture:pref,
    local_district:"",local_district_id:"",
    representative_area:"",representative_area_id:"",
    aliases:[newName],status:"active",successor_id:""
  };
  schoolMaster.set(newName,rec);

  let count=0;
  const matchSet=conflict.prefs.get(pref)||[];
  for(const {r,side} of matchSet){
    upsertMatchTeamLink(matchEditKey(r),side,rec);
    r[`${side}_school_id`]=newId;
    r[`${side}_canonical`]=newName;
    count++;
  }
  saveMasterToStorage();
  try{
    await pushSharedMasterToGitHub(`Split duplicate school ID: ${base.canonical_name} / ${pref}`);
    await pushMatchEditsShared(`Link ${count} prefecture matches to ${newName}`);
    renderMasterTable(); renderLedger();
    showSaveDialog(`${pref}分を新IDへ分離しました\n${newName}\n${newId}\n県大会 ${count}件を紐づけました\n\n地区大会・全国大会は台帳編集から必要な試合だけ紐づけてください`);
  }catch(err){
    showSaveDialog(`端末内では分離しましたがGitHub保存に失敗しました\n${err.message}`);
  }
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
      <td>${inningBadge(r)}</td>
      <td class="ledger-team-cell">${teamNameWithColors(effectiveMatchSchoolName(r,"team1"),"ledger-team-name")}
        ${ledgerLinkButton(r,"team1")}
        ${effectiveMatchSchool(r,"team1").canonical!==r.team1
          ? `<div class="school-meta">${effectiveMatchSchool(r,"team1").source==="match"?"試合別":"全体別名"}: ${esc(r.team1)} → ${esc(effectiveMatchSchool(r,"team1").canonical)}</div>`:""}</td>
      <td class="ledger-score-cell">${r.score1}</td>
      <td class="ledger-team-cell">${teamNameWithColors(effectiveMatchSchoolName(r,"team2"),"ledger-team-name")}
        ${ledgerLinkButton(r,"team2")}
        ${effectiveMatchSchool(r,"team2").canonical!==r.team2
          ? `<div class="school-meta">${effectiveMatchSchool(r,"team2").source==="match"?"試合別":"全体別名"}: ${esc(r.team2)} → ${esc(effectiveMatchSchool(r,"team2").canonical)}</div>`:""}</td>
      <td class="ledger-score-cell">${r.score2}</td>
      <td>${ev ? `${fmtR(ev.team1_rating_before)}<div class="school-meta">${fmtR(ev.team2_rating_before)}</div>` : "-"}</td>
      <td>${ev ? `${(Number(ev.team1_expected)*100).toFixed(1)}%<div class="school-meta">${(Number(ev.team2_expected)*100).toFixed(1)}%</div>` : "-"}</td>
      <td>${ev ? `<span class="${Number(ev.team1_delta)>=0?"rating-up":"rating-down"}">${fmtDelta(ev.team1_delta)}</span><div class="school-meta ${Number(ev.team2_delta)>=0?"rating-up":"rating-down"}">${fmtDelta(ev.team2_delta)}</div>` : "-"}</td>
      <td>${ev ? `${fmtR(ev.team1_rating_after)}<div class="school-meta">${fmtR(ev.team2_rating_after)}</div>` : "-"}</td>
      <td>${source}</td>
      <td><button type="button" class="row-edit-btn ledger-edit-btn" data-ledger-edit-key="${esc(matchEditKey(r))}">編集</button></td>
    </tr>`;
  }).join("");

  tbody.querySelectorAll("[data-ledger-edit-key]").forEach(btn=>{
    btn.addEventListener("click",(e)=>{
      e.preventDefault(); e.stopPropagation();
      const key=btn.dataset.ledgerEditKey;
      const row=ledgerMatches.find(x=>matchEditKey(x)===key);
      if(row) openLedgerEdit(row);
    });
  });

  tbody.querySelectorAll("[data-ledger-link-key]").forEach(btn=>{
    btn.addEventListener("click",(e)=>{
      e.preventDefault();
      e.stopPropagation();
      openLedgerSchoolLink(
        btn.dataset.ledgerLinkKey,
        btn.dataset.ledgerLinkSide,
        btn.dataset.ledgerLinkRaw
      );
    });
  });
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

  document.getElementById("addManualMatchBtn")?.addEventListener("click",openManualMatchModal);
  document.getElementById("closeManualMatchBtn")?.addEventListener("click",closeManualMatchModal);
  document.getElementById("manualMatchModal")?.addEventListener("click",e=>{if(e.target.id==="manualMatchModal") closeManualMatchModal();});
  document.getElementById("saveManualMatchBtn")?.addEventListener("click",saveManualMatch);

  document.getElementById("closeLedgerEditBtn")?.addEventListener("click",closeLedgerEdit);
  document.getElementById("ledgerEditModal")?.addEventListener("click",e=>{if(e.target.id==="ledgerEditModal") closeLedgerEdit();});
  document.getElementById("saveLedgerEditBtn")?.addEventListener("click",saveLedgerEdit);

  document.getElementById("openIdAuditBtn")?.addEventListener("click",openIdAudit);
  document.getElementById("closeIdAuditBtn")?.addEventListener("click",()=>document.getElementById("idAuditModal")?.classList.add("hidden"));
  document.getElementById("idAuditModal")?.addEventListener("click",e=>{if(e.target.id==="idAuditModal") e.target.classList.add("hidden");});

  document.getElementById("closeLedgerSchoolLinkBtn")?.addEventListener("click",closeLedgerSchoolLink);
  document.getElementById("ledgerSchoolLinkModal")?.addEventListener("click",e=>{
    if(e.target.id==="ledgerSchoolLinkModal") closeLedgerSchoolLink();
  });
  document.getElementById("ledgerLinkSchoolSearch")?.addEventListener("input",
    debounce(e=>renderLedgerLinkCandidates(e.target.value),120)
  );

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
      document.getElementById("importView")?.classList.toggle("hidden", view!=="import");
      try{
        if(view==="master") renderMasterTable();
        if(view==="import") loadImportAudit();
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
  markIdentityIndexesDirty();
  renderMasterTable();
  updateBulkMergeBar();
  queueSharedMasterSave(`Bulk merge ${sources.length} IDs -> ${dest.canonical_name}`);
  showSaveToast(`${sources.length}件を ${dest.canonical_name} へ統合しました`);
}


const PREFECTURE_ROW_COLORS = {"北海道": "#fff0a8", "青森": "#dbe9ff", "岩手": "#d5e5ff", "宮城": "#cfe1ff", "秋田": "#c9ddff", "山形": "#c3d9ff", "福島": "#bdd5ff", "茨城": "#d9f3df", "栃木": "#d4f0dc", "群馬": "#cfedd9", "埼玉": "#caead6", "千葉": "#c5e7d3", "東京": "#c0e4d0", "神奈川": "#bbe1cd", "山梨": "#b6dec9", "新潟": "#eadcff", "富山": "#e6d6ff", "石川": "#e2d0ff", "福井": "#decbff", "長野": "#dac5ff", "岐阜": "#ffe1c1", "静岡": "#ffdab4", "愛知": "#ffd3a7", "三重": "#ffcc9a", "滋賀": "#ffd7dc", "京都": "#ffd0d8", "大阪": "#ffc9d4", "兵庫": "#ffc2d0", "奈良": "#ffbbcc", "和歌山": "#ffb4c8", "鳥取": "#d2f1ef", "島根": "#c9eeec", "岡山": "#c0ebe9", "広島": "#b7e8e6", "山口": "#aee5e3", "徳島": "#e1f4c5", "香川": "#d9f0bb", "愛媛": "#d1ecb1", "高知": "#c9e8a7", "福岡": "#f2d1ea", "佐賀": "#efcbe6", "長崎": "#ecc5e2", "熊本": "#e9bfde", "大分": "#e6b9da", "宮崎": "#e3b3d6", "鹿児島": "#e0add2", "沖縄": "#dda7ce", "北北海道": "#ffe792", "南北海道": "#fff3b5", "東東京": "#b5e6c6", "西東京": "#c9efd5"};
const PREFECTURE_ROW_ACCENTS = {"北海道": "#c49a00", "青森": "#2f67b1", "岩手": "#356fbb", "宮城": "#3b77c5", "秋田": "#417fcf", "山形": "#4787d9", "福島": "#4d8fe3", "茨城": "#2f8c48", "栃木": "#368f4e", "群馬": "#3d9254", "埼玉": "#44955a", "千葉": "#4b9860", "東京": "#529b66", "神奈川": "#599e6c", "山梨": "#60a172", "新潟": "#7749ad", "富山": "#7e51b5", "石川": "#8559bd", "福井": "#8c61c5", "長野": "#9369cd", "岐阜": "#ba681c", "静岡": "#c0711f", "愛知": "#c67a22", "三重": "#cc8325", "滋賀": "#b74357", "京都": "#bd495e", "大阪": "#c34f65", "兵庫": "#c9556c", "奈良": "#cf5b73", "和歌山": "#d5617a", "鳥取": "#237f7b", "島根": "#298783", "岡山": "#2f8f8b", "広島": "#359793", "山口": "#3b9f9b", "徳島": "#5d8e2d", "香川": "#659633", "愛媛": "#6d9e39", "高知": "#75a63f", "福岡": "#9c4a88", "佐賀": "#a25290", "長崎": "#a95a98", "熊本": "#b062a0", "大分": "#b76aa8", "宮崎": "#be72b0", "鹿児島": "#c57ab8", "沖縄": "#cc82c0", "北北海道": "#b88a00", "南北海道": "#c5a000", "東東京": "#2f8b4b", "西東京": "#459b5c"};

function normalizePrefectureName(pref){
  let p = String(pref||"").replace(/[　\s]+/g,"").trim();
  if(!p) return "";
  if(["北北海道","南北海道","東東京","西東京"].includes(p)) return p;

  // Be tolerant of values such as 京都府 / 京都府大会 / 島根県大会.
  const names = [
    "北海道","青森","岩手","宮城","秋田","山形","福島",
    "茨城","栃木","群馬","埼玉","千葉","東京","神奈川","山梨",
    "新潟","富山","石川","福井","長野","岐阜","静岡","愛知","三重",
    "滋賀","京都","大阪","兵庫","奈良","和歌山",
    "鳥取","島根","岡山","広島","山口","徳島","香川","愛媛","高知",
    "福岡","佐賀","長崎","熊本","大分","宮崎","鹿児島","沖縄"
  ];
  const stripped=p.replace(/(都|府|県)$/,"");
  if(names.includes(stripped)) return stripped;
  const hit=names.find(n=>p.includes(n));
  return hit || stripped;
}

function detectedGeoForSchool(x){
  const names = [x.canonical_name, ...(x.aliases||[])];
  for(const name of names){
    const hit = detectedSchoolGeo.get(name);
    if(hit) return hit;
  }
  return null;
}

function schoolColorKey(x){
  // school_master_shared.json の都道府県を最優先。
  // ID分岐後は旧校のalias/履歴/代表区分の色を引きずらない。
  const direct = normalizePrefectureName(x?.prefecture);
  const rep = String(x?.representative_area||"").trim();

  if(direct && direct!=="不明"){
    // 北海道・東京だけは恒久的な北/南・東/西区分を許可。
    if(direct==="北海道" && ["北北海道","南北海道"].includes(rep)) return rep;
    if(direct==="東京" && ["東東京","西東京"].includes(rep)) return rep;
    if(PREFECTURE_ROW_COLORS[direct]) return direct;
  }

  const detected = detectedGeoForSchool(x||{});
  const fallback = normalizePrefectureName(detected?.prefecture||"");
  if(PREFECTURE_ROW_COLORS[fallback]) return fallback;
  return direct || fallback || "";
}


const REGION_BAR_COLORS = {
  "北海道":"#d1a800",
  "東北":"#356fb8",
  "関東・東京":"#3f9457",
  "北信越":"#8559bd",
  "東海":"#c67622",
  "近畿":"#c94f65",
  "中国":"#2f8f8b",
  "四国":"#6d9e39",
  "九州":"#b062a0",
  "national":"#60656d"
};

function normalizeRegionLabel(region){
  const r = String(region||"").trim();
  return REGION_LABEL[r] || r || "";
}

function teamGeo(teamName){
  const canonical = resolveCanonicalName(teamName);
  const rec = schoolMaster.get(canonical);
  const detected = detectedSchoolGeo.get(teamName) || detectedSchoolGeo.get(canonical) || null;

  let pref = normalizePrefectureName(rec?.prefecture || detected?.prefecture || "");
  let region = rec?.district || detected?.district || "";
  if(!region){
    // infer district from prefecture palette grouping
    const groups = {
      "北海道":["北海道","北北海道","南北海道"],
      "東北":["青森","岩手","宮城","秋田","山形","福島"],
      "関東・東京":["茨城","栃木","群馬","埼玉","千葉","東京","神奈川","山梨","東東京","西東京"],
      "北信越":["新潟","富山","石川","福井","長野"],
      "東海":["岐阜","静岡","愛知","三重"],
      "近畿":["滋賀","京都","大阪","兵庫","奈良","和歌山"],
      "中国":["鳥取","島根","岡山","広島","山口"],
      "四国":["徳島","香川","愛媛","高知"],
      "九州":["福岡","佐賀","長崎","熊本","大分","宮崎","鹿児島","沖縄"]
    };
    for(const [g,ps] of Object.entries(groups)){
      if(ps.includes(pref)){ region=g; break; }
    }
  }

  const x = rec || {canonical_name:canonical,prefecture:pref,district:region,representative_area:""};
  const color = schoolRowColor(x);
  return {
    canonical,
    prefecture:pref,
    region,
    prefBg:color.bg,
    prefAccent:color.accent,
    regionColor:REGION_BAR_COLORS[region] || "#8b929b"
  };
}

function teamNameWithColors(name, extraClass=""){
  const g = teamGeo(name);
  return `<span class="team-color-name ${extraClass}" style="--region-color:${g.regionColor};--pref-bg:${g.prefBg};--pref-accent:${g.prefAccent}">
    <span class="team-region-strip" title="${esc(g.region||"地区不明")}"></span>
    <span class="team-pref-strip" title="${esc(g.prefecture||"県不明")}"></span>
    <span class="team-name-text">${esc(g.canonical)}</span>
  </span>`;
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
      <td class="school-detail-cell"><strong>${esc(x.canonical_name)}</strong><span class="detail-hint">履歴</span></td>
      <td>${esc(x.furigana||"")}</td>
      <td>${esc(x.district||"")}</td>
      <td><span class="pref-color-dot" style="--dot:${rowColor.accent}"></span>${esc(x.prefecture||detectedGeoForSchool(x)?.prefecture||"")}</td>
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
      if(e.target.closest(".school-select") || e.target.closest(".row-edit-btn") || e.target.closest(".rating-history-btn")) return;
      openSchoolMasterDetail(tr.dataset.name);
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



function ratingHistoryForSchool(name){
  return schoolEventsFor(name);
}

function schoolMatchRows(name){
  const rec=schoolMaster.get(name);
  if(!rec) return [];
  ensureIdentityIndexes();
  const key=rec.school_id?`id:${rec.school_id}`:`name:${rec.canonical_name}`;
  return [...(schoolMatchCache.get(key)||[])].sort((a,b)=>{
    const da=String(a.date||"");
    const db=String(b.date||"");
    return db.localeCompare(da);
  });
}

function schoolResultFor(r,name){
  const rec=schoolMaster.get(name);
  const is1=matchBelongsToSchool(r,"team1",rec);
  const sf=Number(is1?r.score1:r.score2);
  const sa=Number(is1?r.score2:r.score1);
  const oppSide=is1?"team2":"team1";
  const opp=effectiveMatchSchoolName(r,oppSide);
  let result="-";
  if(Number.isFinite(sf)&&Number.isFinite(sa)){
    result=sf>sa?"○":sf<sa?"●":"△";
  }
  return {opp,sf,sa,result};
}

function schoolMatchSideForRecord(r,rec){
  if(matchBelongsToSchool(r,"team1",rec)) return "team1";
  if(matchBelongsToSchool(r,"team2",rec)) return "team2";
  return "";
}

function schoolDetailTargetOptions(currentName){
  return [...schoolMaster.values()]
    .filter(x=>(x.status||"active")!=="merged" && x.canonical_name!==currentName)
    .sort((a,b)=>a.canonical_name.localeCompare(b.canonical_name,"ja"))
    .map(x=>`<option value="${esc(x.canonical_name)}">${esc(x.canonical_name)} / ${esc(x.prefecture||"")} / ${esc(x.school_id||"")}</option>`)
    .join("");
}

function selectedSchoolDetailMatches(){
  return [...document.querySelectorAll("#schoolMasterDetailBody [data-history-select]:checked")]
    .map(cb=>({key:cb.dataset.historySelect,side:cb.dataset.historySide}))
    .filter(x=>x.key&&x.side);
}

function updateSchoolDetailSelectionCount(){
  const n=selectedSchoolDetailMatches().length;
  const el=document.getElementById("schoolDetailSelectedCount");
  if(el) el.textContent=`${n}試合選択`;
  const move=document.getElementById("moveSelectedHistoryBtn");
  const branch=document.getElementById("branchSelectedHistoryBtn");
  if(move) move.disabled=n===0;
  if(branch) branch.disabled=n===0;
}

function selectSchoolDetailByPref(pref){
  document.querySelectorAll("#schoolMasterDetailBody [data-history-select]").forEach(cb=>{
    cb.checked=String(cb.dataset.historyPref||"")===String(pref||"");
  });
  updateSchoolDetailSelectionCount();
}

function clearSchoolDetailSelection(){
  document.querySelectorAll("#schoolMasterDetailBody [data-history-select]").forEach(cb=>cb.checked=false);
  updateSchoolDetailSelectionCount();
}

async function assignSelectedHistoryToSchool(sourceName,targetName){
  const target=schoolMaster.get(targetName);
  if(!target){ alert("移動先の学校を選択してください。"); return; }
  const selected=selectedSchoolDetailMatches();
  if(!selected.length){ alert("試合を選択してください。"); return; }

  let moved=0;
  for(const sel of selected){
    upsertMatchTeamLink(sel.key,sel.side,target);
    const row=ledgerMatches.find(r=>matchEditKey(r)===sel.key) || allMatches.find(r=>matchEditKey(r)===sel.key);
    if(row){
      row[`${sel.side}_school_id`]=target.school_id||"";
      row[`${sel.side}_canonical`]=target.canonical_name||"";
      moved++;
    }
  }

  try{
    await pushMatchEditsShared(`Move ${moved} match histories: ${sourceName} -> ${target.canonical_name}`);
    buildFastIndexes();
    renderLedger();
    openSchoolMasterDetail(sourceName);
    showSaveDialog(
      `${moved}試合を ${target.canonical_name} へ移しました\n\n`+
      `この変更は選択した試合だけに適用されます。\nRatingは約45秒後に自動再計算されます`
    );
  }catch(err){
    showSaveDialog(`試合履歴の移動保存に失敗しました\n${err.message}`);
  }
}

async function branchSelectedHistoryFromSchool(sourceName){
  const source=schoolMaster.get(sourceName);
  if(!source) return;
  const selected=selectedSchoolDetailMatches();
  if(!selected.length){ alert("分岐する試合を選択してください。"); return; }

  const rows=selected.map(sel=>ledgerMatches.find(r=>matchEditKey(r)===sel.key) || allMatches.find(r=>matchEditKey(r)===sel.key)).filter(Boolean);
  const prefs=uniq(rows.map(r=>normalizePrefectureName(r.prefecture)).filter(Boolean));
  const detectedPref=prefs.length===1 ? prefs[0] : "";
  const rootName=String(source.canonical_name||"").replace(/(?:（[^（）]+）)+$/,"") || source.canonical_name;
  const suggested=detectedPref ? `${rootName}（${detectedPref}）` : `${rootName}（分岐）`;

  const newName=prompt(
    `${selected.length}試合を新しい学校IDへ分岐します。\n新しい表示名を入力してください。`,
    suggested
  );
  if(!newName) return;
  if(schoolMaster.has(newName)){
    alert("その表示名は既に存在します。既存校へ移す場合は「選択試合を既存IDへ移動」を使ってください。");
    return;
  }

  const pref=prompt("新しい学校の都道府県を入力してください。",detectedPref||source.prefecture||"")?.trim();
  if(!pref) return;
  const district=PREF_TO_DISTRICT[pref]||source.district||"不明";
  const newId=provisionalSchoolId(newName,district,pref,"00");

  const rec={
    ...source,
    school_id:newId,
    canonical_name:newName,
    district,
    prefecture:pref,
    local_district:"",
    local_district_id:"",
    representative_area:"",
    representative_area_id:"",
    aliases:[newName],
    status:"active",
    successor_id:""
  };
  schoolMaster.set(newName,rec);

  let moved=0;
  for(const sel of selected){
    upsertMatchTeamLink(sel.key,sel.side,rec);
    const row=ledgerMatches.find(r=>matchEditKey(r)===sel.key) || allMatches.find(r=>matchEditKey(r)===sel.key);
    if(row){
      row[`${sel.side}_school_id`]=newId;
      row[`${sel.side}_canonical`]=newName;
      moved++;
    }
  }

  saveMasterToStorage();

  try{
    await pushSharedMasterToGitHub(`Create split school from match history: ${newName}`);
    await pushMatchEditsShared(`Branch ${moved} match histories: ${sourceName} -> ${newName}`);
    renderMasterTable();
    buildFastIndexes();
    renderLedger();
    openSchoolMasterDetail(newName);
    showSaveDialog(
      `新しい学校IDへ分岐しました\n\n${newName}\n${newId}\n${moved}試合を移動\n\n`+
      `元の ${sourceName} には選択しなかった試合だけ残ります。\nRatingは約45秒後に自動再計算されます`
    );
  }catch(err){
    showSaveDialog(`端末内では分岐しましたがGitHub保存に失敗しました\n${err.message}`);
  }
}

function openSchoolMasterDetail(name){
  const rec=schoolMaster.get(name);
  if(!rec) return;
  const modal=document.getElementById("schoolMasterDetailModal");
  const title=document.getElementById("schoolMasterDetailTitle");
  const meta=document.getElementById("schoolMasterDetailMeta");
  const body=document.getElementById("schoolMasterDetailBody");
  if(!modal||!title||!meta||!body) return;

  const matches=schoolMatchRows(name);
  const ratingRows=ratingHistoryForSchool(name);
  const current=serverRatingForSchool(name);

  title.textContent=rec.canonical_name;
  meta.textContent=`${rec.district||"-"} / ${rec.prefecture||"-"} / ${rec.school_id||"-"} / 試合履歴からIDを直接修正`;

  const prefCounts=new Map();
  matches.forEach(r=>{
    const p=normalizePrefectureName(r.prefecture)||"県不明";
    prefCounts.set(p,(prefCounts.get(p)||0)+1);
  });
  const prefButtons=[...prefCounts.entries()]
    .sort((a,b)=>b[1]-a[1])
    .map(([p,n])=>`<button type="button" class="history-pref-chip" data-history-pref-pick="${esc(p)}">${esc(p)} ${n}</button>`)
    .join("");

  const ratingHtml = ratingRows.length ? `
    <div class="school-detail-section">
      <div class="school-detail-section-head">
        <h4>Rating履歴</h4>
        <span>${ratingRows.length}件</span>
      </div>
      <div class="school-detail-rating-list">
        ${ratingRows.slice().reverse().slice(0,80).map(r=>{
          const before=Number(r.rating_before ?? r.before_rating ?? r.before);
          const after=Number(r.rating_after ?? r.after_rating ?? r.after);
          const delta=Number(r.delta ?? r.rating_delta ?? (after-before));
          const opponent=r.opponent || r.opponent_name || "";
          return `<div class="school-detail-rating-row">
            <span class="detail-date">${esc(r.date||"")}</span>
            <span>${esc(opponent)}</span>
            <span class="detail-rating">${Number.isFinite(after)?Math.round(after):"-"}</span>
            <span class="${delta>0?"pos":delta<0?"neg":""}">${Number.isFinite(delta)?`${delta>0?"+":""}${delta.toFixed(2)}`:"-"}</span>
          </div>`;
        }).join("")}
      </div>
    </div>` : `
    <div class="school-detail-section">
      <div class="school-detail-section-head"><h4>Rating履歴</h4></div>
      <p class="school-detail-empty">Rating履歴データなし</p>
    </div>`;

  const matchHtml = `
    <div class="school-detail-section school-history-editor">
      <div class="school-detail-section-head">
        <h4>対戦履歴・ID割当</h4>
        <span>${matches.length}試合</span>
      </div>

      <div class="history-id-toolbar">
        <div class="history-pref-picks">
          <span>県で選択：</span>${prefButtons || "<span>-</span>"}
          <button type="button" class="ghost compact" id="clearHistorySelectionBtn">選択解除</button>
        </div>
        <div class="history-id-actions">
          <span id="schoolDetailSelectedCount">0試合選択</span>
          <select id="historyTargetSchool">
            <option value="">既存IDへ移動先を選択</option>
            ${schoolDetailTargetOptions(name)}
          </select>
          <button type="button" class="ghost" id="moveSelectedHistoryBtn" disabled>選択試合を既存IDへ移動</button>
          <button type="button" class="save-btn" id="branchSelectedHistoryBtn" disabled>選択試合から新ID分岐</button>
        </div>
        <p class="history-id-note">
          ここでの変更は <strong>選択した試合だけ</strong> に適用します。
          同じ「金沢」という表記の別試合は動きません。
        </p>
      </div>

      <div class="school-detail-match-list">
        ${matches.slice(0,200).map(r=>{
          const x=schoolResultFor(r,name);
          const side=schoolMatchSideForRecord(r,rec);
          const key=matchEditKey(r);
          const pref=normalizePrefectureName(r.prefecture)||"県不明";
          const eff=effectiveMatchSchool(r,side);
          return `<div class="school-detail-match-row history-edit-row">
            <label class="history-check">
              <input type="checkbox" data-history-select="${esc(key)}" data-history-side="${esc(side)}" data-history-pref="${esc(pref)}">
            </label>
            <span class="detail-date">${esc(r.date||"")}</span>
            <span class="detail-stage">
              ${esc(r.year||"")} ${esc(seasonLabel(r.season||""))} / ${esc(r.tournament||"")} / ${esc(r.round||"")}
              <small>${esc(pref)} / ID: ${esc(eff.school_id||rec.school_id||"-")}</small>
            </span>
            <span class="detail-result ${x.result==="○"?"win":x.result==="●"?"loss":""}">${x.result}</span>
            <span class="detail-opponent">${esc(x.opp)}</span>
            <span class="detail-score">${Number.isFinite(x.sf)?x.sf:"-"} - ${Number.isFinite(x.sa)?x.sa:"-"}</span>
          </div>`;
        }).join("") || `<p class="school-detail-empty">対戦履歴なし</p>`}
      </div>
    </div>`;

  body.innerHTML=`
    <div class="school-detail-summary">
      <div><span>現在Rating</span><strong>${current==null?"-":fmtR(current)}</strong></div>
      <div><span>試合数</span><strong>${matches.length}</strong></div>
      <div><span>別名</span><strong>${(rec.aliases||[]).length}</strong></div>
      <button type="button" class="ghost" id="openSchoolEditorFromDetailBtn">この学校を編集</button>
    </div>
    <div class="school-detail-columns school-detail-columns-id-editor">
      ${matchHtml}
      ${ratingHtml}
    </div>`;

  document.getElementById("openSchoolEditorFromDetailBtn")?.addEventListener("click",()=>{
    modal.classList.add("hidden");
    showMasterEditor(name);
  });

  body.querySelectorAll("[data-history-select]").forEach(cb=>{
    cb.addEventListener("change",updateSchoolDetailSelectionCount);
  });
  body.querySelectorAll("[data-history-pref-pick]").forEach(btn=>{
    btn.addEventListener("click",()=>selectSchoolDetailByPref(btn.dataset.historyPrefPick));
  });
  document.getElementById("clearHistorySelectionBtn")?.addEventListener("click",clearSchoolDetailSelection);
  document.getElementById("moveSelectedHistoryBtn")?.addEventListener("click",()=>{
    const target=document.getElementById("historyTargetSchool")?.value||"";
    assignSelectedHistoryToSchool(name,target);
  });
  document.getElementById("branchSelectedHistoryBtn")?.addEventListener("click",()=>branchSelectedHistoryFromSchool(name));

  updateSchoolDetailSelectionCount();
  modal.classList.remove("hidden");
}
function closeSchoolMasterDetail(){
  document.getElementById("schoolMasterDetailModal")?.classList.add("hidden");
}

function matchesForSchoolName(name){
  const rec=schoolMaster.get(name);
  if(!rec) return [];
  ensureIdentityIndexes();
  const key=rec.school_id?`id:${rec.school_id}`:`name:${rec.canonical_name}`;
  return schoolMatchCache.get(key)||[];
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

  return `<div class="merge-history">` + rows.slice(0,12).map(r=>{
    const rec=schoolMaster.get(name);
    const mine1=matchBelongsToSchool(r,"team1",rec);
    const opp=effectiveMatchSchoolName(r,mine1?"team2":"team1");
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

    markIdentityIndexesDirty();
    renderMasterTable();
    queueSharedMasterSave(`Merge school IDs: ${p.source.canonical_name} -> ${p.target.canonical_name}`);
    showSaveToast(`統合しました：${p.source.canonical_name} → ${p.target.canonical_name}`);
    area.classList.add("hidden");
    area.innerHTML="";
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


function masterEditorSnapshot(){
  const ids = [
    "editSchoolId","editCanonicalName","editFurigana","editDistrict","editPref",
    "editLocalDistrict","editRepArea","editRepAreaId","editStatus",
    "editEstablishedYear","editClosedYear","editSuccessorId","editAliases","editLineage"
  ];
  return JSON.stringify(ids.map(id=>{
    const el=document.getElementById(id);
    return [id,el ? String(el.value ?? "") : ""];
  }));
}

function updateMasterSaveState(initialSnapshot){
  const btn=document.getElementById("saveMasterBtn");
  if(!btn) return false;
  const dirty=masterEditorSnapshot()!==initialSnapshot;
  btn.disabled=!dirty;
  btn.textContent=dirty ? "この内容で保存" : "変更なし";
  btn.classList.toggle("is-dirty",dirty);
  return dirty;
}

function showSaveDialog(message){
  let dialog=document.getElementById("masterSaveDialog");
  if(!dialog){
    dialog=document.createElement("dialog");
    dialog.id="masterSaveDialog";
    dialog.className="save-confirm-dialog";
    dialog.innerHTML=`
      <div class="save-confirm-icon">✓</div>
      <strong id="masterSaveDialogMessage">保存しました</strong>
      <button type="button" id="masterSaveDialogClose">OK</button>`;
    document.body.appendChild(dialog);
    dialog.querySelector("#masterSaveDialogClose")?.addEventListener("click",()=>dialog.close());
    dialog.addEventListener("click",(e)=>{
      if(e.target===dialog) dialog.close();
    });
  }
  const msg=dialog.querySelector("#masterSaveDialogMessage");
  if(msg) msg.textContent=message;
  if(typeof dialog.showModal==="function") dialog.showModal();
  else alert(message);
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
      <div class="wide">
        <label>学校沿革（年|種別|旧名|新名|関連学校ID|メモ）</label>
        <textarea id="editLineage" placeholder="例：2026|rename|旧校名|新校名||校名変更">${esc(lineageForSchool(x.school_id).map(h=>[
          h.event_year||"",h.event_type||"",h.old_name||"",h.new_name||"",h.related_school_id||"",h.note||""
        ].join("|")).join("\n"))}</textarea>
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

      <button class="save-btn" id="saveMasterBtn" disabled>変更なし</button>
    </div>
  `;

  const candidateList = document.getElementById("mergeSchoolCandidates");
  candidateList.innerHTML = [...schoolMaster.values()]
    .filter(y=>y.canonical_name!==x.canonical_name)
    .sort((a,b)=>a.canonical_name.localeCompare(b.canonical_name,"ja"))
    .map(y=>`<option value="${esc(y.canonical_name)}">${esc(y.school_id)} ${esc(y.prefecture||"")}</option>`)
    .join("");

  const initialMasterSnapshot = masterEditorSnapshot();
  editor.querySelectorAll("input,select,textarea").forEach(el=>{
    if(el.id==="mergeSourceName") return;
    el.addEventListener("input",()=>updateMasterSaveState(initialMasterSnapshot));
    el.addEventListener("change",()=>updateMasterSaveState(initialMasterSnapshot));
  });
  updateMasterSaveState(initialMasterSnapshot);

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

  document.getElementById("saveMasterBtn").addEventListener("click",async()=>{
    if(!updateMasterSaveState(initialMasterSnapshot)) return;
    const saveBtn=document.getElementById("saveMasterBtn");
    if(saveBtn){
      saveBtn.disabled=true;
      saveBtn.textContent="保存中…";
    }
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
    const lineageLines = (document.getElementById("editLineage")?.value || "").split(/\r?\n/).map(s=>s.trim()).filter(Boolean);
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

    // Refresh master filter options as well as the visible table.
    refillSelectPreserve("masterDistrictFilter", uniq([...schoolMaster.values()].map(v=>v.district)));
    refillSelectPreserve("masterPrefFilter", uniq([...schoolMaster.values()].map(v=>v.prefecture)));
    refillSelectPreserve("masterLocalFilter", uniq([...schoolMaster.values()].map(v=>v.local_district)));

    masterPage=1;
    renderMasterTable();
    setTimeout(()=>render(),0);
    closeMasterEditorPopup();
    showSaveToast(`保存しました：${newName}`);

    const cfg=loadGitHubSyncConfig();
    if(cfg.owner && cfg.repo && githubSessionToken){
      queueSharedMasterSave(`Update school master: ${newName}`);
    }else{
      fastSaveStatus("学校マスタ：端末保存済み（GitHub未設定）","saved");
    }
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
            </tr>`).join("") || `<tr><td colspan="8">この学校IDのRatingイベントがありません。Rating再計算後も0件ならschool_id紐づけを確認してください。</td></tr>`}
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
  document.getElementById("masterPrev")?.addEventListener("click",()=>{
    if(masterPage>1){
      masterPage--;
      renderMasterTable();
      requestAnimationFrame(scrollMasterListTop);
    }
  });
  document.getElementById("masterNext")?.addEventListener("click",()=>{
    masterPage++;
    renderMasterTable();
    requestAnimationFrame(scrollMasterListTop);
  });
  document.getElementById("masterPageSize")?.addEventListener("change",()=>{
    masterPage=1;
    renderMasterTable();
    requestAnimationFrame(scrollMasterListTop);
  });
  document.getElementById("closeSchoolMasterDetailBtn")?.addEventListener("click",closeSchoolMasterDetail);
  document.getElementById("schoolMasterDetailModal")?.addEventListener("click",e=>{
    if(e.target.id==="schoolMasterDetailModal") closeSchoolMasterDetail();
  });

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

  updateGitHubSyncStatus();

  document.getElementById("openGitHubSyncBtn")?.addEventListener("click",openGitHubSyncModal);
  document.getElementById("closeGitHubSyncBtn")?.addEventListener("click",closeGitHubSyncModal);
  document.getElementById("githubSyncModal")?.addEventListener("click",e=>{
    if(e.target.id==="githubSyncModal") closeGitHubSyncModal();
  });
  document.getElementById("saveGitHubSyncBtn")?.addEventListener("click",()=>{
    const {cfg,token,remember}=readGitHubSyncForm();
    if(!cfg.owner||!cfg.repo||!token){
      document.getElementById("githubSyncMessage").textContent="owner / repository / token を入力してください";
      return;
    }
    saveGitHubSyncConfig(cfg,token,remember);
    document.getElementById("githubSyncMessage").textContent="設定を保存しました";
    setTimeout(closeGitHubSyncModal,500);
  });
  document.getElementById("testGitHubSyncBtn")?.addEventListener("click",async()=>{
    const msg=document.getElementById("githubSyncMessage");
    const {cfg,token,remember}=readGitHubSyncForm();
    if(!cfg.owner||!cfg.repo||!token){
      msg.textContent="owner / repository / token を入力してください";
      return;
    }
    saveGitHubSyncConfig(cfg,token,remember);
    msg.textContent="接続確認中…";
    try{
      await githubApi("");
      msg.textContent="接続OK：書込設定を利用できます";
    }catch(err){
      msg.textContent=`接続失敗：${err.message}`;
    }
  });
  document.getElementById("reloadSharedMasterBtn")?.addEventListener("click",async()=>{
    try{
      await reloadSharedMasterUi();
    }catch(err){
      const msg=String(err?.message||err);
      showSaveDialog(msg.includes("まだGitHubに作成されていません")
        ? "共有マスタがまだありません\n\n『現在マスタを共有へ初期登録』を1回押してください"
        : `共有マスタ再読込に失敗しました\n${msg}`);
    }
  });
  document.getElementById("publishSharedMasterBtn")?.addEventListener("click",publishCurrentMasterAsShared);

  const exp = document.getElementById("exportAliasBtn");
  if(exp) exp.addEventListener("click",exportMasterCsv);

  const imp = document.getElementById("importAliasInput");
  if(imp) imp.addEventListener("change",async()=>{
    if(imp.files?.[0]) await importMasterCsv(imp.files[0]);
    imp.value="";
  });
}




const IMPORT_REQUESTS_PATH="master/import_requests.json";
const IMPORT_AUDIT_PATH="master/import_audit.json";
const IMPORT_AUDIT_URL="data/import_audit.json";

const IMPORT_POLL_INTERVAL_MS=3000;
const IMPORT_POLL_MAX_MS=180000;
let importPollTimer=null;
let importPollStartedAt=0;
let importPollTargetRequestId="";

function setImportProgress(state,title,detail=""){
  const card=document.getElementById("importProgressCard");
  const t=document.getElementById("importProgressTitle");
  const d=document.getElementById("importProgressDetail");
  if(card) card.className=`import-progress-card ${state}`;
  if(t) t.textContent=title;
  if(d) d.textContent=detail;
}

function stopImportPolling(){
  if(importPollTimer) clearTimeout(importPollTimer);
  importPollTimer=null;
}

function startImportPolling(requestId,{approval=false}={}){
  if(!requestId) return;
  stopImportPolling();
  importPollTargetRequestId=requestId;
  importPollStartedAt=Date.now();
  setImportProgress("working",approval?"登録処理中…":"解析処理中…","GitHubを開く必要はありません。完了すると自動で表示が切り替わります。");

  const tick=async()=>{
    const elapsed=Date.now()-importPollStartedAt;
    if(elapsed>IMPORT_POLL_MAX_MS){
      setImportProgress("waiting","まだ処理中です","3分以上かかっています。しばらくして「解析結果を再読込」を押してください。");
      stopImportPolling();
      return;
    }

    try{
      const data=await fetchImportAuditLatest();
      const items=Array.isArray(data?.items)?data.items:[];
      let item=null;

      if(approval){
        // Approval uses target request id; wait for that audit item to become completed.
        item=items.find(x=>x.request_id===requestId);
        if(item?.status==="completed"){
          renderImportAudit(data);
          setImportProgress("done","登録完了",`${item.added_matches ?? item.matches?.length ?? 0}試合を本番データへ反映しました。本番CSV登録とRating再計算が完了しました。`);
          stopImportPolling();
          return;
        }
        if(item?.status==="error"){
          renderImportAudit(data);
          setImportProgress("error","登録失敗",(item.warnings||[]).join(" / ")||"処理に失敗しました。");
          stopImportPolling();
          return;
        }
      }else{
        item=items.find(x=>x.request_id===requestId);
        if(item){
          renderImportAudit(data);
          if(item.status==="review"){
            setImportProgress("done","解析完了",`${item.matches?.length||0}試合を認識しました。下の内容を確認してください。`);
            stopImportPolling();
            return;
          }
          if(item.status==="error"){
            setImportProgress("error","解析失敗",(item.warnings||[]).join(" / ")||"URLの取得または解析に失敗しました。");
            stopImportPolling();
            return;
          }
          if(item.status==="completed"){
            setImportProgress("done","登録済み",`${item.added_matches ?? item.matches?.length ?? 0}試合が登録されています。`);
            stopImportPolling();
            return;
          }
        }
      }

      const sec=Math.max(1,Math.round(elapsed/1000));
      setImportProgress("working",approval?"登録処理中…":"解析処理中…",`${sec}秒経過。GitHub上の最新結果を直接確認しています。`);
    }catch(err){
      const sec=Math.max(1,Math.round(elapsed/1000));
      setImportProgress("waiting",approval?"登録開始待ち…":"解析開始待ち…",`${sec}秒経過。Actionsの開始または結果書き込みを待っています。`);
    }
    importPollTimer=setTimeout(tick,IMPORT_POLL_INTERVAL_MS);
  };

  tick();
}

function resumeImportPollingIfNeeded(){
  const last=localStorage.getItem("hsbbl_last_import_request_id")||"";
  const state=localStorage.getItem("hsbbl_last_import_state")||"";
  if(!last) return;
  if(state==="analyze"){
    startImportPolling(last,{approval:false});
  }else if(state==="approve"){
    startImportPolling(last,{approval:true});
  }
}


function importRequestStateEmpty(){
  return {version:1,requests:[]};
}

async function appendImportRequest(req){
  const cfg=loadGitHubSyncConfig();
  if(!cfg.owner||!cfg.repo||!githubSessionToken){
    throw new Error("GitHub同期設定が必要です");
  }
  for(let attempt=1;attempt<=4;attempt++){
    const remote=await fetchGithubJsonFile(IMPORT_REQUESTS_PATH);
    const state={...importRequestStateEmpty(),...(remote.state||{})};
    const list=Array.isArray(state.requests)?state.requests:[];
    state.requests=[...list,req].slice(-200);
    state.updated_at=new Date().toISOString();
    const body={
      message:`Import request: ${req.action} ${req.prefecture||""} ${req.year||""} ${req.season||""}`,
      branch:cfg.branch||"main",
      content:utf8ToBase64(JSON.stringify(state,null,2)+"\n")
    };
    if(remote.sha) body.sha=remote.sha;
    try{
      return await githubApi(`/contents/${IMPORT_REQUESTS_PATH}`,{
        method:"PUT",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify(body)
      });
    }catch(err){
      if(!/GitHub (409|422)/.test(String(err?.message||err)) || attempt===4) throw err;
      await new Promise(r=>setTimeout(r,300*attempt));
    }
  }
}

function importRegionForPref(pref){
  return DISTRICT_TO_REGION[PREF_TO_DISTRICT[pref]||""]||"";
}

function setupImportUi(){
  const pref=document.getElementById("importPrefecture");
  if(pref && pref.options.length<=1){
    MASTER_PREFECTURES
      .filter(x=>!["不明","北北海道","南北海道","東東京","西東京"].includes(x))
      .forEach(p=>{
        const o=document.createElement("option"); o.value=p; o.textContent=p; pref.appendChild(o);
      });
  }
  document.getElementById("importAnalyzeBtn")?.addEventListener("click",submitImportAnalyze);
  document.getElementById("importAuditReloadBtn")?.addEventListener("click",loadImportAudit);
  setTimeout(resumeImportPollingIfNeeded,200);
}

async function submitImportAnalyze(){
  const year=String(document.getElementById("importYear")?.value||"").trim();
  const season=document.getElementById("importSeason")?.value||"";
  const prefecture=document.getElementById("importPrefecture")?.value||"";
  const level=document.getElementById("importLevel")?.value||"prefecture";
  const source_url=String(document.getElementById("importSourceUrl")?.value||"").trim();
  const tournament=String(document.getElementById("importTournamentName")?.value||"").trim();
  const status=document.getElementById("importSubmitStatus");
  if(!/^\d{4}$/.test(year)){ alert("年を4桁で入力してください"); return; }
  if(!prefecture){ alert("都道府県を選択してください"); return; }
  if(!/^https?:\/\//i.test(source_url)){ alert("結果ページURLを入力してください"); return; }

  const id=`${Date.now()}-${Math.random().toString(36).slice(2,8)}`;
  const req={
    request_id:id,
    action:"analyze",
    created_at:new Date().toISOString(),
    year:Number(year),season,prefecture,level,
    region:importRegionForPref(prefecture),
    tournament,source_url
  };
  try{
    if(status) status.textContent="GitHubへ解析依頼を送信中…";
    await appendImportRequest(req);
    if(status) status.textContent="解析依頼済み。Actions完了後に解析結果を再読込してください。";
    localStorage.setItem("hsbbl_last_import_request_id",id);
    localStorage.setItem("hsbbl_last_import_state","analyze");
    startImportPolling(id,{approval:false});
  }catch(err){
    console.error(err);
    if(status) status.textContent=`送信失敗：${err.message}`;
  }
}


async function fetchImportAuditLatest(){
  // Prefer GitHub repository directly. This avoids waiting for GitHub Pages
  // to redeploy after Actions updates import_audit.json.
  try{
    const cfg=loadGitHubSyncConfig();
    if(cfg?.owner && cfg?.repo && githubSessionToken){
      const remote=await fetchGithubJsonFile(IMPORT_AUDIT_PATH);
      if(remote?.state) return remote.state;
    }
  }catch(err){
    console.warn("Direct GitHub audit read failed; falling back to Pages",err);
  }

  const txt=await fetchTextWithTimeout(`${IMPORT_AUDIT_URL}?fresh=${Date.now()}`,10000);
  return JSON.parse(txt);
}

async function loadImportAudit(){
  const area=document.getElementById("importAuditArea");
  if(!area) return;
  area.innerHTML=`<div class="empty-state"><p>解析結果を読込中…</p></div>`;
  try{
    const data=await fetchImportAuditLatest();
    renderImportAudit(data);
    const last=localStorage.getItem("hsbbl_last_import_request_id")||"";
    const item=(data.items||[]).find(x=>x.request_id===last);
    if(item?.status==="review"){
      localStorage.setItem("hsbbl_last_import_state","review");
      setImportProgress("done","解析完了",`${item.matches?.length||0}試合を認識しました。下の内容を確認してください。`);
    }else if(item?.status==="completed"){
      localStorage.setItem("hsbbl_last_import_state","completed");
      setImportProgress("done","登録完了",`${item.added_matches ?? item.matches?.length ?? 0}試合を反映しました。`);
    }else if(item?.status==="error"){
      localStorage.setItem("hsbbl_last_import_state","error");
      setImportProgress("error","処理失敗",(item.warnings||[]).join(" / ")||"処理に失敗しました。");
    }
  }catch(err){
    area.innerHTML=`<div class="empty-state"><h3>解析結果なし</h3><p>まだActions処理中か、解析結果が未生成です。</p></div>`;
  }
}

function renderImportAudit(data){
  const area=document.getElementById("importAuditArea");
  if(!area) return;
  const items=Array.isArray(data?.items)?data.items:[];
  if(!items.length){
    area.innerHTML=`<div class="empty-state"><h3>解析結果なし</h3></div>`;
    return;
  }
  const lastId=localStorage.getItem("hsbbl_last_import_request_id")||"";
  const sorted=[...items].sort((a,b)=>{
    if(a.request_id===lastId) return -1;
    if(b.request_id===lastId) return 1;
    return String(b.processed_at||"").localeCompare(String(a.processed_at||""));
  });
  const x=sorted[0];
  const matches=Array.isArray(x.matches)?x.matches:[];
  area.innerHTML=`
    <div class="import-audit-head">
      <div>
        <h3>${esc(String(x.year||""))} ${esc(seasonLabel(x.season||""))} / ${esc(x.prefecture||"")} / ${esc(x.tournament||"大会名未指定")}</h3>
        <p>${esc(x.source_url||"")}</p>
      </div>
      <div class="import-audit-stats">
        <strong>${matches.length}試合</strong>
        <span>${esc(x.status||"")}</span>
      </div>
    </div>
    ${(x.warnings||[]).length?`<div class="import-warnings">${x.warnings.map(w=>`<div>⚠ ${esc(w)}</div>`).join("")}</div>`:""}
    <div class="import-preview-wrap">
      <table class="import-preview-table">
        <thead><tr><th>日付</th><th>回戦</th><th>学校1</th><th>得点</th><th>学校2</th><th>得点</th><th>結着</th></tr></thead>
        <tbody>${matches.map(m=>`<tr>
          <td>${esc(m.date||"")}</td><td>${esc(m.round||"")}</td>
          <td>${esc(m.team1||"")}</td><td>${esc(String(m.score1??""))}</td>
          <td>${esc(m.team2||"")}</td><td>${esc(String(m.score2??""))}</td>
          <td>${m.finish_type==="cold"?`${esc(String(m.innings||""))}回C`:m.finish_type==="extra"?`延長${esc(String(m.innings||""))}`:"9回"}</td>
        </tr>`).join("")}</tbody>
      </table>
    </div>
    <div class="import-actions">
      <button type="button" class="save-btn" id="importApproveBtn" ${!matches.length||x.status==="completed"?"disabled":""}>
        ${x.status==="completed"?"登録済み":"この内容で登録"}
      </button>
      <span class="school-meta">解析結果を確認してから登録してください。</span>
    </div>`;
  document.getElementById("importApproveBtn")?.addEventListener("click",()=>approveImportAudit(x));
}

async function approveImportAudit(x){
  if(!x?.request_id) return;
  if(!confirm(`${x.matches?.length||0}試合を本番データへ登録します。よろしいですか？`)) return;
  const btn=document.getElementById("importApproveBtn");
  if(btn){btn.disabled=true;btn.textContent="登録依頼中…";}
  try{
    await appendImportRequest({
      request_id:`approve-${Date.now()}-${Math.random().toString(36).slice(2,7)}`,
      action:"approve",
      target_request_id:x.request_id,
      created_at:new Date().toISOString()
    });
    showSaveToast("登録依頼を送信しました");
    localStorage.setItem("hsbbl_last_import_request_id",x.request_id);
    localStorage.setItem("hsbbl_last_import_state","approve");
    startImportPolling(x.request_id,{approval:true});
  }catch(err){
    alert(`登録依頼に失敗しました\n${err.message}`);
    if(btn){btn.disabled=false;btn.textContent="この内容で登録";}
  }
}


async function fetchTextWithTimeout(url, timeoutMs=12000){
  const ctl = new AbortController();
  const timer = setTimeout(()=>ctl.abort(), timeoutMs);
  try{
    const sep=String(url).includes("?")?"&":"?";
    const freshUrl=`${url}${sep}_fresh=${Date.now()}`;
    const res = await fetch(freshUrl,{
      cache:"no-store",
      headers:{"Cache-Control":"no-cache","Pragma":"no-cache"},
      signal:ctl.signal
    });
    if(!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
    return await res.text();
  }finally{
    clearTimeout(timer);
  }
}

async function boot(){
  const statusEl = document.getElementById("status");
  const setStatus = msg => {
    if(statusEl) statusEl.innerHTML = `${msg} <small class="build-tag">UI-IMPORT-SCHEMA-FIX-V3</small>`;
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
    detectedSchoolGeo = buildSchoolMeta(allMatches);

    // Shared GitHub master is preferred; localStorage is only fallback/backup.
    await loadSharedMasterFromGitHub();
    await loadMatchEditsShared();
    restorePendingMatchEdits();
    allMatches = normalizeRows(applyMatchEditsToRows(allMatches,{includeManual:true}));
    detectedSchoolGeo = buildSchoolMeta(allMatches);
    initSchoolMaster();
    if(sharedMasterState){
      if(Array.isArray(sharedMasterState.lineage)) schoolLineage=sharedMasterState.lineage;
      else loadLineage();
      if(Array.isArray(sharedMasterState.local_areas)) localAreas=sharedMasterState.local_areas;
      if(Array.isArray(sharedMasterState.representative_areas)) repAreas=sharedMasterState.representative_areas;
    }else{
      loadLineage();
      loadAreaMasters();
    }

    fillSelect("yearFilter", uniq(allMatches.map(x=>x.year)));
    fillSelect("regionFilter", uniq(allMatches.map(x=>x.region)));
    fillSelect("prefFilter", uniq(allMatches.map(x=>x.prefecture)));

    // 初期ランキングは serverRatings を優先して軽く表示。
    buildFastIndexes();
    setupTabs();
    setupImportUi();

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
          historicalLedger = normalizeRows(applyMatchEditsToRows(csvParse(jobs[2].value),{includeManual:false}));
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


// === HISTORY ID REDESIGN V2: independent editor controller ===
let historyIdEditorSchoolName = "";

function historyIdEditorCurrentSchool(){
  return schoolMaster.get(historyIdEditorSchoolName) || null;
}

function historyIdEditorMatches(){
  const rec=historyIdEditorCurrentSchool();
  if(!rec) return [];
  const source=(ledgerMatches.length?ledgerMatches:allMatches);
  return source.filter(r=>matchBelongsToSchool(r,"team1",rec)||matchBelongsToSchool(r,"team2",rec))
    .sort((a,b)=>String(b.date||"").localeCompare(String(a.date||"")));
}

function historyIdEditorSide(r,rec){
  if(matchBelongsToSchool(r,"team1",rec)) return "team1";
  if(matchBelongsToSchool(r,"team2",rec)) return "team2";
  return "";
}

function historyIdEditorRefreshSelected(){
  const checked=[...document.querySelectorAll("#historyIdEditorList [data-history-id-check]:checked")];
  const n=checked.length;
  const c=document.getElementById("historyIdSelectedCount");
  if(c) c.textContent=`${n}試合選択`;
  const move=document.getElementById("historyIdMoveBtn");
  const branch=document.getElementById("historyIdBranchBtn");
  if(move) move.disabled=n===0;
  if(branch) branch.disabled=n===0;
}

function historyIdEditorSelected(){
  return [...document.querySelectorAll("#historyIdEditorList [data-history-id-check]:checked")]
    .map(cb=>({
      key:cb.dataset.historyIdCheck,
      side:cb.dataset.historyIdSide,
      pref:cb.dataset.historyIdPref
    }));
}


const HISTORY_TARGET_RECENT_KEY="hsbbl_history_target_recent_v1";
let historyTargetActiveIndex=-1;
let historyTargetCandidateNames=[];

function historyTargetRecentNames(){
  try{
    const arr=JSON.parse(localStorage.getItem(HISTORY_TARGET_RECENT_KEY)||"[]");
    return Array.isArray(arr)?arr:[];
  }catch(e){ return []; }
}

function rememberHistoryTarget(name){
  if(!name) return;
  const list=[name,...historyTargetRecentNames().filter(x=>x!==name)].slice(0,8);
  try{ localStorage.setItem(HISTORY_TARGET_RECENT_KEY,JSON.stringify(list)); }catch(e){}
}

function normalizeSchoolSearchText(v){
  return String(v||"")
    .toLowerCase()
    .replace(/[　\s/・\-_.()（）【】\[\]]+/g,"");
}

function historyTargetScore(rec,query,recentSet){
  const q=normalizeSchoolSearchText(query);
  const name=String(rec.canonical_name||"");
  const pref=String(rec.prefecture||"");
  const id=String(rec.school_id||"");
  const aliases=(rec.aliases||[]).join(" ");
  const n=normalizeSchoolSearchText(name);
  const p=normalizeSchoolSearchText(pref);
  const sid=normalizeSchoolSearchText(id);
  const a=normalizeSchoolSearchText(aliases);

  let score=0;
  if(!q){
    if(recentSet.has(name)) score+=1000-recentSet.get(name);
    else score-=100;
    return score;
  }
  if(n===q) score+=10000;
  else if(n.startsWith(q)) score+=8000;
  else if(n.includes(q)) score+=6000;
  if(a===q) score+=5500;
  else if(a.startsWith(q)) score+=4500;
  else if(a.includes(q)) score+=3500;
  if(p===q) score+=2400;
  else if(p.includes(q)) score+=1800;
  if(sid===q) score+=5000;
  else if(sid.startsWith(q)) score+=4200;
  else if(sid.includes(q)) score+=3000;
  if(recentSet.has(name)) score+=300-recentSet.get(name);
  return score;
}

function historyTargetCandidates(query,currentSchool){
  const recents=historyTargetRecentNames();
  const recentSet=new Map(recents.map((n,i)=>[n,i]));
  return [...schoolMaster.values()]
    .filter(x=>(x.status||"active")!=="merged" && x.school_id!==currentSchool?.school_id)
    .map(x=>({rec:x,score:historyTargetScore(x,query,recentSet)}))
    .filter(x=>String(query||"").trim()?x.score>0:x.score>=0)
    .sort((a,b)=>b.score-a.score || a.rec.canonical_name.localeCompare(b.rec.canonical_name,"ja"))
    .slice(0,20)
    .map(x=>x.rec);
}

function renderHistoryTargetCandidates(query=""){
  const box=document.getElementById("historyIdTargetCandidates");
  const input=document.getElementById("historyIdTargetSearch");
  const hidden=document.getElementById("historyIdTargetSchool");
  const current=historyIdEditorCurrentSchool();
  if(!box||!input||!hidden||!current) return;

  const candidates=historyTargetCandidates(query,current);
  historyTargetCandidateNames=candidates.map(x=>x.canonical_name);
  historyTargetActiveIndex=candidates.length?0:-1;

  if(!candidates.length){
    box.innerHTML=`<div class="history-target-empty">候補なし</div>`;
    box.classList.remove("hidden");
    return;
  }

  box.innerHTML=candidates.map((x,i)=>`
    <button type="button" class="history-target-candidate ${i===0?"active":""}"
      data-history-target-name="${esc(x.canonical_name)}">
      <strong>${esc(x.canonical_name)}</strong>
      <span>${esc(x.prefecture||"-")} / ${esc(x.school_id||"-")}</span>
    </button>
  `).join("");
  box.classList.remove("hidden");

  box.querySelectorAll("[data-history-target-name]").forEach(btn=>{
    btn.addEventListener("mousedown",e=>e.preventDefault());
    btn.addEventListener("click",()=>{
      selectHistoryTarget(btn.dataset.historyTargetName);
    });
  });
}

function selectHistoryTarget(name){
  const rec=schoolMaster.get(name);
  const input=document.getElementById("historyIdTargetSearch");
  const hidden=document.getElementById("historyIdTargetSchool");
  const box=document.getElementById("historyIdTargetCandidates");
  if(!rec||!input||!hidden) return;
  hidden.value=rec.canonical_name;
  input.value=`${rec.canonical_name} / ${rec.prefecture||"-"} / ${rec.school_id||"-"}`;
  input.classList.add("selected");
  box?.classList.add("hidden");
  rememberHistoryTarget(rec.canonical_name);
  historyIdEditorRefreshSelected();
}

function clearHistoryTargetSelection(){
  const hidden=document.getElementById("historyIdTargetSchool");
  const input=document.getElementById("historyIdTargetSearch");
  if(hidden) hidden.value="";
  if(input) input.classList.remove("selected");
}

function updateHistoryTargetActive(){
  const box=document.getElementById("historyIdTargetCandidates");
  if(!box) return;
  const buttons=[...box.querySelectorAll("[data-history-target-name]")];
  buttons.forEach((b,i)=>b.classList.toggle("active",i===historyTargetActiveIndex));
  buttons[historyTargetActiveIndex]?.scrollIntoView({block:"nearest"});
}

function setupHistoryTargetAutocomplete(){
  const input=document.getElementById("historyIdTargetSearch");
  if(!input || input.dataset.autocompleteReady==="1") return;
  input.dataset.autocompleteReady="1";

  input.addEventListener("focus",()=>{
    const hidden=document.getElementById("historyIdTargetSchool");
    if(!hidden?.value) renderHistoryTargetCandidates(input.value);
  });

  input.addEventListener("input",()=>{
    clearHistoryTargetSelection();
    renderHistoryTargetCandidates(input.value);
  });

  input.addEventListener("keydown",e=>{
    const box=document.getElementById("historyIdTargetCandidates");
    if(e.key==="ArrowDown"){
      e.preventDefault();
      if(box?.classList.contains("hidden")) renderHistoryTargetCandidates(input.value);
      else if(historyTargetCandidateNames.length){
        historyTargetActiveIndex=(historyTargetActiveIndex+1)%historyTargetCandidateNames.length;
        updateHistoryTargetActive();
      }
    }else if(e.key==="ArrowUp"){
      e.preventDefault();
      if(historyTargetCandidateNames.length){
        historyTargetActiveIndex=(historyTargetActiveIndex-1+historyTargetCandidateNames.length)%historyTargetCandidateNames.length;
        updateHistoryTargetActive();
      }
    }else if(e.key==="Enter"){
      if(historyTargetActiveIndex>=0 && historyTargetCandidateNames[historyTargetActiveIndex]){
        e.preventDefault();
        selectHistoryTarget(historyTargetCandidateNames[historyTargetActiveIndex]);
      }
    }else if(e.key==="Escape"){
      box?.classList.add("hidden");
    }
  });

  input.addEventListener("blur",()=>{
    setTimeout(()=>document.getElementById("historyIdTargetCandidates")?.classList.add("hidden"),120);
  });
}


function renderHistoryIdEditor(){
  const rec=historyIdEditorCurrentSchool();
  if(!rec) return;
  const matches=historyIdEditorMatches();
  const title=document.getElementById("historyIdEditorTitle");
  const meta=document.getElementById("historyIdEditorMeta");
  const list=document.getElementById("historyIdEditorList");
  const chips=document.getElementById("historyIdPrefChips");
  const target=document.getElementById("historyIdTargetSchool");
  const targetSearch=document.getElementById("historyIdTargetSearch");

  if(title) title.textContent=`${rec.canonical_name}：履歴からID分岐`;
  if(meta) meta.textContent=`現在ID ${rec.school_id||"-"} / ${rec.prefecture||"-"} / ${matches.length}試合`;

  const prefCounts=new Map();
  for(const r of matches){
    const p=normalizePrefectureName(r.prefecture)||"県不明";
    prefCounts.set(p,(prefCounts.get(p)||0)+1);
  }
  if(chips){
    chips.innerHTML=`<button type="button" class="ghost compact" data-history-id-pref="__all__">全選択</button>`+
      [...prefCounts.entries()].sort((a,b)=>b[1]-a[1]).map(([p,n])=>
        `<button type="button" class="history-pref-chip" data-history-id-pref="${esc(p)}">${esc(p)} ${n}</button>`
      ).join("")+
      `<button type="button" class="ghost compact" data-history-id-pref="__none__">解除</button>`;
    chips.querySelectorAll("[data-history-id-pref]").forEach(btn=>{
      btn.addEventListener("click",()=>{
        const pref=btn.dataset.historyIdPref;
        document.querySelectorAll("#historyIdEditorList [data-history-id-check]").forEach(cb=>{
          cb.checked=pref==="__all__" ? true : pref==="__none__" ? false : cb.dataset.historyIdPref===pref;
        });
        historyIdEditorRefreshSelected();
      });
    });
  }

  if(target) target.value="";
  if(targetSearch){
    targetSearch.value="";
    targetSearch.classList.remove("selected");
  }
  document.getElementById("historyIdTargetCandidates")?.classList.add("hidden");
  setupHistoryTargetAutocomplete();

  if(list){
    list.innerHTML=matches.map(r=>{
      const side=historyIdEditorSide(r,rec);
      const key=matchEditKey(r);
      const x=schoolResultFor(r,historyIdEditorSchoolName);
      const p=normalizePrefectureName(r.prefecture)||"県不明";
      const eff=effectiveMatchSchool(r,side);
      return `<label class="history-id-match-row">
        <input type="checkbox" data-history-id-check="${esc(key)}" data-history-id-side="${esc(side)}" data-history-id-pref="${esc(p)}">
        <span class="history-id-date">${esc(r.date||"")}</span>
        <span class="history-id-game">
          <strong>${esc(r.year||"")} ${esc(seasonLabel(r.season||""))} / ${esc(r.tournament||"")} / ${esc(r.round||"")}</strong>
          <small>${esc(p)} / 現在ID: ${esc(eff.school_id||rec.school_id||"-")}</small>
        </span>
        <span class="history-id-result ${x.result==="○"?"win":x.result==="●"?"loss":""}">${x.result}</span>
        <span class="history-id-opp">${esc(x.opp)}</span>
        <span class="history-id-score">${Number.isFinite(x.sf)?x.sf:"-"} - ${Number.isFinite(x.sa)?x.sa:"-"}</span>
      </label>`;
    }).join("") || `<div class="school-detail-empty">対戦履歴なし</div>`;

    list.querySelectorAll("[data-history-id-check]").forEach(cb=>{
      cb.addEventListener("change",historyIdEditorRefreshSelected);
    });
  }
  historyIdEditorRefreshSelected();
}

function openHistoryIdEditorFromDetail(){
  const name=document.getElementById("schoolMasterDetailTitle")?.textContent?.trim();
  if(!name || !schoolMaster.has(name)){
    alert("学校を特定できませんでした。学校マスタから詳細を開き直してください。");
    return;
  }
  historyIdEditorSchoolName=name;
  renderHistoryIdEditor();
  document.getElementById("historyIdEditorModal")?.classList.remove("hidden");
}

function closeHistoryIdEditor(){
  document.getElementById("historyIdEditorModal")?.classList.add("hidden");
  historyIdEditorSchoolName="";
}

async function moveHistoryIdSelectionToExisting(){
  const selected=historyIdEditorSelected();
  const targetName=document.getElementById("historyIdTargetSchool")?.value||"";
  const target=schoolMaster.get(targetName);
  if(!selected.length){ alert("試合を選択してください。"); return; }
  if(!target){ alert("移動先を検索して候補から学校を選択してください。"); return; }
  rememberHistoryTarget(target.canonical_name);

  for(const s of selected){
    upsertMatchTeamLink(s.key,s.side,target);
    for(const arr of [ledgerMatches,allMatches]){
      const row=arr.find(r=>matchEditKey(r)===s.key);
      if(row){
        row[`${s.side}_school_id`]=target.school_id||"";
        row[`${s.side}_canonical`]=target.canonical_name||"";
      }
    }
  }

  renderHistoryIdEditor();
  renderLedger();
  renderMasterTable();
  queueMatchEditsSave(`Move ${selected.length} histories to ${target.canonical_name}`);
  showSaveToast(`${selected.length}試合を ${target.canonical_name} へ移動`);
}

async function branchHistoryIdSelection(){
  const source=historyIdEditorCurrentSchool();
  const selected=historyIdEditorSelected();
  if(!source || !selected.length){ alert("試合を選択してください。"); return; }

  const selectedRows=selected.map(s=>
    ledgerMatches.find(r=>matchEditKey(r)===s.key) || allMatches.find(r=>matchEditKey(r)===s.key)
  ).filter(Boolean);
  const prefs=uniq(selectedRows.map(r=>normalizePrefectureName(r.prefecture)).filter(Boolean));
  const guessPref=prefs.length===1?prefs[0]:"";
  const baseName=String(source.canonical_name||"").replace(/(?:（[^（）]+）)+$/,"")||source.canonical_name;
  const defaultName=guessPref?`${baseName}（${guessPref}）`:`${baseName}（分岐）`;

  const newName=prompt(`${selected.length}試合を新IDへ分岐します。\n新しい表示名：`,defaultName);
  if(!newName) return;
  if(schoolMaster.has(newName)){
    alert("同名の学校IDが既にあります。既存IDへ移す場合は上の「既存IDへ移動」を使ってください。");
    return;
  }
  const pref=prompt("新しい学校の都道府県：",guessPref||source.prefecture||"")?.trim();
  if(!pref) return;

  const district=PREF_TO_DISTRICT[pref]||source.district||"不明";
  const newId=provisionalSchoolId(newName,district,pref,"00");
  const rec={
    ...source,
    school_id:newId,
    canonical_name:newName,
    district,
    prefecture:pref,
    local_district:"",
    local_district_id:"",
    representative_area:"",
    representative_area_id:"",
    aliases:[newName],
    status:"active",
    successor_id:""
  };
  schoolMaster.set(newName,rec);

  for(const s of selected){
    upsertMatchTeamLink(s.key,s.side,rec);
    for(const arr of [ledgerMatches,allMatches]){
      const row=arr.find(r=>matchEditKey(r)===s.key);
      if(row){
        row[`${s.side}_school_id`]=newId;
        row[`${s.side}_canonical`]=newName;
      }
    }
  }
  saveMasterToStorage();

  renderMasterTable();
  renderLedger();
  historyIdEditorSchoolName=newName;
  renderHistoryIdEditor();
  queueSharedMasterSave(`Create school from match history: ${newName}`);
  queueMatchEditsSave(`Branch ${selected.length} histories to ${newName}`);
  showSaveToast(`新ID作成：${newName} / ${selected.length}試合を移動`);
}

document.addEventListener("click",e=>{
  if(e.target?.id==="openHistoryIdEditorBtn") openHistoryIdEditorFromDetail();
  if(e.target?.id==="closeHistoryIdEditorBtn") closeHistoryIdEditor();
  if(e.target?.id==="historyIdMoveBtn") moveHistoryIdSelectionToExisting();
  if(e.target?.id==="historyIdBranchBtn") branchHistoryIdSelection();
  if(e.target?.id==="historyIdEditorModal") closeHistoryIdEditor();
});
