
const DATA_URL = "data/all_matches.csv";
const RATINGS_URL = "data/current_ratings.csv";
const HISTORY_LEDGER_URL = "data/historical_ledger_2017_2024.csv";
const LEDGER_SHARD_BASE_URL = "data/ledger_shards";
const RATING_EVENTS_URL = "data/rating_events.csv";
const RATING_SCHOOL_EVENTS_URL = "data/rating_school_events.csv";
const SCHOOL_HISTORY_BASE_URL = "data/school_history";
const RATING_AUDIT_URL = "data/rating_audit_summary.json";
const PREF_STRENGTH_URL = "data/prefecture_strength_prior.csv";
const PREF_MATCHUPS_URL = "data/prefecture_matchups.csv";
const PREF_CURRENT_RATINGS_URL = "data/prefecture_ratings.csv";
const PREF_RATING_EVENTS_URL = "data/prefecture_rating_events.csv";
let prefectureCurrentRatings = [];
let prefectureRatingEvents = [];

let prefectureStrengthRows = [];
let prefectureMatchupRows = [];

let prefRatingDataLoaded = false;
let prefRatingLoading = false;
let prefInterstateCache = null;

let allMatches = [];
let ledgerMatches = [];
let currentStats = new Map();
let serverRatings = [];
let schoolMaster = new Map();
let selectedSchools = new Set();
let ratingEvents = [];
let ratingSchoolEvents = [];
let schoolHistoryShardCache = new Map();
let ratingAuditSummary = null;
let coreMatchDataLoaded = false;
let coreMatchDataLoadingPromise = null;
const LINEAGE_STORAGE_KEY = "hsbbl_school_lineage_v1";
const LOCAL_AREAS_STORAGE_KEY = "hsbbl_local_areas_v1";
const REP_AREAS_STORAGE_KEY = "hsbbl_rep_areas_v1";
const UNION_TEAMS_STORAGE_KEY = "hsbbl_union_teams_v1";
let schoolLineage = [];
let rankingPage = 1;
let ledgerPage = 1;
let ledgerSelectedKeys = new Set();
let ledgerLastRangeIndex = null;
let ledgerLastManualKeys = new Set();
let masterPage = 1;
let ratingEventMap = new Map();
const RATING_PENDING_STORAGE_KEY="hsbbl_rating_pending_match_keys_v1";
let ratingRefreshTimer=null;
let ratingRefreshRunning=false;

function loadPendingRatingKeys(){
  try{
    const arr=JSON.parse(localStorage.getItem(RATING_PENDING_STORAGE_KEY)||"[]");
    return new Set(Array.isArray(arr)?arr.map(String):[]);
  }catch(e){return new Set();}
}
let pendingRatingMatchKeys=loadPendingRatingKeys();

function savePendingRatingKeys(){
  try{
    localStorage.setItem(RATING_PENDING_STORAGE_KEY,JSON.stringify([...pendingRatingMatchKeys]));
  }catch(e){}
}

let ledgerUiSetupDone = false;
let masterUiSetupDone = false;
let serverRatingMap = new Map();
let serverRatingById = new Map();
let schoolEventMap = new Map();
let schoolEventById = new Map();
let schoolEventByMatchSide = new Map();
let schoolRankHistoryCache = new Map();
let currentSchoolRankCache = new Map();
let rankingMasterByIdCache = null;
let rankingNameIndexCache = null;
let latestMatchDateCache = "";
let detectedSchoolGeo = new Map();
let schoolByIdMap = new Map();
let matchTeamLinkMap = new Map();
let schoolMatchCache = new Map();
let schoolNameCandidateMap = new Map();
let effectiveMatchSchoolCache = new WeakMap();
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
const MASTER_PREFECTURES = ["北海道","青森","岩手","秋田","山形","宮城","福島","茨城","栃木","群馬","埼玉","千葉","東京","神奈川","山梨","静岡","愛知","岐阜","三重","新潟","長野","富山","石川","福井","滋賀","京都","大阪","兵庫","奈良","和歌山","岡山","広島","鳥取","島根","山口","香川","徳島","愛媛","高知","福岡","佐賀","長崎","熊本","大分","宮崎","鹿児島","沖縄","北北海道","南北海道","東東京","西東京","不明"];
const BASEBALL_PREF_ORDER = ["北北海道", "南北海道", "青森", "岩手", "秋田", "山形", "宮城", "福島", "茨城", "栃木", "群馬", "埼玉", "千葉", "東東京", "西東京", "神奈川", "山梨", "静岡", "愛知", "岐阜", "三重", "新潟", "長野", "富山", "石川", "福井", "滋賀", "京都", "大阪", "兵庫", "奈良", "和歌山", "岡山", "広島", "鳥取", "島根", "山口", "香川", "徳島", "愛媛", "高知", "福岡", "佐賀", "長崎", "熊本", "大分", "宮崎", "鹿児島", "沖縄"];
function prefOrderIndex(v){
  const p=String(v||"");
  if(p==="北海道") return 0;
  if(p==="東京") return Math.max(0,BASEBALL_PREF_ORDER.indexOf("東東京"));
  const i=BASEBALL_PREF_ORDER.indexOf(p);
  return i>=0?i:9999;
}
function sortPrefectureNames(values){
  return [...new Set((values||[]).filter(Boolean))].sort((a,b)=>prefOrderIndex(a)-prefOrderIndex(b)||String(a).localeCompare(String(b),"ja"));
}
const PREF_RATING_LAST_SELECTION_KEY = "hsbbl_pref_rating_last_selection_v1";
let masterIndexKind = "region";

const MASTER_STORAGE_KEY = "hsbbl_school_master_v3";
const GITHUB_SYNC_CONFIG_KEY = "hsbbl_github_sync_v1";
const GITHUB_SYNC_TOKEN_KEY = "hsbbl_github_sync_token_v1";
const SHARED_MASTER_PATH = "master/school_master_shared.json";
const MATCH_EDITS_PATH = "master/match_edits_shared.json";
const MATCH_DELETE_INDEX_PATH = "master/match_delete_index.json";
let matchEditsState = {version:1,updated_at:"",manual_matches:[],overrides:[],team_links:[],deleted_matches:[]};
let matchEditsSha = "";

const FAST_SAVE_DELAY_MS = 3200;
const MATCH_EDITS_PENDING_KEY = "hsbbl_match_edits_pending_v1";
const MATCH_EDITS_LOCAL_MIRROR_KEY = "hsbbl_match_edits_local_mirror_v1";
const MANUAL_MATCH_BACKUP_KEY = "hsbbl_manual_matches_backup_v64_8_1";
const LEGACY_MANUAL_MATCH_BACKUP_KEY = "hsbbl_manual_matches_backup_v64_6";
const MATCH_AUTHORITY_JOURNAL_KEY = "hsbbl_match_authority_journal_v64_8_1";
let lastMatchEditsLoadSource = "";
let masterSaveTimer=null;
let matchSaveTimer=null;
let masterSaveInFlight=false;
let matchSaveInFlight=false;
let masterSaveDirty=false;
let matchSaveDirty=false;
let masterQueuedMessage="Update shared school master";
let matchQueuedMessage="Update match ledger edits";

// Match ledger saves are serialized here. User operations never wait on a busy lock;
// they are appended to this queue and committed in order/coalesced into the next batch.
let matchSaveQueue=[];
let matchSaveDrainPromise=null;
let matchSaveSequence=0;
let matchSaveCommittedSequence=0;

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
  // Persistent distinction: immediate rows are provisional until GitHub write is verified.
  const sync=document.getElementById("publicationSyncDetails");
  if(sync){
    let local=document.getElementById("ledgerLocalSaveState");
    if(!local){
      local=document.createElement("div");local.id="ledgerLocalSaveState";
      local.style.cssText="margin-top:6px;font-weight:700";sync.after(local);
    }
    local.textContent=state==="saved"?
      "台帳編集：GitHub保存確認済み（公開台帳とRatingへの反映は別途確認）":
      state==="error"?"台帳編集：保存未確定・再試行待ち":
      "台帳編集：仮表示／GitHub保存待ち（まだ再計算対象とは限りません）";
  }
  clearTimeout(el._hideTimer);
  if(state==="saved"){
    el._hideTimer=setTimeout(()=>el.classList.remove("show"),1800);
  }
}

function compactMatchEditsState(state){
  const out={...emptyMatchEditsState(),...(state||{})};
  const latestDeleted=new Map();
  for(const d of out.deleted_matches||[]){
    const key=String(d?.edit_key||""); if(!key) continue;
    const prev=latestDeleted.get(key);
    if(!prev || matchEditRecordTime(d)>=matchEditRecordTime(prev)) latestDeleted.set(key,{...d});
  }
  out.deleted_matches=[...latestDeleted.values()];

  // V64.8: keep only the newest authoritative operation for each immutable match_id.
  // This journal is the final user intent layer: ADD/UPDATE/DELETE survives reloads
  // even when the generated CSV or legacy edit_key representation changes.
  const latestAuthority=new Map();
  for(const op of out.authority_ops||[]){
    const id=String(op?.match_id||""); if(!id) continue;
    const prev=latestAuthority.get(id);
    if(!prev || matchEditRecordTime(op)>=matchEditRecordTime(prev)) latestAuthority.set(id,{...op});
  }
  out.authority_ops=[...latestAuthority.values()];

  const deleted=new Set(out.deleted_matches.map(x=>String(x.edit_key||"")));

  // A delete tombstone is authoritative. Physically remove mutable records for
  // that key so a stale remote/manual mirror can never resurrect the row.
  out.manual_matches=(out.manual_matches||[]).filter(x=>!deleted.has(String(x.manual_id||x.edit_key||"")));
  out.overrides=(out.overrides||[]).filter(x=>!deleted.has(String(x.edit_key||"")));
  out.team_links=(out.team_links||[]).filter(x=>!deleted.has(String(x.edit_key||"")));
  return out;
}
function loadAuthorityJournal(){
  try{
    const raw=localStorage.getItem(MATCH_AUTHORITY_JOURNAL_KEY);
    const arr=raw?JSON.parse(raw):[];
    return Array.isArray(arr)?arr:[];
  }catch(e){ return []; }
}
function persistAuthorityJournalOp(op){
  if(!op?.match_id) return;
  try{
    const map=new Map(loadAuthorityJournal().map(x=>[String(x.match_id||""),x]));
    map.set(String(op.match_id),op);
    const rows=[...map.values()]
      .sort((a,b)=>matchEditRecordTime(b)-matchEditRecordTime(a))
      .slice(0,1500);
    localStorage.setItem(MATCH_AUTHORITY_JOURNAL_KEY,JSON.stringify(rows));
  }catch(e){ console.warn("authority journal save failed",e); }
}
function mergeAuthorityJournalIntoState(){
  const journal=loadAuthorityJournal();
  if(!journal.length) return;
  matchEditsState=compactMatchEditsState(
    mergeMatchEditStates(matchEditsState,{...emptyMatchEditsState(),authority_ops:journal})
  );
}

function compactDeleteIndexPayload(state=matchEditsState){
  const deletes=(state?.authority_ops||[])
    .filter(op=>String(op?.action||"").toUpperCase()==="DELETE" && String(op?.match_id||"").trim())
    .map(op=>{
      const s=op.snapshot||{};
      return {
        match_id:String(op.match_id),
        updated_at:op.updated_at||"",
        snapshot:{
          year:s.year||"",season:s.season||"",prefecture:s.prefecture||"",
          date:s.date||"",tournament:s.tournament||"",round:s.round||"",
          team1:s.team1||"",score1:s.score1??"",team2:s.team2||"",score2:s.score2??"",
          manual_id:s.manual_id||"",source_url:s.source_url||"",_source_file:s._source_file||""
        }
      };
    });
  return {version:1,updated_at:new Date().toISOString(),deletes};
}
function mergeDeleteIndexIntoState(index){
  const deletes=Array.isArray(index?.deletes)?index.deletes:[];
  if(!deletes.length) return 0;
  const authority_ops=deletes.map(x=>({
    match_id:String(x.match_id||""),
    action:"DELETE",
    updated_at:x.updated_at||index.updated_at||"",
    snapshot:x.snapshot||{},
    changes:{}
  })).filter(x=>x.match_id);
  matchEditsState=compactMatchEditsState(
    mergeMatchEditStates(matchEditsState,{...emptyMatchEditsState(),authority_ops})
  );
  return authority_ops.length;
}
async function loadMatchDeleteIndexFast(){
  const cfg=loadGitHubSyncConfig();
  if(!cfg?.owner||!cfg?.repo) return false;
  try{
    const branch=cfg.branch||"main";
    const safePath=MATCH_DELETE_INDEX_PATH.split("/").map(encodeURIComponent).join("/");
    const url=`https://raw.githubusercontent.com/${encodeURIComponent(cfg.owner)}/${encodeURIComponent(cfg.repo)}/${encodeURIComponent(branch)}/${safePath}?t=${Date.now()}`;
    const res=await fetch(url,{cache:"no-store"});
    if(!res.ok) return false;
    mergeDeleteIndexIntoState(await res.json());
    return true;
  }catch(err){
    console.warn("delete index fast load failed",err);
    return false;
  }
}
async function pushMatchDeleteIndexToGitHub(message="Refresh match delete index"){
  const cfg=loadGitHubSyncConfig();
  if(!cfg.owner||!cfg.repo||!githubSessionToken) throw new Error("GitHub同期設定が必要です");
  const payload=compactDeleteIndexPayload();
  let lastErr=null;
  for(let attempt=1;attempt<=5;attempt++){
    try{
      const remote=await fetchGithubJsonFile(MATCH_DELETE_INDEX_PATH);
      const body={
        message,
        branch:cfg.branch||"main",
        content:utf8ToBase64(JSON.stringify(payload,null,2)+"\n")
      };
      if(remote?.sha) body.sha=remote.sha;
      return await githubApi(`/contents/${MATCH_DELETE_INDEX_PATH}`,{
        method:"PUT",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify(body)
      });
    }catch(err){
      lastErr=err;
      if(!/GitHub (409|422)/.test(String(err?.message||err)) || attempt===5) break;
      await new Promise(r=>setTimeout(r,[180,350,650,1100,1700][attempt-1]));
    }
  }
  throw lastErr||new Error("削除索引の共有保存に失敗しました");
}

function persistManualMatchesBackup(){
  try{
    const compact=compactMatchEditsState(matchEditsState);
    // Keep this backup deliberately small. The old implementation copied the
    // entire deleted_matches list (several MB) and exceeded mobile localStorage.
    localStorage.setItem(MANUAL_MATCH_BACKUP_KEY,JSON.stringify({
      saved_at:new Date().toISOString(),
      manual_matches:[...(compact.manual_matches||[])],
      authority_ops:[...(compact.authority_ops||[])]
        .sort((a,b)=>matchEditRecordTime(b)-matchEditRecordTime(a))
        .slice(0,1500)
    }));
  }catch(e){
    console.warn("manual match backup failed",e);
  }
}
function loadManualMatchesBackupState(){
  for(const key of [MANUAL_MATCH_BACKUP_KEY,LEGACY_MANUAL_MATCH_BACKUP_KEY]){
    try{
      const raw=localStorage.getItem(key);
      if(!raw) continue;
      const parsed=JSON.parse(raw);
      return {
        ...emptyMatchEditsState(),
        manual_matches:Array.isArray(parsed?.manual_matches)?parsed.manual_matches:[],
        deleted_matches:Array.isArray(parsed?.deleted_matches)?parsed.deleted_matches:[],
        authority_ops:Array.isArray(parsed?.authority_ops)?parsed.authority_ops:[]
      };
    }catch(e){}
  }
  return emptyMatchEditsState();
}
function loadManualMatchesBackup(){ return loadManualMatchesBackupState().manual_matches||[]; }
function mergeManualBackupIntoState(){
  const backup=loadManualMatchesBackupState();
  if((backup.manual_matches||[]).length || (backup.deleted_matches||[]).length || (backup.authority_ops||[]).length){
    matchEditsState=compactMatchEditsState(mergeMatchEditStates(matchEditsState,backup));
  }
  // Always replay the tiny operation journal last. This survives reload even
  // when the full 3-4MB edit snapshot cannot fit in mobile localStorage.
  mergeAuthorityJournalIntoState();
}
function persistMatchEditsLocalMirror(){
  // Full mirror can exceed localStorage quota as the ledger grows. Manual games are
  // therefore also kept in a small independent backup that survives that failure.
  persistManualMatchesBackup();
  try{
    localStorage.setItem(MATCH_EDITS_LOCAL_MIRROR_KEY,JSON.stringify({
      saved_at:new Date().toISOString(),
      state:matchEditsState
    }));
  }catch(e){
    console.warn("match edits full mirror failed; manual backup remains available",e);
  }
}
function loadMatchEditsLocalMirror(){
  try{
    const raw=localStorage.getItem(MATCH_EDITS_LOCAL_MIRROR_KEY);
    if(!raw) return null;
    const parsed=JSON.parse(raw);
    return parsed?.state||parsed||null;
  }catch(e){ return null; }
}
function persistPendingMatchEdits(){
  persistMatchEditsLocalMirror();
  try{
    localStorage.setItem(MATCH_EDITS_PENDING_KEY,JSON.stringify({
      saved_at:new Date().toISOString(),
      state:matchEditsState
    }));
  }catch(e){}
}
function clearPendingMatchEdits(){
  try{ localStorage.removeItem(MATCH_EDITS_PENDING_KEY); }catch(e){}
}
function restorePendingMatchEdits(){
  try{
    const raw=localStorage.getItem(MATCH_EDITS_PENDING_KEY);
    if(!raw) return;
    const parsed=JSON.parse(raw);
    const pending=parsed?.state||parsed; // V16以前の形式も読む
    matchEditsState=mergeMatchEditStates(matchEditsState,pending);
  }catch(e){ console.warn("pending match edits restore failed",e); }
}

function queueSharedMasterSave(message="Update shared school master"){
  saveUnionTeamsLocal();
  sharedMasterState=currentSharedMasterState();
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
    if(matchSaveQueue.length||matchSaveInFlight||matchSaveDirty||matchSaveCommittedSequence<matchSaveSequence){
      fastSaveStatus("対戦台帳：保存継続中","saving");
    }else{
      fastSaveStatus("学校マスタ：保存済み","saved");
    }
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

function dedupeMatchSaveVerifications(items,keyFn){
  const m=new Map();
  for(const x of items||[]){
    const k=keyFn(x);
    if(k)m.set(k,x);
  }
  return [...m.values()];
}

function matchSaveStateLabel(){
  return `queued=${matchSaveQueue.length} inFlight=${matchSaveInFlight?1:0} seq=${matchSaveCommittedSequence}/${matchSaveSequence}`;
}
function enqueueMatchEditsSave(message="Update match ledger edits",verifyOverrides=[],verifyManualIds=[],verifyTeamLinks=[],verifyDeletedKeys=[]){
  persistPendingMatchEdits();
  matchSaveDirty=true;
  const seq=++matchSaveSequence;

  const p=new Promise((resolve,reject)=>{
    matchSaveQueue.push({
      seq,message,
      verifyOverrides:[...(verifyOverrides||[])],
      verifyManualIds:[...(verifyManualIds||[])],
      verifyTeamLinks:[...(verifyTeamLinks||[])],
      verifyDeletedKeys:[...(verifyDeletedKeys||[])],
      resolve,reject
    });
  });

  fastSaveStatus(`対戦台帳：保存待ち ${matchSaveQueue.length}件`,"pending");

  if(!matchSaveDrainPromise){
    matchSaveDrainPromise=(async()=>{
      // Tiny coalescing window: rapid taps become one GitHub write.
      await new Promise(r=>setTimeout(r,120));
      await drainMatchEditsSaveQueue();
    })().finally(()=>{matchSaveDrainPromise=null;});
  }
  return p;
}

async function verifyMatchEditsCommit(pushed,verifyOverrides=[],verifyManualIds=[],verifyTeamLinks=[],verifyDeletedKeys=[]){
  const cfg=loadGitHubSyncConfig();
  const commitRef=pushed?.commit?.sha||"";
  const contentSha=pushed?.content?.sha||"";

  let remote=null,lastVerifyErr=null;
  for(const delay of [0,200,500,1000]){
    if(delay) await new Promise(r=>setTimeout(r,delay));
    try{
      if(contentSha){
        remote=await fetchGithubJsonBlob(contentSha);
      }else{
        remote=await fetchGithubJsonFileAtRef(MATCH_EDITS_PATH,commitRef||cfg.branch||"main");
      }
      if(remote?.state) break;
    }catch(err){
      lastVerifyErr=err;
    }
  }
  if(!remote?.state) throw lastVerifyErr||new Error("保存内容の再読込に失敗しました");

  if(contentSha && remote.sha && contentSha!==remote.sha){
    throw new Error(`保存内容SHA不一致: ${remote.sha} / ${contentSha}`);
  }

  const failures=[];
  const remoteOverrides=new Map((remote.state.overrides||[]).map(x=>[String(x.edit_key||""),x.changes||{}]));
  for(const v of verifyOverrides){
    const got=remoteOverrides.get(String(v.edit_key||""));
    if(!got){failures.push(`${v.edit_key}: overrideなし`);continue;}
    for(const [k,expected] of Object.entries(v.changes||{})){
      if(String(got[k]??"")!==String(expected??"")){
        failures.push(`${v.edit_key}: ${k}=${got[k]??""} (期待 ${expected??""})`);
        break;
      }
    }
  }

  const remoteManual=new Set((remote.state.manual_matches||[]).map(x=>String(x.manual_id||"")));
  for(const mid of verifyManualIds){
    if(!remoteManual.has(String(mid))) failures.push(`${mid}: manual_matchなし`);
  }

  const remoteDeleted=new Set((remote.state.deleted_matches||[]).map(x=>String(x.edit_key||"")));
  for(const key of verifyDeletedKeys){
    const k=String(key||"");
    if(!remoteDeleted.has(k)) failures.push(`${k}: 削除記録なし`);
    if(remoteManual.has(k)) failures.push(`${k}: 削除済みmanual_matchが残存`);
  }

  const remoteLinks=new Map((remote.state.team_links||[]).map(x=>[
    `${String(x.edit_key||"")}|${String(x.side||"")}`,x
  ]));
  for(const expected of verifyTeamLinks){
    const lk=`${String(expected.edit_key||"")}|${String(expected.side||"")}`;
    const got=remoteLinks.get(lk);
    if(!got){failures.push(`${lk}: team_linkなし`);continue;}
    if(String(got.school_id||"")!==String(expected.school_id||"") ||
       String(got.canonical_name||"")!==String(expected.canonical_name||"")){
      failures.push(`${lk}: ${got.canonical_name||got.school_id||"?"} (期待 ${expected.canonical_name||expected.school_id||"?"})`);
    }
  }

  if(failures.length){
    throw new Error(`GitHub保存コミットの照合に失敗しました (${failures.length}件)。先頭: ${failures[0]}`);
  }

  // Remote commit is the durable base; merge only genuinely newer in-memory edits.
  matchEditsState=mergeMatchEditStates(remote.state,matchEditsState);
  matchEditsSha=remote.sha||contentSha||matchEditsSha;
  matchTeamLinkMap=new Map((matchEditsState.team_links||[]).map(x=>[`${x.edit_key}|${x.side}`,x]));
  // Keep a durable same-device mirror even after GitHub verification.
  // Pages/output may lag behind the master commit for a short period; without
  // this mirror a reload could temporarily make a just-saved manual game vanish.
  persistMatchEditsLocalMirror();

  return {
    verified:verifyOverrides.length+verifyManualIds.length+verifyTeamLinks.length,
    commit:commitRef
  };
}

async function drainMatchEditsSaveQueue(){
  if(matchSaveInFlight) return;

  const cfg=loadGitHubSyncConfig();
  if(!cfg.owner||!cfg.repo||!githubSessionToken){
    matchSaveDirty=true;
    fastSaveStatus("対戦台帳：端末保存済み（GitHub未設定）","error");
    const err=new Error("GitHub同期設定がないため共有保存できません。");
    const waiting=matchSaveQueue.splice(0);
    waiting.forEach(x=>x.reject(err));
    return;
  }

  let consecutiveFailures=0;
  while(matchSaveQueue.length){
    // Take every edit currently waiting. Edits arriving during this write
    // stay in matchSaveQueue and become the next batch automatically.
    const batch=matchSaveQueue.splice(0);
    const last=batch[batch.length-1];
    const verifyOverrides=dedupeMatchSaveVerifications(
      batch.flatMap(x=>x.verifyOverrides||[]),
      x=>String(x.edit_key||"")
    );
    const verifyManualIds=[...new Set(batch.flatMap(x=>x.verifyManualIds||[]).map(String))];
    const verifyTeamLinks=dedupeMatchSaveVerifications(
      batch.flatMap(x=>x.verifyTeamLinks||[]),
      x=>`${String(x.edit_key||"")}|${String(x.side||"")}`
    );
    const verifyDeletedKeys=[...new Set(batch.flatMap(x=>x.verifyDeletedKeys||[]).map(String))];

    matchSaveInFlight=true;
    matchQueuedMessage=last?.message||"Update match ledger edits";
    fastSaveStatus(`対戦台帳：GitHub保存中（${batch.length}操作）`,"saving");

    try{
      const pushed=await pushMatchEditsShared(
        batch.length>1 ? `${matchQueuedMessage} (+${batch.length-1} queued edits)` : matchQueuedMessage
      );
      const result=await verifyMatchEditsCommit(
        pushed,verifyOverrides,verifyManualIds,verifyTeamLinks,verifyDeletedKeys
      );

      consecutiveFailures=0;
      matchSaveCommittedSequence=Math.max(
        matchSaveCommittedSequence,
        ...batch.map(x=>Number(x.seq||0))
      );
      batch.forEach(x=>x.resolve(result));

      // If more edits arrived while this commit was running, keep pending state.
      if(matchSaveQueue.length || matchSaveCommittedSequence < matchSaveSequence){
        persistPendingMatchEdits();
        fastSaveStatus(`対戦台帳：続けて保存中（残り${matchSaveQueue.length||1}操作）`,"saving");
      }
    }catch(err){
      console.error(err);
      // Requeue the failed batch at the front. Keep a local durable snapshot.
      matchSaveQueue=[...batch,...matchSaveQueue];
      matchSaveDirty=true;
      persistPendingMatchEdits();
      fastSaveStatus(`対戦台帳：再試行待ち（${matchSaveQueue.length}操作）`,"error");

      // Stop an endless retry storm; keep a durable local snapshot for recovery.
      consecutiveFailures++;
      if(consecutiveFailures>=3){
        const detail=String(err?.message||err).slice(0,160);
        fastSaveStatus("対戦台帳：GitHub保存失敗。端末に変更を保護しました。再読込せず確認してください。","error");
        const pending=matchSaveQueue.splice(0);
        const failure=new Error("GitHub保存失敗（3回）。"+detail+" / 編集内容は端末の保留データに保存済み");
        pending.forEach(item=>item.reject(failure));
        matchSaveDirty=true;
        persistPendingMatchEdits();
        break;
      }
      await new Promise(r=>setTimeout(r,Math.min(5000,1200*consecutiveFailures)));
      matchSaveInFlight=false;
      continue;
    }finally{
      matchSaveInFlight=false;
    }
  }

  const fullySaved=
    !matchSaveQueue.length &&
    !matchSaveInFlight &&
    matchSaveCommittedSequence>=matchSaveSequence;

  if(fullySaved){
    matchSaveDirty=false;
    clearPendingMatchEdits();
    fastSaveStatus(`対戦台帳：保存済み #${matchSaveCommittedSequence}`,"saved");
  }else{
    matchSaveDirty=true;
    persistPendingMatchEdits();
    fastSaveStatus("対戦台帳：保存継続中","saving");
    if(matchSaveQueue.length && !matchSaveDrainPromise){
      matchSaveDrainPromise=drainMatchEditsSaveQueue().finally(()=>{matchSaveDrainPromise=null;});
    }
  }
}

function queueMatchEditsSave(message="Update match ledger edits"){
  // V20: no delayed timer. Every mutation enters the same queue immediately.
  // This removes the gap where the UI could say "saved" while a 3-second timer
  // still held a not-yet-enqueued change.
  matchQueuedMessage=message;
  clearTimeout(matchSaveTimer);
  enqueueMatchEditsSave(message).catch(err=>console.error(err));
}

async function flushMatchEditsSave(){
  clearTimeout(matchSaveTimer);
  if(matchSaveQueue.length || matchSaveInFlight || matchSaveDirty){
    if(!matchSaveDrainPromise && matchSaveQueue.length){
      matchSaveDrainPromise=drainMatchEditsSaveQueue().finally(()=>{matchSaveDrainPromise=null;});
    }
    return matchSaveDrainPromise;
  }
}

async function saveMatchEditsImmediately(message,verifyOverrides=[],verifyManualIds=[],verifyTeamLinks=[],verifyDeletedKeys=[]){
  clearTimeout(matchSaveTimer);
  // No busy lock and no retry dialog: the operation joins the queue immediately.
  return enqueueMatchEditsSave(message,verifyOverrides,verifyManualIds,verifyTeamLinks,verifyDeletedKeys);
}

window.addEventListener("pagehide",()=>{
  saveUnionTeamsLocal();
  // ブラウザ終了時にも未保存内容はlocalStorageへ残し、次回起動時に復元する。
  if(matchSaveDirty||matchSaveInFlight||matchSaveQueue.length||matchSaveCommittedSequence<matchSaveSequence) persistPendingMatchEdits();
});


let sharedMasterState = null;
let unionTeams = loadUnionTeamsLocal();
let sharedMasterSha = "";
let githubSessionToken = "";
let deletedSchoolTombstones = [];


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
const REGION_CANONICAL={hokkaido:"北海道",tohoku:"東北",kanto_tokyo:"関東・東京",kanto:"関東・東京",tokyo:"東京",hokushinetsu:"北信越",tokai:"東海",kinki:"近畿",chugoku:"中国",shikoku:"四国",kyushu:"九州",national:"全国","北海道":"北海道","東北":"東北","関東・東京":"関東・東京","関東":"関東・東京","東京":"東京","北信越":"北信越","東海":"東海","近畿":"近畿","中国":"中国","四国":"四国","九州":"九州","全国":"全国"};
function normalizeRegionName(v){const s=String(v||"").trim();return REGION_CANONICAL[s]||s;}


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

function effectiveMatchLevel(r){
  const raw=getLevel(r?.note)||r?.level||"";
  const rawSeason=String(r?.season||"").trim();

  // National competition seasons are authoritative regardless of stale tags.
  if(["senbatsu","koshien","jingu"].includes(rawSeason)) return "national";

  // V48: an explicit level written into the row is authoritative.
  // level_overrides.csv and manual ledger edits are applied upstream to
  // output/all_matches.csv, so UI heuristics must never overwrite them.
  const explicitLevels=new Set([
    "branch",
    "district_qualifier",
    "first_qualifier",
    "preliminary",
    "qualifier_league",
    "repechage",
    "prefecture",
    "regional",
    "national"
  ]);
  if(explicitLevels.has(raw)) return raw;

  // Heuristics are fallback-only for legacy rows that have no explicit level.
  const season=({senbatsu:"spring",koshien:"summer",jingu:"autumn"})[rawSeason]||rawSeason;
  const text=`${r?.tournament||""} ${r?.round||""} ${r?.note||""} ${r?.prefecture||""} ${r?.region||""}`;
  if(/北海道|北北海道|南北海道/.test(text)){
    if(season==="spring"||season==="autumn"){
      if(/(全道|北海道大会|道大会)/.test(text) && !/(支部|支庁)/.test(text)) return "regional";
      if(/支部|支庁/.test(text)) return "prefecture";
    }
    if(season==="summer") return "prefecture";
  }
  if(/東京|東東京|西東京/.test(text)){
    if(season==="spring"){
      if(/(一次|1次|１次|予選)/.test(text) && !/(都大会|本大会)/.test(text)) return "district_qualifier";
      return "prefecture";
    }
    if(season==="summer") return "prefecture";
    if(season==="autumn"){
      if(/(一次|1次|１次|ブロック)/.test(text) && !/(都大会|本大会)/.test(text)) return "prefecture";
      const rr=String(r?.round||"").replace(/[\\s　]/g,"");
      if(/3回戦|３回戦|4回戦|４回戦|準々決勝|準決勝|(?<!準)決勝|QF|SF|R16/i.test(rr)) return "regional";
      return "prefecture";
    }
  }
  return raw;
}

function noteValue(note,key){
  const m = String(note||"").match(new RegExp(`(?:^|;)${key}=([^;]+)`));
  return m ? m[1] : "";
}


function inferredInningsAndFinish(r){
  const note=String(r?.note||"");

  const cold=note.match(/(?:^|[;,\s])([5-8])回コールド/);
  if(cold) return {innings:Number(cold[1]),finish_type:"cold"};

  const extra=note.match(/延長\s*(1\d|2\d|30)回/);
  if(extra) return {innings:Number(extra[1]),finish_type:"extra"};

  const n=Number(r?.innings||0);
  const f=String(r?.finish_type||"").toLowerCase();
  if(f==="cold" && n>=5 && n<=8) return {innings:n,finish_type:"cold"};
  if(f==="extra" && n>=10) return {innings:n,finish_type:"extra"};
  if(f==="normal" && n===9) return {innings:9,finish_type:"normal"};

  // Never interpret "2回戦", "3回戦", or "第108回大会" as innings.
  return {innings:9,finish_type:"normal"};
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

function stableMatchIdHash(value){
  let h=2166136261;
  const s=String(value||"");
  for(let i=0;i<s.length;i++){ h^=s.charCodeAt(i); h=Math.imul(h,16777619); }
  return (h>>>0).toString(36).toUpperCase().padStart(7,"0");
}

function matchAuthorityFingerprint(r){
  if(r?.manual_id) return String(r.manual_id);
  const clean=v=>cleanSchoolNoiseName(v).replace(/[\s　]+/g,"").toLowerCase();
  const pair=[
    [clean(r?.team1),scoreKey(r?.score1)],
    [clean(r?.team2),scoreKey(r?.score2)]
  ].sort((a,b)=>a[0].localeCompare(b[0],"ja")||a[1].localeCompare(b[1]));
  return [
    String(r?.year||"").trim(),
    String(r?.season||"").trim(),
    String(r?.prefecture||"").trim(),
    normalizeDateValue(r?.date)||String(r?.date||"").trim(),
    String(r?.tournament||"").replace(/[\s　]+/g,"").trim(),
    String(r?.round||"").replace(/[\s　]+/g,"").trim(),
    pair[0][0],pair[0][1],pair[1][0],pair[1][1]
  ].join("¦");
}

function matchAuthorityId(r){
  const explicit=String(r?.match_id||r?.authority_id||"").trim();
  if(explicit) return explicit;
  if(r?.manual_id) return String(r.manual_id);
  return `SRC-${stableMatchIdHash(matchAuthorityFingerprint(r))}`;
}
function ledgerSelectionKey(r){ return matchAuthorityId(r); }

function matchAuthorityPair(r){
  const clean=v=>cleanSchoolNoiseName(v).replace(/[\s　]+/g,"").toLowerCase();
  return [
    [clean(r?.team1),scoreKey(r?.score1)],
    [clean(r?.team2),scoreKey(r?.score2)]
  ].sort((a,b)=>a[0].localeCompare(b[0],"ja")||a[1].localeCompare(b[1]));
}
function authoritySnapshotMatchesRow(row,snap){
  if(!row||!snap) return false;
  const mid=String(snap.manual_id||"").trim();
  if(mid && String(row.manual_id||"").trim()===mid) return true;
  if(String(row.year||"").trim()!==String(snap.year||"").trim()) return false;
  if(String(row.season||"").trim()!==String(snap.season||"").trim()) return false;
  if((normalizeDateValue(row.date)||String(row.date||"").trim())!==(normalizeDateValue(snap.date)||String(snap.date||"").trim())) return false;
  const a=matchAuthorityPair(row),b=matchAuthorityPair(snap);
  if(JSON.stringify(a)!==JSON.stringify(b)) return false;

  // V66.1: source_url/source_file are only supporting evidence, never enough
  // to delete a different ledger record. This matters when the same result page
  // produced both a good row and a broken row with a blank tournament name.
  const norm=v=>String(v||"").replace(/[\s　]+/g,"").trim().toLowerCase();
  if(norm(row.tournament)!==norm(snap.tournament)) return false;
  if(norm(row.round)!==norm(snap.round)) return false;

  const sf=String(snap._source_file||"").trim();
  const su=String(snap.source_url||"").trim();
  if(sf && String(row._source_file||"").trim() && String(row._source_file||"").trim()!==sf) return false;
  if(su && String(row.source_url||"").trim() && String(row.source_url||"").trim()!==su) return false;
  return true;
}
function activeAuthorityDeleteOps(){
  return (matchEditsState.authority_ops||[]).filter(x=>String(x?.action||"").toUpperCase()==="DELETE");
}
function isAuthorityDeletedRow(row){
  const id=matchAuthorityId(row);
  for(const op of activeAuthorityDeleteOps()){
    if(String(op.match_id||"")===id) return true;
    if(authoritySnapshotMatchesRow(row,op.snapshot||{})) return true;
  }
  return false;
}
function purgeDeletedRowsFromMemory(){
  const beforeA=allMatches.length,beforeL=ledgerMatches.length;
  allMatches=allMatches.filter(r=>!isAuthorityDeletedRow(r));
  ledgerMatches=ledgerMatches.filter(r=>!isAuthorityDeletedRow(r));
  return (beforeA-allMatches.length)+(beforeL-ledgerMatches.length);
}

function appendMatchAuthorityOp(action,row,changes={}){
  const matchId=matchAuthorityId(row);
  const now=new Date().toISOString();
  const ops=matchEditsState.authority_ops||(matchEditsState.authority_ops=[]);
  const snapshot={...row,...changes,match_id:matchId};
  delete snapshot._id;
  const op={
    op_id:`${matchId}-${Date.now()}-${Math.random().toString(36).slice(2,8)}`,
    match_id:matchId,
    action:String(action||"UPDATE").toUpperCase(),
    changes:{...changes},
    snapshot,
    updated_at:now
  };
  const i=ops.findIndex(x=>String(x.match_id||"")===matchId);
  if(i>=0) ops[i]=op; else ops.push(op);
  persistAuthorityJournalOp(op);
  return op;
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

function cleanSchoolNoiseName(value){
  let s=String(value||"").replace(/\u00a0/g," ").trim();
  // Tournament pages often use decorative bullets before school names. They are
  // presentation marks, not part of the school identity. Strip only at the head.
  s=s.replace(/^[\s　]*(?:[■□▪▫●○◆◇▲△▼▽★☆◎◉◯・･▶▷▸▹►▻✓✔☑☐☒※]+[\s　]*)+/u,"");
  return s.trim();
}

function normalizeRows(rows){
  return rows.map((r,idx)=>({
    ...r,
    _id:idx,
    year:String(r.year||"").trim(),
    season:String(r.season||"").trim(),
    region:normalizeRegionName(r.region),
    prefecture:normalizePrefectureDisplayName(r.prefecture||"").trim(),
    sub_area:String(r.sub_area||noteValue(r.note,"local_district")||noteValue(r.note,"branch")||noteValue(r.note,"sub_area")||"").trim(),
    date:String(r.date||"").trim(),
    team1:cleanSchoolNoiseName(r.team1),
    team2:cleanSchoolNoiseName(r.team2),
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
    match_id:matchAuthorityId(r),
    team1_school_id:String(r.team1_school_id||"").trim(),
    team2_school_id:String(r.team2_school_id||"").trim(),
    team1_canonical:String(r.team1_canonical||"").trim(),
    team2_canonical:String(r.team2_canonical||"").trim(),
    level:effectiveMatchLevel(r)
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

function loadUnionTeamsLocal(){
  try{
    const x=JSON.parse(localStorage.getItem(UNION_TEAMS_STORAGE_KEY)||"[]");
    return Array.isArray(x)?x:[];
  }catch(e){ return []; }
}
function saveUnionTeamsLocal(){
  try{ localStorage.setItem(UNION_TEAMS_STORAGE_KEY,JSON.stringify(unionTeams||[])); }catch(e){}
}
function unionUpdatedAtMs(x){
  const t=Date.parse(String(x?.updated_at||""));
  return Number.isFinite(t)?t:0;
}
function mergeUnionRecord(a,b){
  if(!a) return b?{...b}:null;
  if(!b) return {...a};
  const am=(a.members||[]).length, bm=(b.members||[]).length;
  // Never let an old local draft with empty members erase a resolved remote union.
  if(am>0 && bm===0) return {...b,...a,members:a.members};
  if(bm>0 && am===0) return {...a,...b,members:b.members};
  const newer=unionUpdatedAtMs(b)>=unionUpdatedAtMs(a)?b:a;
  const older=newer===b?a:b;
  return {...older,...newer,members:(newer.members||[]).length?newer.members:(older.members||[])};
}
function mergeUnionLocalRemote(remote,local){
  const m=new Map();
  for(const x of remote||[]){ if(x?.union_id) m.set(x.union_id,{...x}); }
  for(const x of local||[]){
    if(!x?.union_id) continue;
    m.set(x.union_id,mergeUnionRecord(m.get(x.union_id),x));
  }
  return [...m.values()];
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
  deletedSchoolTombstones=Array.isArray(state.deleted_schools)?state.deleted_schools:[];
  unionTeams=mergeUnionLocalRemote(Array.isArray(state.unions)?state.unions:[],loadUnionTeamsLocal());
  saveUnionTeamsLocal();syncUnionComponentsToSchoolMaster();
  if(Array.isArray(state.lineage)) schoolLineage=state.lineage;
  if(Array.isArray(state.local_areas)) localAreas=state.local_areas;
  if(Array.isArray(state.representative_areas)) repAreas=state.representative_areas;
  saveMasterToStorage();
  saveLineage();
  saveAreaMasters();
  return true;
}

function unionDisplayNameSet(){return new Set((unionTeams||[]).map(u=>String(u.display_name||"").trim()).filter(Boolean));}
function syncUnionComponentsToSchoolMaster(){
  const labels=unionDisplayNameSet();
  const memberIds=new Set((unionTeams||[])
    .flatMap(u=>(u.members||[]).map(m=>String(m.school_id||"").trim()))
    .filter(Boolean));

  // A union display-name must never survive as a permanent school record.
  // Add a deletion tombstone as well as removing it locally; otherwise a
  // remote/shared-master merge can resurrect the stale row on the next load.
  for(const [name,rec] of [...schoolMaster.entries()]){
    const sid=String(rec?.school_id||"").trim();
    const legacyUnion = rec?.kind==="union" ||
      (labels.has(String(name||"").trim()) && !memberIds.has(sid));
    if(!legacyUnion) continue;

    const exists=(deletedSchoolTombstones||[]).some(x=>
      (sid && String(x.school_id||"")===sid) ||
      String(x.canonical_name||"")===String(name||"")
    );
    if(!exists){
      deletedSchoolTombstones.push({
        school_id:sid,
        canonical_name:String(name||""),
        aliases:rec?.aliases||[],
        deleted_at:new Date().toISOString(),
        reason:"legacy_union_record"
      });
    }
    schoolMaster.delete(name);
  }

  // Union components are real schools and therefore stay in School Master.
  for(const u of unionTeams||[]){
    for(const m of u.members||[]){
      const sid=String(m.school_id||"").trim();
      const name=String(m.school_name||"").trim();
      if(!name)continue;
      const hit=[...schoolMaster.values()].find(x=>
        (sid&&String(x.school_id||"")===sid) || x.canonical_name===name
      );
      if(!hit){
        const pref=normalizePrefectureName(u.prefecture||"");
        const district=normalizeRegionName(u.region||"")||PREF_TO_DISTRICT[pref]||"不明";
        schoolMaster.set(name,{
          school_id:sid||provisionalSchoolId(name,district,pref,"00"),
          canonical_name:name,furigana:"",district,prefecture:pref,
          local_district:"",local_district_id:"",
          representative_area:pref,representative_area_id:"",
          aliases:[name],status:"active",
          established_year:"",closed_year:"",successor_id:"",kind:"school"
        });
      }
    }
  }
  markIdentityIndexesDirty();
}
function currentSharedMasterState(){
  syncUnionComponentsToSchoolMaster();
  return {
    version:1,
    updated_at:new Date().toISOString(),
    schools:[...schoolMaster.values()].sort((a,b)=>a.canonical_name.localeCompare(b.canonical_name,"ja")),
    deleted_schools:deletedSchoolTombstones,
    unions:unionTeams,
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

function mergeListTombstones(a,b){
  const m=new Map();
  for(const x of a||[]){ const k=x.school_id||x.canonical_name; if(k) m.set(k,{...x}); }
  for(const x of b||[]){ const k=x.school_id||x.canonical_name; if(k) m.set(k,{...(m.get(k)||{}),...x}); }
  return [...m.values()];
}

function mergeUnionStates(a,b){
  const m=new Map();
  for(const x of a||[]){if(x.union_id)m.set(x.union_id,{...x});}
  for(const x of b||[]){
    if(!x.union_id) continue;
    m.set(x.union_id,mergeUnionRecord(m.get(x.union_id),x));
  }
  return [...m.values()];
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
  merged.deleted_schools=mergeListTombstones(remoteState.deleted_schools,localState.deleted_schools);
  merged.unions=mergeUnionStates(remoteState.unions,localState.unions);
  const deletedIds=new Set((merged.deleted_schools||[]).map(x=>String(x.school_id||"")).filter(Boolean));
  const deletedNames=new Set((merged.deleted_schools||[]).flatMap(x=>[x.canonical_name,...(x.aliases||[])]).filter(Boolean));
  merged.schools=[...byId.values()].filter(s=>!deletedIds.has(String(s.school_id||"")) && !deletedNames.has(String(s.canonical_name||"")));

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

  for(let attempt=1;attempt<=6;attempt++){
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
    refillSelectPreserve("masterPrefFilter", sortPrefectureNames([...schoolMaster.values()].map(v=>v.prefecture)));
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


function decodeGithubBase64Text(content){
  const binary=atob(String(content||"").replace(/\s+/g,""));
  const bytes=Uint8Array.from(binary,c=>c.charCodeAt(0));
  return new TextDecoder("utf-8").decode(bytes);
}

async function fetchGithubTextFile(path,ref=""){
  const cfg=loadGitHubSyncConfig();
  const targetRef=ref||cfg.branch||"main";
  const data=await githubApi(`/contents/${path}?ref=${encodeURIComponent(targetRef)}`);
  if(data?.content){
    return {sha:data.sha||"",text:decodeGithubBase64Text(data.content)};
  }
  if(data?.sha){
    const blob=await githubApi(`/git/blobs/${data.sha}`);
    if(blob?.content){
      return {sha:data.sha||"",text:decodeGithubBase64Text(blob.content)};
    }
  }
  throw new Error(`${path} の本文を取得できませんでした`);
}

async function dispatchRatingRebuildBestEffort(){
  const cfg=loadGitHubSyncConfig();
  if(!cfg.owner||!cfg.repo||!githubSessionToken) return false;
  try{
    await githubApi(`/actions/workflows/build_rating_events_v2.yml/dispatches`,{
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify({ref:cfg.branch||"main"})
    });
    return true;
  }catch(err){
    console.warn("rating workflow dispatch failed; push trigger remains active",err);
    return false;
  }
}

let ratingAuxLoaded=false;
let ratingAuxLoadingPromise=null;
let ledgerDataLoaded=false;
let ledgerDataLoadingPromise=null;
let ledgerShardManifest=null;
let ledgerLoadedYears=new Set();
let ledgerLoadedSlices=new Set();
let ledgerEditStateLoaded=false;
let ledgerInitialYearPinned=false;
let ledgerInitialRegionPinned=false;
let ledgerPreviewMode=false;

function schoolHistoryShardName(schoolId){
  return String(schoolId||"").slice(0,4).replace(/[^A-Za-z0-9_-]/g,"_") || "misc";
}
async function loadSchoolHistoryBundle(name){
  const raw=String(name||"").trim();
  const direct=schoolMaster.get(raw)||schoolMaster.get(resolveCanonicalName(raw));
  const sid=String(direct?.school_id||"").trim();
  if(!sid) throw new Error("学校IDが未設定のためRating履歴を取得できません");
  const shard=schoolHistoryShardName(sid);
  let data=schoolHistoryShardCache.get(shard);
  if(!data){
    const txt=await fetchTextWithTimeout(`${SCHOOL_HISTORY_BASE_URL}/${encodeURIComponent(shard)}.json`,12000);
    data=JSON.parse(txt);
    schoolHistoryShardCache.set(shard,data);
  }
  const bundle=data?.schools?.[sid];
  if(!bundle) throw new Error(`学校別Rating履歴が未生成です（${sid}）`);
  return bundle;
}
function schoolHistoryRankRows(events){
  return (events||[]).filter(e=>Number.isFinite(Number(e.rank))).map(e=>({
    date:e.date||"",
    tournament:e.event_type==="generation_reset"?"世代交代補正（試合ではない）":e.tournament||"",
    round:e.event_type==="generation_reset"?"夏の敗退後・次世代へ65%持越し":e.round||"",
    event_type:e.event_type||"",
    rank:Number(e.rank),
    previous_rank:e.previous_rank===""||e.previous_rank==null?null:Number(e.previous_rank),
    rank_delta:e.rank_delta===""||e.rank_delta==null?null:Number(e.rank_delta),
    total:Number(e.rank_total||0), rating:Number(e.rating_after),
    rating_before:Number(e.rating_before), rating_delta:Number(e.rating_delta),
    opponent:e.opponent||"", score_for:e.score_for??"", score_against:e.score_against??""
  }));
}
function schoolHistorySnapshot(events,cutoff=""){
  const usable=(events||[]).filter(e=>!cutoff || eventBeforeOrOn(e,cutoff));
  const last=[...usable].filter(e=>Number.isFinite(Number(e.rating_after))).sort(eventChronoCompare).at(-1)||null;
  if(!last) return null;
  return {
    rating:Number(last.rating_after),
    rank:Number.isFinite(Number(last.rank))?Number(last.rank):null,
    total:Number(last.rank_total||0),
    games:usable.filter(e=>e.event_type!=="generation_reset").length
  };
}
async function ensureRatingAuxData(){
  if(ratingAuxLoaded) return true;
  if(ratingAuxLoadingPromise) return ratingAuxLoadingPromise;
  ratingAuxLoadingPromise=(async()=>{
    const jobs=await Promise.allSettled([
      fetchTextWithTimeout(RATING_EVENTS_URL,12000),
      fetchTextWithTimeout(RATING_SCHOOL_EVENTS_URL,12000)
    ]);
    if(jobs[0].status==="fulfilled") ratingEvents=csvParse(jobs[0].value);
    if(jobs[1].status==="fulfilled") ratingSchoolEvents=csvParse(jobs[1].value);
    ratingAuxLoaded=true;
    buildFastIndexes();
    return true;
  })().finally(()=>{ratingAuxLoadingPromise=null;});
  return ratingAuxLoadingPromise;
}

async function loadLedgerShardManifest(){
  if(ledgerShardManifest) return ledgerShardManifest;
  const txt=await fetchTextWithTimeout(`${LEDGER_SHARD_BASE_URL}/manifest.json`,8000);
  ledgerShardManifest=JSON.parse(txt);
  return ledgerShardManifest;
}

async function ensureLedgerEditState(){
  if(ledgerEditStateLoaded) return true;
  await loadMatchEditsShared();
  restorePendingMatchEdits();
  mergeManualBackupIntoState();
  persistManualMatchesBackup();
  ledgerEditStateLoaded=true;
  return true;
}

function ledgerMergeRows(rows){
  const map=new Map((ledgerMatches||[]).map(r=>[matchAuthorityId(r),r]));
  for(const r of rows||[]){
    if(!r || isAuthorityDeletedRow(r)) continue;
    map.set(matchAuthorityId(r),r);
  }
  ledgerMatches=[...map.values()].map((r,i)=>({...r,_id:i}));
}

const LEDGER_REGION_KEYS={
  "北海道":"hokkaido","東北":"tohoku","関東・東京":"kanto_tokyo","関東":"kanto_tokyo","東京":"kanto_tokyo",
  "北信越":"hokushinetsu","東海":"tokai","近畿":"kinki","中国":"chugoku","四国":"shikoku","九州":"kyushu",
  "全国":"national","不明":"other"
};
const LEDGER_REGION_LABELS={
  hokkaido:"北海道",tohoku:"東北",kanto_tokyo:"関東・東京",hokushinetsu:"北信越",tokai:"東海",
  kinki:"近畿",chugoku:"中国",shikoku:"四国",kyushu:"九州",national:"全国",other:"不明"
};
const LEDGER_PREF_REGION={
  "北海道":"北海道","北北海道":"北海道","南北海道":"北海道",
  "青森":"東北","岩手":"東北","秋田":"東北","山形":"東北","宮城":"東北","福島":"東北",
  "茨城":"関東・東京","栃木":"関東・東京","群馬":"関東・東京","埼玉":"関東・東京","千葉":"関東・東京",
  "東京":"関東・東京","東東京":"関東・東京","西東京":"関東・東京","神奈川":"関東・東京","山梨":"関東・東京",
  "新潟":"北信越","長野":"北信越","富山":"北信越","石川":"北信越","福井":"北信越",
  "静岡":"東海","愛知":"東海","岐阜":"東海","三重":"東海",
  "滋賀":"近畿","京都":"近畿","大阪":"近畿","兵庫":"近畿","奈良":"近畿","和歌山":"近畿",
  "岡山":"中国","広島":"中国","鳥取":"中国","島根":"中国","山口":"中国",
  "香川":"四国","徳島":"四国","愛媛":"四国","高知":"四国",
  "福岡":"九州","佐賀":"九州","長崎":"九州","熊本":"九州","大分":"九州","宮崎":"九州","鹿児島":"九州","沖縄":"九州"
};

function ledgerManifestYear(year){
  const y=String(year||"");
  return (ledgerShardManifest?.years||[]).find(x=>String(x.year||"")===y)||null;
}
function ledgerManifestRegionEntry(year,regionLabel){
  const yr=ledgerManifestYear(year);
  if(!yr) return null;
  const key=LEDGER_REGION_KEYS[normalizeRegionName(regionLabel)]||String(regionLabel||"");
  return (yr.regions||[]).find(x=>String(x.key||"")===key)||null;
}
function ledgerRegionLabelsForYear(year){
  const yr=ledgerManifestYear(year);
  const vals=(yr?.regions||[]).map(x=>String(x.label||LEDGER_REGION_LABELS[x.key]||"")).filter(Boolean);
  return vals.length ? vals : ["北海道","東北","関東・東京","北信越","東海","近畿","中国","四国","九州","全国"];
}
function ledgerSelectedEffectiveRegion(){
  const pref=String(document.getElementById("ledgerPref")?.value||"all");
  // A specific prefecture always determines its shard, even if the
  // region selector still holds a conflicting selection.
  if(pref!=="all") return LEDGER_PREF_REGION[pref]||"";
  const region=String(document.getElementById("ledgerRegion")?.value||"all");
  if(region!=="all") return normalizeRegionName(region);
  return "";
}

async function loadLedgerRegionShard(year,regionLabel){
  const y=String(year||"").trim();
  const region=normalizeRegionName(regionLabel);
  const entry=ledgerManifestRegionEntry(y,region);
  if(!y || !region || !entry) return false;
  const sliceKey=`${y}|${entry.key}`;
  if(ledgerLoadedSlices.has(sliceKey)) return true;
  const txt=await fetchTextWithTimeout(`${LEDGER_SHARD_BASE_URL}/${entry.file}`,12000);
  const rows=normalizeRows(applyMatchEditsToRows(csvParse(txt),{includeManual:false}));
  ledgerMergeRows(rows);
  ledgerLoadedSlices.add(sliceKey);
  ledgerPreviewMode=false;
  purgeDeletedRowsFromMemory();
  ensureManualMatchesInLedger();
  purgeDeletedRowsFromMemory();
  markIdentityIndexesDirty();
  buildFastIndexes();
  return true;
}

async function loadLedgerYearShard(year){
  const y=String(year||"").trim();
  if(!y || ledgerLoadedYears.has(y)) return true;
  const yr=ledgerManifestYear(y);
  if(yr?.regions?.length){
    for(const entry of yr.regions){
      await loadLedgerRegionShard(y,entry.label||LEDGER_REGION_LABELS[entry.key]||entry.key);
    }
  }else{
    const txt=await fetchTextWithTimeout(`${LEDGER_SHARD_BASE_URL}/${encodeURIComponent(y)}.csv`,15000);
    const rows=normalizeRows(applyMatchEditsToRows(csvParse(txt),{includeManual:false}));
    ledgerMergeRows(rows);
  }
  ledgerLoadedYears.add(y);
  ledgerPreviewMode=false;
  purgeDeletedRowsFromMemory();
  ensureManualMatchesInLedger();
  purgeDeletedRowsFromMemory();
  markIdentityIndexesDirty();
  buildFastIndexes();
  return true;
}

async function loadLedgerLatestPreview(){
  const manifest=await loadLedgerShardManifest();
  const file=String(manifest?.latest_file||"latest.csv");
  const txt=await fetchTextWithTimeout(`${LEDGER_SHARD_BASE_URL}/${encodeURIComponent(file)}`,10000);
  const rows=normalizeRows(applyMatchEditsToRows(csvParse(txt),{includeManual:false}));
  ledgerMatches=[];
  ledgerMergeRows(rows);
  ledgerPreviewMode=true;
  purgeDeletedRowsFromMemory();
  ensureManualMatchesInLedger();
  purgeDeletedRowsFromMemory();
  markIdentityIndexesDirty();
  buildFastIndexes();
  return true;
}

async function ensureLedgerSelectionData(){
  await loadLedgerShardManifest();
  // Load the authoritative GitHub edits BEFORE constructing any ledger shard.
  // Background enrichment previously allowed stale source rows to appear first.
  await ensureLedgerEditState();
  const year=String(document.getElementById("ledgerYear")?.value||"all");
  const region=ledgerSelectedEffectiveRegion();
  const count=document.getElementById("ledgerCount");

  // Recovery: show the latest ledger immediately; specifying a year is enough
  // to load that entire year. Region filtering remains available for speed.
  if(year==="all"){
    await loadLedgerLatestPreview();
    return true;
  }

  if(region) await loadLedgerRegionShard(year,region);
  else await loadLedgerYearShard(year);
  return true;
}

async function ensureSelectedLedgerYearFullyLoaded(){
  return ensureLedgerSelectionData();
}

async function ensureLedgerYearsForSelection(year){
  const yearEl=document.getElementById("ledgerYear");
  if(yearEl && year!==undefined) yearEl.value=String(year);
  return ensureLedgerSelectionData();
}

async function ensureLedgerData(){
  if(ledgerDataLoaded) return true;
  if(ledgerDataLoadingPromise) return ledgerDataLoadingPromise;

  ledgerDataLoadingPromise=(async()=>{
    await ensureLedgerEditState();
    const manifest=await loadLedgerShardManifest();
    if(!(manifest?.years||[]).length) throw new Error("ledger shard manifest has no years");

    // Restore the last 1,200 ledger rows as the default view.
    // The preview contains the 2026 autumn fixtures without fetching the full archive.
    await loadLedgerLatestPreview();
    ledgerDataLoaded=true;
    setupLedgerUi();
    renderLedger();
    return true;
  })().finally(()=>{ledgerDataLoadingPromise=null;});

  return ledgerDataLoadingPromise;
}


async function refreshRatingDataFromGitHub(){
  // V56: current_ratings is enough to refresh ranking/master numeric values.
  // Large event ledgers are re-fetched only after a user has actually opened a
  // detail-heavy screen in this session.
  const currentRes=await fetchGithubTextFile("output/current_ratings.csv");
  serverRatings=csvParse(currentRes.text);
  if(ratingAuxLoaded){
    const [eventsRes,schoolRes]=await Promise.all([
      fetchGithubTextFile("output/rating_events.csv"),
      fetchGithubTextFile("output/rating_school_events.csv")
    ]);
    ratingEvents=csvParse(eventsRes.text);
    ratingSchoolEvents=csvParse(schoolRes.text);
  }
  buildFastIndexes();
  render();
  const active=document.querySelector(".view-tab.active")?.dataset?.view||"ranking";
  if(active==="master") renderMasterTable();
  if(active==="ledger" && ledgerDataLoaded) renderLedger();
  return true;
}

function isRatingPendingForRow(r){
  return pendingRatingMatchKeys.has(eventMatchKey(r));
}

function setLedgerReflectionStatus(state,title,detail=""){
  const el=document.getElementById("ledgerReflectionStatus");
  if(!el) return;
  el.className=`ledger-reflection-status ${state||"idle"}`;
  const strong=el.querySelector("strong"), span=el.querySelector("span");
  if(strong) strong.textContent=title||"台帳反映状況";
  if(span) span.textContent=detail||"";
}

let pendingLedgerRedrawTimer=null;
function schedulePendingLedgerRedraw(){
  clearTimeout(pendingLedgerRedrawTimer);
  pendingLedgerRedrawTimer=setTimeout(()=>{
    pendingLedgerRedrawTimer=null;
    if(!document.getElementById("ledgerView")?.classList.contains("hidden"))renderLedger();
  },180);
}
function markRatingPendingRows(rows){
  let changed=false;
  for(const r of rows||[]){
    if(!r)continue;
    const k=eventMatchKey(r);
    if(!k)continue;
    pendingRatingMatchKeys.add(k);changed=true;
  }
  if(!changed)return;
  savePendingRatingKeys();
  schedulePendingLedgerRedraw();
  scheduleRatingRefresh();
}
function markRatingPendingForRow(r){markRatingPendingRows([r]);}

function clearResolvedRatingPending(){
  let changed=false;
  for(const k of [...pendingRatingMatchKeys]){
    if(ratingEventMap.has(k)){
      pendingRatingMatchKeys.delete(k);
      changed=true;
    }
  }
  if(changed) savePendingRatingKeys();
  return changed;
}

function scheduleRatingRefresh(){
  if(ratingRefreshRunning) return;
  clearTimeout(ratingRefreshTimer);
  ratingRefreshTimer=setTimeout(()=>pollRatingRefresh(),2500);
}

async function pollRatingRefresh(){
  if(ratingRefreshRunning || !pendingRatingMatchKeys.size) return;
  ratingRefreshRunning=true;
  const started=Date.now();
  let attempt=0;
  try{
    await dispatchRatingRebuildBestEffort();
    while(pendingRatingMatchKeys.size && Date.now()-started<180000){
      attempt++;
      try{
        await refreshRatingDataFromGitHub();
        clearResolvedRatingPending();
        renderLedger();
        renderMasterTable();
        render();
        if(!pendingRatingMatchKeys.size){
          showSaveToast("Rating再計算が反映されました");
          setLedgerReflectionStatus("done","Rating反映完了","GitHub台帳とRatingの両方へ反映済みです。");
          break;
        }
      }catch(err){
        console.warn("rating refresh poll failed",err);
      }
      await new Promise(r=>setTimeout(r,Math.min(10000,3000+attempt*500)));
    }
  }finally{
    ratingRefreshRunning=false;
    if(pendingRatingMatchKeys.size){
      savePendingRatingKeys();
      renderLedger();
      setLedgerReflectionStatus("waiting","Rating反映待ち",`${pendingRatingMatchKeys.size}試合はGitHub台帳へ保存済み。Rating再計算の完了を引き続き待っています。`);
    }
  }
}

function emptyMatchEditsState(){
  return {version:2,updated_at:"",manual_matches:[],overrides:[],team_links:[],deleted_matches:[],authority_ops:[],generation_reset_overrides:[]};
}

async function fetchGithubJsonFile(path){
  const cfg=loadGitHubSyncConfig();
  try{
    const data=await githubApi(`/contents/${path}?ref=${encodeURIComponent(cfg.branch||"main")}`);
    if(data?.content){
      const binary=atob(String(data.content).replace(/\s+/g,""));
      const bytes=Uint8Array.from(binary,c=>c.charCodeAt(0));
      const text=new TextDecoder("utf-8").decode(bytes);
      return {sha:data.sha||"",state:JSON.parse(text),source:"contents"};
    }
    // Large files can return metadata without inline content.
    // Read the exact blob instead of falling back to stale GitHub Pages data.
    if(data?.sha){
      const blob=await fetchGithubJsonBlob(data.sha);
      return {...blob,sha:data.sha||blob.sha||"",source:"blob"};
    }
    return {sha:data?.sha||"",state:null,source:"contents-empty"};
  }catch(err){
    if(String(err?.message||err).includes("GitHub 404")) return {sha:"",state:null,source:"404"};
    throw err;
  }
}
async function fetchGithubJsonFileAtRef(path,ref){
  const cfg=loadGitHubSyncConfig();
  const useRef=ref||cfg.branch||"main";
  try{
    const data=await githubApi(`/contents/${path}?ref=${encodeURIComponent(useRef)}`);
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

async function fetchGithubJsonBlob(blobSha){
  if(!blobSha) return {sha:"",state:null};
  const data=await githubApi(`/git/blobs/${encodeURIComponent(blobSha)}`);
  if(!data?.content) return {sha:data?.sha||blobSha,state:null};
  const binary=atob(String(data.content).replace(/\s+/g,""));
  const bytes=Uint8Array.from(binary,c=>c.charCodeAt(0));
  const text=new TextDecoder("utf-8").decode(bytes);
  return {sha:data.sha||blobSha,state:JSON.parse(text)};
}

async function loadMatchEditsShared(){
  const cfg=loadGitHubSyncConfig();
  const localMirror=loadMatchEditsLocalMirror();

  // V65.4: this JSON is several MB. Read public raw main first to avoid
  // contents-API base64 overhead. Writes still use authenticated API.
  if(cfg.owner && cfg.repo){
    try{
      const branch=cfg.branch||"main";
      const safePath=MATCH_EDITS_PATH.split("/").map(encodeURIComponent).join("/");
      const rawUrl=`https://raw.githubusercontent.com/${encodeURIComponent(cfg.owner)}/${encodeURIComponent(cfg.repo)}/${encodeURIComponent(branch)}/${safePath}?t=${Date.now()}`;
      const res=await fetch(rawUrl,{cache:"no-store"});
      if(res.ok){
        const remote=await res.json();
        matchEditsState=mergeMatchEditStates(remote,localMirror);
        mergeManualBackupIntoState();
        lastMatchEditsLoadSource="GitHub raw main";
        persistMatchEditsLocalMirror();
        return matchEditsState;
      }
    }catch(err){
      console.warn("fast raw match edits read failed; trying API",err);
    }
  }

  // 1) Authenticated GitHub is authoritative when available.
  if(cfg.owner && cfg.repo && githubSessionToken){
    try{
      const x=await fetchGithubJsonFile(MATCH_EDITS_PATH);
      if(x.state){
        matchEditsState=mergeMatchEditStates(x.state,localMirror);
        mergeManualBackupIntoState();
        matchEditsSha=x.sha||"";
        lastMatchEditsLoadSource="GitHub API main";
        persistMatchEditsLocalMirror();
        return matchEditsState;
      }
      throw new Error("GitHubのmatch_edits_shared.json本文を取得できませんでした");
    }catch(err){
      console.error("match edits GitHub load failed",err);
      fastSaveStatus("対戦台帳：GitHub読込失敗（端末ミラーで復元）","error");
      if(localMirror){
        matchEditsState={...emptyMatchEditsState(),...localMirror};
        mergeManualBackupIntoState();
        lastMatchEditsLoadSource="端末ミラー";
        return matchEditsState;
      }
      const pendingRaw=localStorage.getItem(MATCH_EDITS_PENDING_KEY);
      if(pendingRaw){
        try{
          const parsed=JSON.parse(pendingRaw);
          matchEditsState={...emptyMatchEditsState(),...(parsed?.state||parsed)};
          mergeManualBackupIntoState();
          lastMatchEditsLoadSource="端末未保存バックアップ";
          return matchEditsState;
        }catch(e){}
      }
      matchEditsState=emptyMatchEditsState();
      mergeManualBackupIntoState();
      lastMatchEditsLoadSource="端末手入力バックアップ";
      return matchEditsState;
    }
  }

  // 2) Even without a remembered token, this is a public Pages repository in
  // normal operation. Read the current main/master file directly so a reload
  // does not depend on the slower docs/data publication pipeline.
  if(cfg.owner && cfg.repo){
    try{
      const branch=cfg.branch||"main";
      const safePath=MATCH_EDITS_PATH.split("/").map(encodeURIComponent).join("/");
      const rawUrl=`https://raw.githubusercontent.com/${encodeURIComponent(cfg.owner)}/${encodeURIComponent(cfg.repo)}/${encodeURIComponent(branch)}/${safePath}?t=${Date.now()}`;
      const res=await fetch(rawUrl,{cache:"no-store"});
      if(res.ok){
        const remote=await res.json();
        matchEditsState=mergeMatchEditStates(remote,localMirror);
        mergeManualBackupIntoState();
        lastMatchEditsLoadSource="GitHub raw main";
        persistMatchEditsLocalMirror();
        return matchEditsState;
      }
    }catch(err){
      console.warn("match edits raw GitHub load failed",err);
    }
  }

  // 3) GitHub Pages copy is the final read-only fallback. Always merge the
  // durable local mirror because Pages can be one workflow behind master.
  try{
    const res=await fetch(`data/match_edits_shared.json?t=${Date.now()}`,{cache:"no-store"});
    if(res.ok){
      const remote=await res.json();
      matchEditsState=mergeMatchEditStates(remote,localMirror);
      mergeManualBackupIntoState();
      lastMatchEditsLoadSource="GitHub Pages copy";
      persistMatchEditsLocalMirror();
      return matchEditsState;
    }
  }catch(err){
    console.warn("match edits Pages load failed",err);
  }

  matchEditsState=localMirror?{...emptyMatchEditsState(),...localMirror}:emptyMatchEditsState();
  mergeManualBackupIntoState();
  lastMatchEditsLoadSource=localMirror?"端末ミラー":"端末手入力バックアップ";
  persistManualMatchesBackup();
  return matchEditsState;
}
function matchEditRecordTime(x){
  for(const k of ["updated_at","deleted_at","created_at"]){
    const t=Date.parse(String(x?.[k]||""));
    if(Number.isFinite(t)) return t;
  }
  return 0;
}
function mergeMatchEditRecord(remoteItem,localItem){
  if(!remoteItem) return localItem?{...localItem}:null;
  if(!localItem) return {...remoteItem};
  const rt=matchEditRecordTime(remoteItem),lt=matchEditRecordTime(localItem);
  if(lt>rt) return {...remoteItem,...localItem};
  if(rt>lt) return {...localItem,...remoteItem};
  // Same timestamp or old records without timestamps:
  // GitHub remote is authoritative, preventing stale local snapshots from reviving old data.
  return {...localItem,...remoteItem};
}
function mergeMatchEditStates(remote,local){
  const out={...emptyMatchEditsState(),...(local||{}),...(remote||{})};
  const mergeByLatest=(remoteList,localList,keyFn)=>{
    const rm=new Map(),lm=new Map(),keys=new Set();
    for(const x of remoteList||[]){const k=keyFn(x);if(k){rm.set(k,x);keys.add(k);}}
    for(const x of localList||[]){const k=keyFn(x);if(k){lm.set(k,x);keys.add(k);}}
    return [...keys].map(k=>mergeMatchEditRecord(rm.get(k),lm.get(k))).filter(Boolean);
  };
  out.manual_matches=mergeByLatest(remote?.manual_matches,local?.manual_matches,x=>x.manual_id);
  out.overrides=mergeByLatest(remote?.overrides,local?.overrides,x=>x.edit_key);
  out.team_links=mergeByLatest(remote?.team_links,local?.team_links,x=>`${x.edit_key}|${x.side}`);
  out.deleted_matches=mergeByLatest(remote?.deleted_matches,local?.deleted_matches,x=>x.edit_key);
  out.authority_ops=mergeByLatest(remote?.authority_ops,local?.authority_ops,x=>x.match_id);
  out.generation_reset_overrides=mergeByLatest(remote?.generation_reset_overrides,local?.generation_reset_overrides,x=>`${x.school_id||x.school}|${x.year}`);
  out.updated_at=new Date().toISOString();
  return compactMatchEditsState(out);
}
async function pushMatchEditsShared(message="Update match ledger edits"){
  const cfg=loadGitHubSyncConfig();
  if(!cfg.owner||!cfg.repo||!githubSessionToken) throw new Error("GitHub同期設定が必要です");

  let lastErr=null;
  for(let attempt=1;attempt<=5;attempt++){
    try{
      // Always start from the current GitHub file. Never write a full stale snapshot.
      const remote=await fetchGithubJsonFile(MATCH_EDITS_PATH);
      const sha=remote.sha||"";
      const localSnapshot={...matchEditsState,updated_at:new Date().toISOString()};
      const merged=compactMatchEditsState(mergeMatchEditStates(remote.state,localSnapshot));
      matchEditsState=merged;
      persistMatchEditsLocalMirror();

      const body={
        message,
        branch:cfg.branch||"main",
        content:utf8ToBase64(JSON.stringify(merged,null,2)+"\n")
      };
      if(sha) body.sha=sha;

      const data=await githubApi(`/contents/${MATCH_EDITS_PATH}`,{
        method:"PUT",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify(body)
      });

      matchEditsSha=data?.content?.sha||"";
      // Preserve edits made while the request was in flight, but only when actually newer.
      matchEditsState=mergeMatchEditStates(merged,matchEditsState);
      return data;
    }catch(err){
      lastErr=err;
      if(!/GitHub (409|422)/.test(String(err?.message||err)) || attempt===5) break;
      await new Promise(r=>setTimeout(r,[180,350,650,1100,1700][attempt-1]));
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
  const item={
    edit_key:editKey,
    changes:{...(i>=0?list[i].changes:{}),...changes},
    updated_at:new Date().toISOString()
  };
  if(i>=0) list[i]=item; else list.push(item);
}
function teamLinkVerification(editKey,side,rec){return {edit_key:String(editKey||""),side:String(side||""),school_id:String(rec?.school_id||""),canonical_name:String(rec?.canonical_name||"")};}
function upsertMatchTeamLink(editKey,side,school){
  if(!school) return;
  const list=matchEditsState.team_links||(matchEditsState.team_links=[]);
  const i=list.findIndex(x=>x.edit_key===editKey&&x.side===side);
  const item={
    edit_key:editKey,side,
    school_id:school.school_id||"",
    canonical_name:school.canonical_name||"",
    updated_at:new Date().toISOString()
  };
  if(i>=0) list[i]=item; else list.push(item);
  matchTeamLinkMap.set(`${editKey}|${side}`,item);
  markIdentityIndexesDirty();
}

function updateManualMatchById(manualId,changes){const list=matchEditsState.manual_matches||(matchEditsState.manual_matches=[]);const i=list.findIndex(x=>String(x.manual_id||"")===String(manualId||""));if(i<0)return false;const id=list[i].manual_id;list[i]={...list[i],...changes,manual_id:id,edit_key:id,match_id:id,updated_at:new Date().toISOString()};return true;}
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
  // Modern DELETE records have match_id + authority_ops and must not use the
  // old edit_key-wide tombstone path, which can erase multiple physical rows.
  const deleted=new Set((matchEditsState.deleted_matches||[])
    .filter(x=>!String(x.match_id||"").trim())
    .map(x=>String(x.edit_key||"")));
  let out=(rows||[]).filter(r=>!deleted.has(matchEditKey(r))).map(applySharedEditsToRow);
  if(includeManual){
    const have=new Set(out.map(r=>r.manual_id).filter(Boolean));
    for(const m of matchEditsState.manual_matches||[]){
      if(m.manual_id && !have.has(m.manual_id) && !deleted.has(String(m.manual_id))) out.push(applySharedEditsToRow({...m,edit_key:m.manual_id,match_id:m.match_id||m.manual_id}));
    }
  }

  // V64.8 authoritative replay. The newest user operation wins over generated CSV.
  // This is intentionally applied last.
  const byId=new Map();
  for(const raw of out){
    const id=matchAuthorityId(raw);
    byId.set(id,{...raw,match_id:id});
  }
  const ops=[...(matchEditsState.authority_ops||[])].sort((a,b)=>matchEditRecordTime(a)-matchEditRecordTime(b));
  for(const op of ops){
    const id=String(op?.match_id||"").trim();
    if(!id) continue;
    const action=String(op.action||"UPDATE").toUpperCase();
    if(action==="DELETE"){
      byId.delete(id);
      continue;
    }
    const current=byId.get(id);
    if(action==="ADD"){
      const base=op.snapshot||op.changes||{};
      byId.set(id,{...(current||{}),...base,match_id:id});
      continue;
    }
    if(action==="UPDATE"){
      if(current) byId.set(id,{...current,...(op.changes||{}),match_id:id});
      else if(op.snapshot) byId.set(id,{...op.snapshot,match_id:id});
    }
  }
  // Apply the confirmed per-match school links LAST. Authority snapshots and
  // generated CSV may carry stale school IDs and otherwise mask the saved link.
  const savedLinks=new Map();
  for(const link of matchEditsState.team_links||[]){
    const k=String(link.edit_key||"");
    if(k && (link.side==="team1"||link.side==="team2"))savedLinks.set(k+"|"+link.side,link);
  }
  for(const row of byId.values()){
    const k=matchEditKey(row);
    for(const side of ["team1","team2"]){
      const link=savedLinks.get(k+"|"+side);
      if(!link)continue;
      row[side+"_school_id"]=String(link.school_id||"");
      row[side+"_canonical"]=String(link.canonical_name||"");
    }
  }
  // Align the live ledger with master/level_overrides.csv even while a
  // full rating build has not yet published a new snapshot.
  // Only prefecture-tier rows with explicit qualifying-round labels qualify.
  for(const row of byId.values()){
    const current=String(row.level||noteValue(row.note,"level")||"").trim();
    if(current!=="prefecture")continue;
    const round=String(row.round||"").normalize("NFKC").replace(/[\s　]/g,"");
    if(!/(?:地区予選|敗者復活|一次予選|1次予選|支部予選)/.test(round))continue;
    row.level="district_qualifier";
    row.note=setNoteLevel(row.note||"","district_qualifier");
  }
  return [...byId.values()];
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

  // 保存済み学校マスタも、先頭の「■」「●」などWeb装飾だけは自動修復する。
  // clean canonical が既にある場合は別学校を作らず、その学校のaliasへ吸収する。
  const savedItems=[...saved.values()].sort((a,b)=>{
    const ac=cleanSchoolNoiseName(a.canonical_name),bc=cleanSchoolNoiseName(b.canonical_name);
    return Number(ac!==a.canonical_name)-Number(bc!==b.canonical_name);
  });
  for(const item of savedItems){
    const original=String(item.canonical_name||"").trim();
    const canonical=cleanSchoolNoiseName(original)||original;
    const aliases=uniq([canonical, original, ...(item.aliases||[]).map(cleanSchoolNoiseName), ...(item.aliases||[])]);
    const existing=schoolMaster.get(canonical);
    if(existing){
      existing.aliases=uniq([...(existing.aliases||[]),...aliases]);
      continue;
    }
    schoolMaster.set(canonical, {
      furigana:"",
      local_district:"",
      representative_area:item.prefecture||"",
      aliases:[canonical],
      ...item,
      canonical_name:canonical,
      aliases
    });
  }

  // 保存済み canonical / alias の全名称を索引化。
  const claimedNames = new Set();
  for(const item of schoolMaster.values()){
    claimedNames.add(item.canonical_name);
    for(const alias of (item.aliases||[])) claimedNames.add(alias);
  }
  for(const item of (deletedSchoolTombstones||sharedMasterState?.deleted_schools||[])){
    if(item.canonical_name) claimedNames.add(item.canonical_name);
    for(const alias of (item.aliases||[])) claimedNames.add(alias);
  }

  // 未登録の raw school nameだけ新規学校として追加する。削除済みtombstoneは再生成しない。
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
  const name=cleanSchoolNoiseName(raw);
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
  const raw = String(name||"").trim();
  // Exact display-name record wins. This prevents a branched ID from being
  // redirected through another school's alias.
  if(raw && schoolMaster.has(raw)) return schoolMaster.get(raw);
  const canonical = resolveCanonicalName(raw);
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


function rankingUnionLabels(){
  return new Set((unionTeams||[]).map(u=>String(u.display_name||"").trim()).filter(Boolean));
}
function rankingRealSchoolRecords(){
  const unionLabels=rankingUnionLabels();
  return [...schoolMaster.values()].filter(s=>
    s &&
    s.kind!=="union" &&
    (s.status||"active")!=="merged" &&
    !unionLabels.has(String(s.canonical_name||"").trim())
  );
}
function ensureRankingLookupCaches(){
  if(rankingMasterByIdCache && rankingNameIndexCache) return;
  rankingMasterByIdCache=new Map();
  rankingNameIndexCache=new Map();
  for(const s of rankingRealSchoolRecords()){
    const id=String(s.school_id||"").trim();
    if(id) rankingMasterByIdCache.set(id,s);
    for(const nm of [String(s.canonical_name||"").trim(),...(s.aliases||[]).map(a=>String(a||"").trim())]){
      if(!nm) continue;
      if(!rankingNameIndexCache.has(nm)) rankingNameIndexCache.set(nm,[]);
      rankingNameIndexCache.get(nm).push(s);
    }
  }
}
function rankingMasterById(){
  ensureRankingLookupCaches();
  return rankingMasterByIdCache;
}
function rankingNameCandidates(name){
  const q=String(name||"").trim();
  if(!q)return [];
  ensureRankingLookupCaches();
  return rankingNameIndexCache.get(q)||[];
}
function ratingRowMasterRecord(r){
  const byId=rankingMasterById();
  const sid=String(r?.school_id||"").trim();
  if(sid && byId.has(sid)) return byId.get(sid);

  const candidates=rankingNameCandidates(r?.school);
  if(candidates.length===1)return candidates[0];

  const pref=normalizePrefectureName(r?.prefecture||"");
  const region=normalizeRegionName(r?.region||"");
  const geo=candidates.filter(s=>{
    const sp=normalizePrefectureName(s.prefecture||"");
    const sr=normalizeRegionName(s.district||"");
    return (pref&&sp===pref) || (region&&sr===region);
  });
  return geo.length===1?geo[0]:null;
}
function matchSideMasterId(row,side){
  const rec=masterRecordForMatchSide(row,side);
  if(!rec || rec.kind==="union" || (rec.status||"active")==="merged")return "";
  if(rankingUnionLabels().has(String(rec.canonical_name||"").trim()))return "";
  return String(rec.school_id||"").trim();
}
function allowedRankingSchoolIds(matches){
  const ids=new Set();
  for(const m of matches){
    const a=matchSideMasterId(m,"team1"),b=matchSideMasterId(m,"team2");
    if(a)ids.add(a);if(b)ids.add(b);
  }
  return ids;
}
function masterRecordForRatingRow(r){return ratingRowMasterRecord(r);}


const PREF_ACCENT = {"北海道":"#5BC0EB","青森":"#58D68D","岩手":"#5DADE2","宮城":"#00E6B8","秋田":"#FFD166","山形":"#C77DFF","福島":"#FF6B6B","茨城":"#4DFFD2","栃木":"#FFE66D","群馬":"#67E480","埼玉":"#FF6B81","千葉":"#FF9F43","東京":"#00E5FF","神奈川":"#54A0FF","山梨":"#C56CF0","新潟":"#2ED573","長野":"#70A1FF","富山":"#1E90FF","石川":"#00F5D4","福井":"#FF7F50","岐阜":"#B8E986","静岡":"#12CBC4","愛知":"#FDA7DF","三重":"#FF5E78","滋賀":"#20C5E6","京都":"#D75AA8","大阪":"#FF7A2F","兵庫":"#3D7BFF","奈良":"#B49CFF","和歌山":"#E59CFF","鳥取":"#FFD43B","島根":"#FFB02E","岡山":"#FF4D4D","広島":"#FF6666","山口":"#18D6A3","徳島":"#00E3E3","香川":"#FF6FE5","愛媛":"#FF8FE7","高知":"#5AA8FF","福岡":"#4EA4FF","佐賀":"#20D9AE","長崎":"#8B5CFF","熊本":"#FF6B6B","大分":"#FFD166","宮崎":"#38E0B6","鹿児島":"#FFA94D","沖縄":"#00E5D8"};
function accentForSchool(name){const rec=schoolMaster.get(String(name||"").trim())||schoolRecord(name);const pref=identityPrefUnit(rec?.prefecture||"");return PREF_ACCENT[pref]||"#00E5FF";}
function rankingSnapshotDateValue(){return (document.getElementById("rankingSnapshotMode")?.value||"latest")==="date"?(document.getElementById("rankingSnapshotDate")?.value||""):"";}
function snapshotServerRatingRows(dateStr){
  if(!dateStr||!ratingSchoolEvents.length)return [];
  const state=new Map();
  const ordered=[...ratingSchoolEvents].filter(e=>eventBeforeOrOn(e,dateStr)).sort(eventChronoCompare);
  for(const e of ordered){
    if(String(e.event_type||"match")==="generation_reset"){
      const key=eventSchoolIdentityKey(e), after=Number(e.rating_after);
      if(!key||!Number.isFinite(after)) continue;
      const st=state.get(key)||{games:0,wins:0,losses:0,draws:0,runs_for:0,runs_against:0};
      st.rating=after;st.event=e;state.set(key,st);continue;
    }
    const key=eventSchoolIdentityKey(e), after=Number(e.rating_after);
    if(!key||!Number.isFinite(after))continue;
    const st=state.get(key)||{games:0,wins:0,losses:0,draws:0,runs_for:0,runs_against:0};
    st.rating=after; st.event=e;
    st.games+=1;
    const sf=Number(e.score_for),sa=Number(e.score_against);
    if(Number.isFinite(sf))st.runs_for+=sf;
    if(Number.isFinite(sa))st.runs_against+=sa;
    if(Number.isFinite(sf)&&Number.isFinite(sa)){if(sf>sa)st.wins++;else if(sf<sa)st.losses++;else st.draws++;}
    state.set(key,st);
  }
  const rows=[];
  for(const [key,st] of state){
    const e=st.event||{}, sid=String(e.school_id||"").trim();
    let rec=sid?rankingMasterById().get(sid):null;
    if(!rec){const nm=String(e.school||e.raw_team||"").trim();rec=schoolMaster.get(nm)||schoolRecord(nm);}
    rows.push({school_id:rec?.school_id||sid,school:rec?.canonical_name||e.school||e.raw_team||key,rating:Number(st.rating),games:st.games,wins:st.wins,losses:st.losses,draws:st.draws,runs_for:st.runs_for,runs_against:st.runs_against,prefecture:rec?.prefecture||"",region:rec?.district||"",history_prior:0,last_date:e.date||""});
  }
  return rows;
}
function render(){
  const snapLabel=document.getElementById("rankingSnapshotLabel");if(snapLabel){const d=rankingSnapshotDateValue();snapLabel.textContent=d?`${d} 時点`:"最新Rating";}

  const hasMatchFilter =
    selected("yearFilter")!=="all" ||
    selected("seasonFilter")!=="all" ||
    selected("levelFilter")!=="all";
  const hasGeoFilter =
    selected("regionFilter")!=="all" ||
    selected("prefFilter")!=="all";
  const hasScopeFilter = hasMatchFilter || hasGeoFilter;
  // Geography can be filtered directly from current_ratings/master data.
  // Only year/season/level needs the full match ledger.
  const matches = hasMatchFilter ? filteredMatches() : [];
  const schoolMeta = detectedSchoolGeo?.size ? detectedSchoolGeo : new Map();

  const snapshotDate=rankingSnapshotDateValue();
  const rankingSourceRatings=snapshotDate?snapshotServerRatingRows(snapshotDate):serverRatings;
  if(rankingSourceRatings.length){
    // Latest uses current_ratings.csv; date mode reconstructs state from school events.
    // PC / smartphone / browser all display the same Rating.
    // Filters only narrow schools; they never recalculate Elo here.
    const allowedIds=hasMatchFilter ? allowedRankingSchoolIds(matches) : null;
    const wantedRegion=selected("regionFilter");
    const wantedPref=selected("prefFilter");

    currentStats = new Map();
    for(const r of rankingSourceRatings){
      const masterRec=masterRecordForRatingRow(r);if(!masterRec)continue;
      const sid=String(masterRec.school_id||"").trim();if(!sid)continue;
      if(allowedIds && !allowedIds.has(sid))continue;
      const rowRegion=normalizeRegionName(masterRec.district||r.region||"");
      const rowPref=normalizePrefectureName(masterRec.prefecture||r.prefecture||"");
      if(wantedRegion!=="all" && rowRegion!==normalizeRegionName(wantedRegion)) continue;
      if(wantedPref!=="all" && rowPref!==normalizePrefectureName(wantedPref)) continue;
      const display=masterRec.canonical_name;
      currentStats.set(sid,{
        school_id:sid,
        team:display,
        globalRank:Number(r.rank)||null,
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
        historyPrior:Number(r.history_prior||0),
        peakRating:r.history_best_rank||"",
        peakDate:r.history_best_rank_date||"",
        averageRank24m:r.avg_rank_24m||"",
        averageRankMonths:r.avg_rank_24m_months||""
      });
    }
    document.getElementById("ratingMode").textContent = snapshotDate ? `${snapshotDate} 時点Rating` : "GitHub確定Rating";
  }else{
    // Emergency fallback only when the generated server file is missing.
    const fallbackRaw=calcRatings(matches);
    currentStats=new Map();
    for(const [name,s] of fallbackRaw){
      const candidates=rankingNameCandidates(name);
      if(candidates.length!==1)continue;
      const rec=candidates[0],sid=String(rec.school_id||"").trim();
      if(!sid)continue;
      currentStats.set(sid,{...s,school_id:sid,team:rec.canonical_name});
    }
    document.getElementById("ratingMode").textContent = "暫定（サーバーRating未生成）";
  }

  const q = document.getElementById("schoolSearch").value.trim().toLowerCase();

  const rankingSort=document.getElementById("rankingSortBy")?.value||"rating_desc";
  const finiteMetric=(s,key)=>{const v=s[key];return v==null||v===""?null:(Number.isFinite(Number(v))?Number(v):null);};
  const compareMetric=(a,b,key,ascending=false)=>{
    const av=finiteMetric(a,key),bv=finiteMetric(b,key);
    if(av===null)return bv===null?0:1;
    if(bv===null)return -1;
    return ascending?av-bv:bv-av;
  };
  let list = [...currentStats.values()]
    .filter(s=>!q || s.team.toLowerCase().includes(q))
    .sort((a,b)=>{
      let c=0;
      switch(rankingSort){
        case "rating_asc":c=a.rating-b.rating;break;
        case "best_rank_asc":c=compareMetric(a,b,"peakRating",true);break;
        case "best_rank_desc":c=compareMetric(a,b,"peakRating");break;
        case "avg_rank_asc":c=compareMetric(a,b,"averageRank24m",true);break;
        case "avg_rank_desc":c=compareMetric(a,b,"averageRank24m");break;
        case "games_desc":c=b.games-a.games;break;
        case "wins_desc":c=b.wins-a.wins;break;
        case "win_pct_desc":c=(b.games?b.wins/b.games:-1)-(a.games?a.wins/a.games:-1);break;
        case "run_diff_desc":c=(b.pf-b.pa)-(a.pf-a.pa);break;
        case "name_asc":c=a.team.localeCompare(b.team,"ja");break;
        default:c=b.rating-a.rating;
      }
      return c||b.rating-a.rating||a.team.localeCompare(b.team,"ja");
    });

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

  document.getElementById("matchCount").textContent = hasMatchFilter
    ? matches.length.toLocaleString()
    : Number(ratingAuditSummary?.rated_matches||ratingAuditSummary?.input_rows||0).toLocaleString();
  document.getElementById("schoolCount").textContent = currentStats.size.toLocaleString();
  document.getElementById("latestDate").textContent = hasMatchFilter
    ? (matches.reduce((m,x)=>normalizeDateKey(x.date||"")>m?normalizeDateKey(x.date||""):m,"") || "-")
    : (latestMatchDateCache || ratingAuditSummary?.last_date || "-");

  const tbody = document.querySelector("#rankingTable tbody");
  tbody.innerHTML = rankingRows.map((s,i)=>{
    const pct = s.games ? (s.wins/s.games*100).toFixed(1)+"%" : "-";
    const diff=s.pf-s.pa;
    const rec = rankingMasterById().get(String(s.school_id||"")) || null;
    const district = rec?.district || s.serverRegion || districtForSchool(s.team, schoolMeta);
    const pref = rec?.prefecture || s.serverPref || prefForSchool(s.team, schoolMeta);
    const sid = rec?.school_id || s.school_id || provisionalSchoolId(s.team,district,pref,"00");
    const color = DISTRICT_COLORS[district] || DISTRICT_COLORS["不明"];
    const rowColor = schoolRowColor(rec || {canonical_name:s.team,district,prefecture:pref});
    return `<tr class="ranking-school-row" style="--school-row-bg:${rowColor.bg};--school-row-accent:${rowColor.accent}">
      <td class="rank">${!snapshotDate && s.globalRank ? s.globalRank : rankingStart+i+1}</td>
      <td><span class="id-badge">${esc(sid)}</span></td>
      <td><button class="school-link" data-team="${esc(s.team)}">${esc(s.team)}</button></td>
      <td><span class="region-chip"><span class="region-dot" style="background:${color}"></span>${esc(district)}</span></td>
      <td class="pref-label">${esc(pref)}</td>
      <td class="rating">${Math.round(s.rating)}</td>
      <td class="rating-peak">${!snapshotDate && s.peakRating!=="" ? Math.round(Number(s.peakRating)) : "-"} <small>${!snapshotDate?esc(s.peakDate||""):""}</small></td>
      <td class="rank-24m">${!snapshotDate && s.averageRank24m!=="" ? Number(s.averageRank24m).toFixed(1)+"位" : "-"}</td>
      <td>${s.games}</td>
      <td>${s.wins}</td>
      <td>${s.losses}</td>
      <td>${pct}</td>
      <td class="${diff>0?"pos":diff<0?"neg":""}">${diff>0?"+":""}${diff}</td>
    </tr>`;
  }).join("");

  tbody.querySelectorAll(".school-link").forEach(btn=>{
    btn.addEventListener("click",()=>showRankingTrend(btn.dataset.team));
  });

}

function rankPointDetailHtml(x){
  const rankDelta=Number(x?.rank_delta);
  const ratingDelta=Number(x?.rating_delta);
  const result=(x?.score_for!=="" && x?.score_against!=="") ? `${esc(x.score_for)}-${esc(x.score_against)}` : "-";
  const rankMove=Number.isFinite(rankDelta) ? `${x.previous_rank}位 → ${x.rank}位（${rankDelta>0?"+":""}${rankDelta}）` : `${x.rank}位`;
  const ratingMove=Number.isFinite(ratingDelta) ? `${Number(x.rating_before).toFixed(1)} → ${Number(x.rating).toFixed(1)}（${ratingDelta>=0?"+":""}${ratingDelta.toFixed(2)}）` : `Rating ${Number(x.rating).toFixed(1)}`;
  return `<div class="history-point-card"><div class="history-point-date">${esc(x?.date||"-")}</div><div class="history-point-main"><strong>${esc(x?.tournament||"")}</strong> ${esc(x?.round||"")}</div><div class="history-point-grid"><span>相手</span><b>${esc(x?.opponent||"-")}</b><span>結果</span><b>${result}</b><span>全国順位</span><b>${rankMove}</b><span>Rating</span><b>${ratingMove}</b></div></div>`;
}
function ratingPointDetailHtml(e,rankRows){
  const key=`${e?.date||""}|${e?.tournament||""}|${e?.round||""}`;
  const r=[...rankRows].reverse().find(x=>`${x.date||""}|${x.tournament||""}|${x.round||""}`===key) || [...rankRows].reverse().find(x=>x.date===e?.date);
  const result=(e?.score_for!=="" && e?.score_against!=="") ? `${esc(e.score_for)}-${esc(e.score_against)}` : "-";
  const before=Number(e?.rating_before),after=Number(e?.rating_after),delta=Number(e?.rating_delta);
  return `<div class="history-point-card"><div class="history-point-date">${esc(e?.date||"-")}</div><div class="history-point-main"><strong>${esc(e?.tournament||"")}</strong> ${esc(e?.round||"")}</div><div class="history-point-grid"><span>相手</span><b>${esc(e?.opponent||"-")}</b><span>結果</span><b>${result}</b><span>全国順位</span><b>${r?`${r.rank}位`:"-"}</b><span>Rating</span><b>${Number.isFinite(before)&&Number.isFinite(after)?`${before.toFixed(1)} → ${after.toFixed(1)}（${delta>=0?"+":""}${Number.isFinite(delta)?delta.toFixed(2):"-"}）`:"-"}</b></div></div>`;
}
function wireHistoryChartPoints(container,rankRows,events){
  if(!container) return;
  const rankBox=container.querySelector("[data-history-detail='rank']");
  const ratingBox=container.querySelector("[data-history-detail='rating']");
  const eventPts=(events||[]).filter(e=>Number.isFinite(Number(e.rating_after)));
  const activate=(el)=>{
    container.querySelectorAll(".history-chart-point.is-selected").forEach(x=>x.classList.remove("is-selected"));
    el.classList.add("is-selected");
    const kind=el.dataset.historyKind, i=Number(el.dataset.historyIndex);
    if(kind==="rank" && rankBox && rankRows[i]) rankBox.innerHTML=rankPointDetailHtml(rankRows[i]);
    else if(kind==="rating" && ratingBox && eventPts[i]) ratingBox.innerHTML=ratingPointDetailHtml(eventPts[i],rankRows);
  };
  container.querySelectorAll(".history-chart-point").forEach(el=>{
    el.addEventListener("click",()=>activate(el));
    el.addEventListener("keydown",e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();activate(el);}});
  });
}

async function showRankingTrend(team){
  const panel=document.getElementById("detailPanel");
  const chartAccent=accentForSchool(team);
  if(!panel) return;
  panel.innerHTML=`<div class="school-detail-empty">${esc(team)} のランキング推移を読込中…</div>`;
  try{
    const rec=schoolMaster.get(String(team||"").trim())||schoolRecord(team);
    const canonical=rec?.canonical_name||String(team||"");
    const cutoff=rankingSnapshotDateValue();
    const bundle=await loadSchoolHistoryBundle(canonical);
    const allEvents=[...(bundle.events||[])].sort(eventChronoCompare);
    const events=allEvents.filter(e=>eventBeforeOrOn(e,cutoff));
    const rankRows=schoolHistoryRankRows(events);
    const snap=schoolHistorySnapshot(events,cutoff);
    const rankNow=snap?.rank ? {rank:snap.rank,total:snap.total,rating:snap.rating,games:snap.games} : currentSchoolRank(canonical,"");
    const current=snap?.rating ?? serverRatingForSchool(canonical);
    const best=rankRows.length?Math.min(...rankRows.map(x=>Number(x.rank)||99999)):null;
    const latest=[...rankRows].sort((a,b)=>eventChronoCompare(a,b)).at(-1)||null;
    // Use the selected ranking date, rather than today's date, for both figures.
    const datedRatings=events.filter(e=>/^\d{4}-\d{2}-\d{2}$/.test(String(e.date||"")) && Number.isFinite(Number(e.rating_after)));
    const peakEvent=datedRatings.reduce((best,e)=>!best||Number(e.rating_after)>Number(best.rating_after)?e:best,null);
    const bestRankEvent=rankRows.filter(e=>/^\d{4}-\d{2}-\d{2}$/.test(String(e.date||""))).reduce((v,e)=>!v||Number(e.rank)<Number(v.rank)?e:v,null);
    const latestSummary=bundle.summary||{};
    const bestRankDate=(!cutoff && latestSummary.history_best_rank_date) || bestRankEvent?.date || "";
    const asof=cutoff || latestSummary.avg_rank_24m_asof || latestMatchDateCache || ratingAuditSummary?.last_date || "";
    let average24="-";
    if(/^\d{4}-\d{2}-\d{2}$/.test(asof) && rankRows.length){
      const y=Number(asof.slice(0,4)),m=Number(asof.slice(5,7)),monthly=[];
      const ordered=[...rankRows].filter(x=>/^\d{4}-\d{2}-\d{2}$/.test(String(x.date||""))).sort(eventChronoCompare);
      for(let offset=23;offset>=0;offset--){
        const z=y*12+m-1-offset,month=`${Math.floor(z/12)}-${String(z%12+1).padStart(2,"0")}`;
        const end=month===asof.slice(0,7)?asof:month+"-31";
        const prior=ordered.filter(e=>e.date<=end).at(-1);
        if(prior && Number.isFinite(Number(prior.rank)))monthly.push(Number(prior.rank));
      }
      if(monthly.length)average24=(monthly.reduce((a,b)=>a+b,0)/monthly.length).toFixed(1)+"位";
    }

    if(!cutoff && latestSummary.avg_rank_24m!=="" && latestSummary.avg_rank_24m!=null && Number.isFinite(Number(latestSummary.avg_rank_24m))){
      average24=Number(latestSummary.avg_rank_24m).toFixed(1)+"位";
    }

    panel.innerHTML=`<div class="dark-rank-panel" style="--rank-accent:${chartAccent}">
      <div class="ranking-trend-head">
        <div>
          <h3>${esc(canonical)}</h3>
          <div class="school-meta">${esc(rec?.district||"")} / ${esc(rec?.prefecture||"")} ${rec?.school_id?`/ ${esc(rec.school_id)}`:""}</div>
        </div>
        <button type="button" class="ghost compact" id="openFullRatingHistoryFromRank">詳細履歴</button>
      </div>
      <div class="rating-summary ranking-trend-summary">
        <div><span>現在順位</span><strong>${rankNow?`${rankNow.rank}位`:"-"}</strong><small>${rankNow?`${rankNow.total}校中`:""}</small></div>
        <div><span>過去最高順位</span><strong>${best?`${best}位`:"-"}</strong><small>${esc(bestRankDate)} 記録</small></div>
        <div><span>直近24か月平均順位</span><strong>${average24}</strong><small>${esc(asof)} 基準</small></div>
        <div><span>現在Rating</span><strong>${current==null?"-":fmtR(current)}</strong></div>
        <div><span>${cutoff?"時点試合数":"試合数"}</span><strong>${rankNow?.games??events.filter(e=>e.event_type!=="generation_reset").length}</strong></div>
      </div>
      <div class="chart-wrap ranking-trend-wrap">
        <div class="chart-title">全国ランキング推移 <small>上ほど上位</small></div>
        ${schoolRankHistorySvg(rankRows)}
        <div class="history-point-detail" data-history-detail="rank"><span>● グラフ上の点をクリック／タップすると、その時点の順位を表示します。</span></div>
      </div>
      <div class="chart-wrap ranking-trend-wrap">
        <div class="chart-title">Rating推移</div>
        ${ratingHistorySvg(events)}
        <div class="history-point-detail" data-history-detail="rating"><span>● グラフ上の点をクリック／タップすると、その試合時点の情報を表示します。</span></div>
      </div>
      ${latest?`<div class="school-meta ranking-trend-last">${cutoff?`基準日 ${esc(cutoff)} 時点の最新イベント`:`最新`}: ${esc(latest.date)} ${esc(latest.tournament)} ${esc(latest.round)} / ${latest.rank}位 / Rating ${Number(latest.rating).toFixed(1)}</div>`:""}
      <div class="rank-point-table-wrap"><table class="rank-point-table"><thead><tr><th>日付</th><th>大会</th><th>回戦</th><th>全国順位</th><th>Rating</th></tr></thead><tbody>${[...rankRows].reverse().map(x=>`<tr><td>${esc(x.date||"")}</td><td>${esc(x.tournament||"")}</td><td>${esc(x.round||"")}</td><td><strong>${Number(x.rank)}位</strong></td><td>${Number(x.rating).toFixed(1)}</td></tr>`).join("")||`<tr><td colspan="5">順位履歴なし</td></tr>`}</tbody></table></div>
    </div>`;
    document.getElementById("openFullRatingHistoryFromRank")?.addEventListener("click",()=>showRatingHistory(canonical));
    wireHistoryChartPoints(panel,rankRows,events);
  }catch(err){
    console.error(err);
    panel.innerHTML=`<div class="school-detail-empty">ランキング推移を読み込めませんでした：${esc(err.message||String(err))}</div>`;
  }
}

function showDetail(team){
  // Legacy alias: ranking school clicks now show the lightweight trend view.
  return showRankingTrend(team);
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
  </svg>
  <div class="pref-scatter-extremes">
    ${[...pts].sort((a,b)=>b.y-a.y).slice(0,8).map(x=>`<span>${esc(x.p)} ${x.y>=0?"+":""}${x.y.toFixed(1)}</span>`).join("")}
    ${[...pts].sort((a,b)=>a.y-b.y).slice(0,8).map(x=>`<span>${esc(x.p)} ${x.y>=0?"+":""}${x.y.toFixed(1)}</span>`).join("")}
  </div>`;
}


function normalizeDateKey(v){
  const s=String(v||"").trim();
  const m=s.match(/^(\d{4})[\/.\-](\d{1,2})[\/.\-](\d{1,2})$/);
  if(m) return `${m[1]}-${String(Number(m[2])).padStart(2,"0")}-${String(Number(m[3])).padStart(2,"0")}`;
  const y=s.match(/^(\d{4})/);
  return y?`${y[1]}-00-00`:s;
}
function eventChronoCompare(a,b){
  return normalizeDateKey(a?.date).localeCompare(normalizeDateKey(b?.date)) || Number(a?.event_order||0)-Number(b?.event_order||0) || String(a?.match_key||"").localeCompare(String(b?.match_key||""));
}
function eventReverseChronoCompare(a,b){return -eventChronoCompare(a,b);}
function eventBeforeOrOn(e,dateStr){return !dateStr || normalizeDateKey(e?.date)<=normalizeDateKey(dateStr);}

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


function normalizeDateValue(v){
  const s=String(v??"").trim().replace(/[/.]/g,"-");
  const m=s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  return m?`${m[1]}-${String(m[2]).padStart(2,"0")}-${String(m[3]).padStart(2,"0")}`:s;
}
function ratingScoreKey(v){
  const n=Number(v);
  return Number.isFinite(n) ? String(Number.isInteger(n)?Math.trunc(n):n) : String(v??"").trim();
}
function eventMatchKey(r){
  return [
    r.year||"",r.season||"",normalizeDateKey(r.date||""),r.tournament||"",r.round||"",
    r.team1||"",ratingScoreKey(r.score1),r.team2||"",ratingScoreKey(r.score2)
  ].map(v=>String(v??"").trim()).join("|");
}
function ratingEventForMatch(r){
  const direct=ratingEventMap.get(eventMatchKey(r));
  if(direct) return direct;
  const rawKey=[r.year||"",r.season||"",r.date||"",r.tournament||"",r.round||"",r.team1||"",ratingScoreKey(r.score1),r.team2||"",ratingScoreKey(r.score2)].map(v=>String(v??"").trim()).join("|");
  return ratingEventMap.get(rawKey)||null;
}
function schoolRatingEventForMatchSide(r,side){
  const ev=ratingEventForMatch(r);
  const sid=String(r?.[`${side}_school_id`]||ev?.[`${side}_school_id`]||masterRecordForMatchSide(r,side)?.school_id||"").trim();
  if(!sid) return null;
  const keys=[ev?.match_key,eventMatchKey(r)].filter(Boolean);
  for(const k of keys){const hit=schoolEventByMatchSide.get(`${String(k).trim()}|${sid}`);if(hit)return hit;}
  return null;
}
function serverRatingForSchool(name){
  const raw = String(name||"").trim();

  // Exact master record / school_id is authoritative for branched schools.
  // Do not resolve aliases first: a same-name alias can otherwise steal the
  // lookup and make the branched ID appear as Rating "-".
  const direct = raw ? schoolMaster.get(raw) : null;
  if(direct?.school_id){
    return serverRatingById.has(String(direct.school_id))
      ? serverRatingById.get(String(direct.school_id))
      : null;
  }

  const canonical = resolveCanonicalName(raw);
  const rec = schoolMaster.get(canonical) || direct;
  if(rec?.school_id && serverRatingById.has(String(rec.school_id))){
    return serverRatingById.get(String(rec.school_id));
  }
  if(serverRatingMap.has(raw)) return serverRatingMap.get(raw);
  if(serverRatingMap.has(canonical)) return serverRatingMap.get(canonical);
  for(const alias of (rec?.aliases||[])){
    if(serverRatingMap.has(alias)) return serverRatingMap.get(alias);
  }
  return null;
}
function schoolEventsFor(name){
  const raw = String(name||"").trim();
  const direct = raw ? schoolMaster.get(raw) : null;

  if(direct?.school_id){
    return [...(schoolEventById.get(String(direct.school_id))||[])]
      .sort(eventChronoCompare);
  }

  const canonical = resolveCanonicalName(raw);
  const rec = schoolMaster.get(canonical) || direct;

  if(rec?.school_id && schoolEventById.has(String(rec.school_id))){
    return [...schoolEventById.get(String(rec.school_id))]
      .sort(eventChronoCompare);
  }

  const aliases = new Set([raw, canonical, ...(rec?.aliases||[])]);
  const merged = [];
  const seen = new Set();
  for(const alias of aliases){
    for(const e of (schoolEventMap.get(alias)||[])){
      const k = `${e.match_key}|${e.school_id||""}|${e.school}|${e.raw_team}`;
      if(!seen.has(k)){ seen.add(k); merged.push(e); }
    }
  }
  return merged.sort(eventChronoCompare);
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
  effectiveMatchSchoolCache = new WeakMap();
}

function rebuildIdentityIndexes(){
  schoolByIdMap=new Map();
  schoolNameCandidateMap=new Map();
  const addNameCandidate=(name,s)=>{
    const k=String(name||"").trim();
    if(!k) return;
    if(!schoolNameCandidateMap.has(k)) schoolNameCandidateMap.set(k,[]);
    const arr=schoolNameCandidateMap.get(k);
    if(!arr.some(x=>String(x.school_id||"")===String(s.school_id||""))) arr.push(s);
  };
  for(const s of schoolMaster.values()){
    if(s.school_id) schoolByIdMap.set(String(s.school_id),s);
    addNameCandidate(s.canonical_name,s);
    for(const a of (s.aliases||[])) addNameCandidate(a,s);
  }

  matchTeamLinkMap=new Map();
  for(const l of (matchEditsState.team_links||[])){
    if(l?.edit_key && l?.side){
      matchTeamLinkMap.set(`${l.edit_key}|${l.side}`,l);
    }
  }

  schoolMatchCache=new Map();
  effectiveMatchSchoolCache = new WeakMap();
  const rows=ledgerMatches.length?ledgerMatches:allMatches;

  const add=(key,row)=>{
    if(!key) return;
    if(!schoolMatchCache.has(key)) schoolMatchCache.set(key,[]);
    schoolMatchCache.get(key).push(row);
  };

  for(const r of rows){
    const cached={};
    for(const side of ["team1","team2"]){
      const eff=effectiveMatchSchoolUncached(r,side);
      cached[side]=eff;
      add(eff.school_id?`id:${eff.school_id}`:`name:${eff.canonical}`,r);
    }
    effectiveMatchSchoolCache.set(r,cached);
  }
  identityIndexDirty=false;
}

function ensureIdentityIndexes(){
  if(identityIndexDirty) rebuildIdentityIndexes();
}

function buildFastIndexes(){
  prefInterstateCache=null;
  schoolRankHistoryCache=new Map();
  currentSchoolRankCache=new Map();
  rankingMasterByIdCache=null;
  rankingNameIndexCache=null;
  latestMatchDateCache=allMatches.reduce((m,r)=>normalizeDateKey(r.date||"")>m?normalizeDateKey(r.date||""):m,"");
  ratingEventMap = new Map();
  for(const e of ratingEvents){
    if(e.match_key) ratingEventMap.set(String(e.match_key).trim(),e);
    // Also index from the event's structured fields. This makes manual/input rows
    // robust to "4" vs "4.0" and other CSV serialization differences.
    ratingEventMap.set(eventMatchKey(e),e);
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
  schoolEventByMatchSide = new Map();
  ratingSchoolEvents.sort(eventChronoCompare);
  const ordered=[...ratingSchoolEvents].filter(e=>eventBeforeOrOn(e,cutoff)).sort(eventChronoCompare);
  for(const e of ordered){
    if(e.school_id){
      const sid=String(e.school_id);
      if(!schoolEventById.has(sid)) schoolEventById.set(sid,[]);
      schoolEventById.get(sid).push(e);
      if(e.match_key){
        const mk=String(e.match_key).trim();
        schoolEventByMatchSide.set(`${mk}|${sid}`,e);
      }
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

function ratingUnitForSide(r,side){
  const rec=masterRecordForMatchSide(r,side);
  let p=normalizePrefectureName(rec?.prefecture||r?.[`${side}_prefecture`]||r?.prefecture||"");
  const rep=String(rec?.representative_area||"");
  const text=`${r?.tournament||""} ${r?.note||""}`;
  if(p==="北海道"||p==="北北海道"||p==="南北海道"){
    if(rep==="北北海道"||rep==="南北海道") return rep;
    if(text.includes("北北海道")) return "北北海道";
    if(text.includes("南北海道")) return "南北海道";
    return "北海道";
  }
  if(p==="東京"||p==="東東京"||p==="西東京"){
    if(rep==="東東京"||rep==="西東京") return rep;
    if(text.includes("東東京")) return "東東京";
    if(text.includes("西東京")) return "西東京";
    return "東京";
  }
  return p;
}
function displayPrefUnit(unit,season){
  const s=({senbatsu:"spring",koshien:"summer",jingu:"autumn"})[season]||season;
  if((s==="spring"||s==="autumn") && (unit==="北北海道"||unit==="南北海道")) return "北海道";
  if((s==="spring"||s==="autumn") && (unit==="東東京"||unit==="西東京")) return "東京";
  return unit;
}
function ledgerPrefValues(r){
  const scope=ledgerScope(r.level);
  const rowPref=displayPrefUnit(normalizePrefectureName(specialPrefecture(r)||r.prefecture||""),r.season);

  // 県大会・支部/地区予選など「1県内で完結する階層」では、
  // 県欄は台帳の所属県タグを1つだけ表示する。
  // 学校マスタ側の所属県は同名校解決・監査に使い、県欄へ混在させない。
  if(scope==="prefecture" || scope==="subpref"){
    return rowPref ? [rowPref] : [];
  }

  // 地区・全国では両校の所属県が情報として意味を持つ。
  const a=displayPrefUnit(ratingUnitForSide(r,"team1"),r.season);
  const b=displayPrefUnit(ratingUnitForSide(r,"team2"),r.season);
  return uniq([a,b,rowPref]);
}
function ledgerPrefTagWarning(r){
  const scope=ledgerScope(r.level);
  if(scope!=="prefecture" && scope!=="subpref") return "";
  const a=masterRecordForMatchSide(r,"team1");
  const b=masterRecordForMatchSide(r,"team2");
  const pa=normalizePrefectureName(a?.prefecture||"");
  const pb=normalizePrefectureName(b?.prefecture||"");
  const cur=normalizePrefectureName(r.prefecture||"");
  if(pa && pb && pa===pb && cur && cur!==pa){
    return `<span class="pref-tag-warning" title="台帳県タグ ${esc(cur)} / 両校所属 ${esc(pa)}">要補正</span>`;
  }
  return "";
}
function ledgerDisplayPref(r){
  const vals=ledgerPrefValues(r);
  return vals.join(" / ");
}

function sourceKind(r){
  if(String(r.source_url||"").trim()) return "web";
  if(String(r.source_ref||"").trim() || String(r.source_status||"").includes("元帳")) return "ledger";
  return "missing";
}

function ensureManualMatchesInLedger(){
  const deleted=new Set((matchEditsState.deleted_matches||[]).map(x=>String(x.edit_key||"")));
  const have=new Set((ledgerMatches||[]).map(x=>matchEditKey(x)));
  let added=0;
  for(const m of matchEditsState.manual_matches||[]){
    const key=String(m.manual_id||m.edit_key||"");
    if(!key || deleted.has(key) || have.has(key)) continue;
    const nr=normalizeRows([applySharedEditsToRow({...m,edit_key:key})])[0];
    if(!nr) continue;
    ledgerMatches.push({...nr,_id:ledgerMatches.length});
    if(!(allMatches||[]).some(x=>matchEditKey(x)===key)) allMatches.push({...nr,_id:allMatches.length});
    have.add(key); added++;
  }
  if(added) buildFastIndexes();
  return added;
}

function resetLedgerFiltersForManual(){
  ["ledgerYear","ledgerSeason","ledgerScope","ledgerRegion","ledgerPref","ledgerSubArea","ledgerSource","ledgerUnion"]
    .forEach(id=>{const el=document.getElementById(id); if(el) el.value="all";});
  const school=document.getElementById("ledgerSchool"); if(school) school.value="";
  const sort=document.getElementById("ledgerSort"); if(sort) sort.value="date_desc";
  ledgerPage=1;
}

function ledgerSelectedRows(){
  ensureManualMatchesInLedger();
  const source=ledgerMatches.length?ledgerMatches:allMatches;
  // Avoid building an index for every row when only a few rows are selected.
  const pending=new Set(ledgerSelectedKeys);
  const found=new Map();
  for(const r of source){
    if(!pending.size)break;
    const k=ledgerSelectionKey(r);
    if(pending.delete(k))found.set(k,r);
  }
  return [...ledgerSelectedKeys].map(k=>found.get(k)).filter(Boolean);
}

function updateLedgerBulkBar(){
  const bar=document.getElementById("ledgerBulkBar");
  const count=document.getElementById("ledgerSelectedCount");
  if(count) count.textContent=String(ledgerSelectedKeys.size);
  if(bar) bar.classList.toggle("hidden",ledgerSelectedKeys.size===0);
}

function filteredLedgerMatches(){
  const year = selected("ledgerYear");
  const season = selected("ledgerSeason");
  const scope = selected("ledgerScope");
  const region = selected("ledgerRegion");
  const pref = selected("ledgerPref");
  const sub = selected("ledgerSubArea");
  const source = selected("ledgerSource");
  const unionMode = selected("ledgerUnion");
  const school = document.getElementById("ledgerSchool").value.trim().toLowerCase();

  // If a prefecture is selected and the typed school name exactly identifies
  // one or more schools in that prefecture, filter by school_id rather than
  // by raw substring. This separates same-name schools such as 城西 / 瀬戸 / 東.
  const exactIds = (school && pref!=="all")
    ? ledgerSchoolQueryCandidateIds(school,pref)
    : new Set();

  const sourceRows = ledgerMatches.length ? ledgerMatches : allMatches;
  // Bucket delete operations once per search. Previously each displayed row
  // scanned every authority operation, freezing the browser on large ledgers.
  const deleteIds=new Set(),deleteByDate=new Map();
  for(const op of activeAuthorityDeleteOps()){
    if(op.match_id)deleteIds.add(String(op.match_id));
    const snap=op.snapshot||{};
    const d=normalizeDateValue(snap.date)||String(snap.date||"").trim();
    const key=[String(snap.year||"").trim(),String(snap.season||"").trim(),d].join("|");
    if(!deleteByDate.has(key))deleteByDate.set(key,[]);
    deleteByDate.get(key).push(snap);
  }
  return sourceRows.filter(r=>{
    if(year!=="all" && r.year!==year) return false;
    if(season!=="all" && r.season!==season) return false;
    // Final display guard, with indexed authority DELETE checks.
    const dk=[String(r.year||"").trim(),String(r.season||"").trim(),normalizeDateValue(r.date)||String(r.date||"").trim()].join("|");
    if(deleteIds.size||deleteByDate.size){
      if(deleteIds.has(matchAuthorityId(r)))return false;
      if((deleteByDate.get(dk)||[]).some(snap=>authoritySnapshotMatchesRow(r,snap)))return false;
    }
    if(year!=="all" && r.year!==year) return false;
    if(season!=="all" && r.season!==season) return false;
    if(scope!=="all" && ledgerScope(r.level)!==scope) return false;
    if(pref==="all" && region!=="all" && r.region!==region) return false;
    if(pref!=="all" && !ledgerPrefValues(r).includes(pref)) return false;
    if(sub!=="all" && r.sub_area!==sub) return false;
    if(source!=="all" && sourceKind(r)!==source) return false;

    const hasUnion=String(r.team1_type||"")==="union"||String(r.team2_type||"")==="union"||r.team1_union_id||r.team2_union_id;
    if(unionMode==="union"&&!hasUnion)return false;
    if(unionMode==="normal"&&hasUnion)return false;

    if(school){
      const e1=effectiveMatchSchool(r,"team1");
      const e2=effectiveMatchSchool(r,"team2");

      if(exactIds.size){
        if(!exactIds.has(String(e1.school_id||"")) && !exactIds.has(String(e2.school_id||""))) return false;
      }else{
        const a=String(e1.canonical||"").toLowerCase();
        const b=String(e2.canonical||"").toLowerCase();
        const ra=String(r.team1||"").toLowerCase();
        const rb=String(r.team2||"").toLowerCase();
        if(!a.includes(school) && !b.includes(school) && !ra.includes(school) && !rb.includes(school)) return false;
      }
    }
    return true;
  });
}

function sortLedgerRows(rows){
  const mode = selected("ledgerSort") || "date_desc";
  return [...rows].sort((a,b)=>{
    if(mode==="year_asc"){
      return Number(a.year)-Number(b.year) || (a.date||"").localeCompare(b.date||"") || a._id-b._id;
    }
    if(mode==="date_desc"){
      return (normalizeDateValue(b.date)||"0000-00-00").localeCompare(normalizeDateValue(a.date)||"0000-00-00") || Number(b.year)-Number(a.year) || b._id-a._id;
    }
    if(mode==="school"){
      const aa = effectiveMatchSchoolName(a,"team1");
      const bb = effectiveMatchSchoolName(b,"team1");
      return aa.localeCompare(bb,"ja") || Number(b.year)-Number(a.year);
    }
    if(mode==="tournament"){
      const ta=String(a.tournament||"").trim();
      const tb=String(b.tournament||"").trim();
      return ta.localeCompare(tb,"ja") ||
        Number(b.year)-Number(a.year) ||
        (normalizeDateValue(b.date)||"0000-00-00").localeCompare(normalizeDateValue(a.date)||"0000-00-00") ||
        String(a.round||"").localeCompare(String(b.round||""),"ja") ||
        a._id-b._id;
    }
    if(mode==="year_desc"){
      return Number(b.year)-Number(a.year) || (b.date||"").localeCompare(a.date||"") || b._id-a._id;
    }
    // Normal ledger state: actual game date newest first. Year is only a fallback.
    return (normalizeDateValue(b.date)||"0000-00-00").localeCompare(normalizeDateValue(a.date)||"0000-00-00") || Number(b.year)-Number(a.year) || b._id-a._id;
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


function identityPrefUnit(pref){
  const p=normalizePrefectureName(pref)||String(pref||"").trim();
  if(p==="東東京"||p==="西東京") return "東京";
  if(p==="北北海道"||p==="南北海道") return "北海道";
  return p;
}

function specificLinkForRow(r,side){
  const key=matchEditKey(r);
  const mapKey=`${key}|${side}`;

  let saved=null;
  if(matchTeamLinkMap.size){
    saved=matchTeamLinkMap.get(mapKey)||null;
  }else{
    saved=(matchEditsState.team_links||[]).find(x=>x.edit_key===key && x.side===side)||null;
  }

  // Old versions could save a same-name school from the wrong prefecture
  // (e.g. 徳島 城西 -> 東京 城西大城西, 岡山 瀬戸 -> 愛知 瀬戸).
  // For a row with a reliable prefecture hint, such a stale link is invalid.
  if(saved){
    const pref=identityPrefUnit(sidePrefHintNoSpecific(r,side));
    const target=saved.school_id ? schoolByIdMap.get(String(saved.school_id)) : null;
    const targetPref=identityPrefUnit(target?.prefecture||"");
    if(pref && targetPref && pref!==targetPref){
      saved=null;
    }
  }
  if(saved) return saved;

  const sid=String(r?.[`${side}_school_id`]||"").trim();
  const canonical=String(r?.[`${side}_canonical`]||"").trim();
  if(sid || canonical){
    const pref=identityPrefUnit(sidePrefHintNoSpecific(r,side));
    const target=sid ? schoolByIdMap.get(sid) : schoolRecordByNameOrId(canonical);
    const targetPref=identityPrefUnit(target?.prefecture||"");
    if(!(pref && targetPref && pref!==targetPref)){
      return {edit_key:key,side,school_id:sid,canonical_name:canonical};
    }
  }
  return null;
}

function sidePrefHintNoSpecific(r,side){
  const explicit=normalizePrefectureName(r?.[`${side}_prefecture`]||"");
  if(explicit) return explicit;

  const note=String(r?.note||"");
  const m=note.match(new RegExp(`(?:^|;)${side}_pref=([^;]+)`));
  if(m) return normalizePrefectureName(m[1]);

  const lvl=effectiveMatchLevel(r);
  if(["prefecture","branch","district_qualifier","first_qualifier","preliminary","qualifier_league","repechage"].includes(lvl)){
    return normalizePrefectureName(r?.prefecture||"");
  }

  // Tokyo autumn and Hokkaido all-prefecture stages are rated as "regional",
  // but every team still belongs to the same prefecture. Use that geography
  // to separate same-name schools from other prefectures.
  if(lvl==="regional"){
    const rowPref=identityPrefUnit(r?.prefecture||"");
    const text=`${r?.tournament||""} ${r?.note||""}`;
    if(rowPref==="東京" && text.includes("東京")) return "東京";
    if(rowPref==="北海道" && (text.includes("北海道")||text.includes("全道"))) return "北海道";
  }
  return "";
}

function sidePrefHint(r,side){
  return sidePrefHintNoSpecific(r,side);
}

function resolveSchoolCandidateForRow(raw,r,side){
  const candidates=schoolNameCandidateMap.get(String(raw||"").trim())||[];
  if(!candidates.length) return null;
  const pref=identityPrefUnit(sidePrefHint(r,side));
  if(pref){
    const exact=candidates.filter(s=>identityPrefUnit(s.prefecture||"")===pref);
    if(exact.length===1) return exact[0];
  }
  // A genuinely unique name/alias is safe without geography.
  if(candidates.length===1) return candidates[0];
  // Ambiguous same-name school without a reliable geographic hint:
  // do NOT borrow another prefecture's identity.
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

  const geoCandidate=resolveSchoolCandidateForRow(raw,r,side);
  if(geoCandidate){
    return {
      raw,
      canonical:geoCandidate.canonical_name||raw,
      school_id:geoCandidate.school_id||"",
      source:"geo"
    };
  }

  // A prefecture-tagged match must never be hijacked by an alias from another prefecture.
  const candidates=schoolNameCandidateMap.get(raw)||[];
  const rowPref=identityPrefUnit(sidePrefHintNoSpecific(r,side) || r?.[`${side}_prefecture`] || r?.prefecture || "");
  if(rowPref && candidates.length){
    const inPref=candidates.filter(x=>identityPrefUnit(x.prefecture)===rowPref);
    if(inPref.length===1){
      const rec=inPref[0];
      return {raw,canonical:rec.canonical_name||raw,school_id:rec.school_id||"",source:"geo"};
    }
    if(inPref.length===0) return {raw,canonical:raw,school_id:"",source:"geo_mismatch"};
    return {raw,canonical:raw,school_id:"",source:"ambiguous"};
  }
  if(candidates.length>1) return {raw,canonical:raw,school_id:"",source:"ambiguous"};

  const canonical=resolveCanonicalName(raw);
  const rec=schoolMaster.get(canonical);
  return {raw,canonical,school_id:rec?.school_id||"",source:canonical!==raw?"alias":"raw"};
}

function effectiveMatchSchool(r,side){
  if(identityIndexDirty){
    return effectiveMatchSchoolUncached(r,side);
  }
  const hit=effectiveMatchSchoolCache.get(r);
  if(hit?.[side]) return hit[side];

  const eff=effectiveMatchSchoolUncached(r,side);
  const next=hit||{};
  next[side]=eff;
  effectiveMatchSchoolCache.set(r,next);
  return eff;
}

function effectiveMatchSchoolName(r,side){
  return effectiveMatchSchool(r,side).canonical;
}

function matchBelongsToSchool(r,side,rec){
  const eff=effectiveMatchSchool(r,side);
  if(rec?.school_id && eff.school_id) return eff.school_id===rec.school_id;
  return eff.canonical===rec?.canonical_name;
}


function ledgerDisplayedSchoolName(r,side){
  const raw=String(r?.[side]||"").trim();
  const eff=effectiveMatchSchool(r,side);
  return eff?.canonical || raw;
}
function ledgerRawNameNote(r,side){
  const raw=String(r?.[side]||"").trim();
  const shown=ledgerDisplayedSchoolName(r,side);
  if(!raw || !shown || raw===shown) return "";
  return `<div class="school-meta ledger-raw-name">元表記：${esc(raw)}</div>`;
}

function rawSpecificLinkForRow(r,side){
  const key=matchEditKey(r);
  return (matchEditsState.team_links||[]).find(x=>x.edit_key===key&&x.side===side)||null;
}
function staleCrossPrefLinkForRow(r,side){
  const x=rawSpecificLinkForRow(r,side);
  if(!x) return null;
  const pref=identityPrefUnit(sidePrefHintNoSpecific(r,side));
  const target=x.school_id ? schoolByIdMap.get(String(x.school_id)) : null;
  const tp=identityPrefUnit(target?.prefecture||"");
  return pref&&tp&&pref!==tp ? {link:x,rowPref:pref,targetPref:tp} : null;
}
function ledgerLinkButton(r,side){
  const raw=String(r?.[side]||"").trim();
  const specific=specificLinkForRow(r,side);
  const eff=effectiveMatchSchool(r,side);
  const shown=specific?.canonical_name || eff.canonical || raw;
  const linked=Boolean(specific);
  const title=linked
    ? `この試合だけ: ${shown}`
    : (eff.canonical!==raw ? `県・試合情報による候補: ${eff.canonical} / この試合だけ指定できます` : "この試合だけ現在校へ紐づけ");

  return `<button type="button" class="ledger-link-btn ${linked?"linked specific":""}"
    data-ledger-link-key="${esc(matchEditKey(r))}"
    data-ledger-link-side="${esc(side)}"
    data-ledger-link-raw="${esc(raw)}"
    title="${esc(title)}">
    ${linked?"試合紐付済":"紐づけ"}
  </button>`;
}

function ledgerSchoolNameSearchScore(rec,query){
  const q=String(query||"").trim().toLowerCase();
  if(!q)return 999;
  const names=[String(rec?.canonical_name||""),...(rec?.aliases||[])].map(x=>x.trim()).filter(Boolean);
  let best=999;
  for(const name of names){
    const n=name.toLowerCase();
    if(n===q)best=Math.min(best,0);
    else if(n.startsWith(q))best=Math.min(best,1);
    else if(n.includes(q))best=Math.min(best,2);
  }
  return best;
}


function currentLedgerLinkRow(){
  return ledgerMatches.find(x=>matchEditKey(x)===ledgerLinkEditKey)
    || allMatches.find(x=>matchEditKey(x)===ledgerLinkEditKey)
    || null;
}
function currentLedgerLinkPref(){
  const row=currentLedgerLinkRow();
  return row ? sidePrefHint(row,ledgerLinkSide) : "";
}
function schoolRecordById(id){
  const sid=String(id||"").trim();
  if(!sid)return null;
  for(const x of schoolMaster.values()) if(String(x.school_id||"")===sid) return x;
  return null;
}
async function linkLedgerMatchTeamByRecord(target){
  if(!ledgerLinkEditKey || !ledgerLinkSide || !target) return;
  const editKey=ledgerLinkEditKey,side=ledgerLinkSide,rawName=ledgerLinkRawName;
  upsertMatchTeamLink(editKey,side,target);
  for(const arr of [ledgerMatches,allMatches]){
    const row=arr.find(x=>matchEditKey(x)===editKey);
    if(row){
      row[`${side}_school_id`]=target.school_id||"";
      row[`${side}_canonical`]=target.canonical_name||"";
    }
  }
  closeLedgerSchoolLink();
  markIdentityIndexesDirty();
  renderLedger();
  persistPendingMatchEdits();
  fastSaveStatus("試合別紐づけ：GitHub保存・検証中","saving");
  await saveMatchEditsImmediately(
    `Link match school: ${rawName} -> ${target.canonical_name}`,[],[],
    [teamLinkVerification(editKey,side,target)]
  );
  markIdentityIndexesDirty();
  renderLedger();
  fastSaveStatus("試合別紐づけ：GitHub保存・検証済み","saved");
  showSaveToast(`GitHub紐づけ保存・検証済み：${rawName} → ${target.canonical_name}`);
}

function schoolNameOrAliasCollision(name, exceptPref=""){
  const raw=String(name||"").trim();
  const pref=normalizePrefectureName(exceptPref)||"";
  return [...schoolMaster.values()].some(x=>{
    if((x.status||"active")==="merged" || x.kind==="union") return false;
    const sameName=String(x.canonical_name||"").trim()===raw ||
      (x.aliases||[]).some(a=>String(a||"").trim()===raw);
    if(!sameName) return false;
    return !pref || normalizePrefectureName(x.prefecture)!==pref;
  });
}

function samePrefSchoolForRaw(raw,pref){
  const name=String(raw||"").trim();
  const p=normalizePrefectureName(pref)||"";
  const hits=[...schoolMaster.values()].filter(x=>
    (x.status||"active")!=="merged" &&
    x.kind!=="union" &&
    normalizePrefectureName(x.prefecture)===p &&
    (
      String(x.canonical_name||"").trim()===name ||
      (x.aliases||[]).some(a=>String(a||"").trim()===name)
    )
  );
  return hits.length===1 ? hits[0] : null;
}

async function forceLinkRawAsPrefSchool(){
  const row=currentLedgerLinkRow();
  const raw=ledgerLinkRawName;
  const pref=currentLedgerLinkPref();
  if(!row||!raw||!pref){
    alert("この試合の県情報を確認できません。");
    return;
  }

  const existing=samePrefSchoolForRaw(raw,pref);
  if(existing){
    await linkLedgerMatchTeamByRecord(existing);
    return;
  }

  const district=PREF_TO_DISTRICT[pref]||"不明";

  // Important: if the raw name is already another school's alias,
  // do NOT create canonical_name=raw. That would still be stolen by the
  // global alias resolver. Use a prefecture-qualified canonical ID instead.
  let canonical=raw;
  if(
    schoolMaster.has(raw) ||
    [...schoolMaster.values()].some(x=>(x.aliases||[]).includes(raw))
  ){
    canonical=`${raw}（${pref}）`;
  }

  let schoolId=provisionalSchoolId(canonical,district,pref,"00");
  const usedIds=new Set([...schoolMaster.values()].map(x=>String(x.school_id||"")));
  if(usedIds.has(schoolId)){
    schoolId=provisionalSchoolId(`${canonical}-${Date.now()}`,district,pref,"00");
  }

  const rec={
    school_id:schoolId,
    canonical_name:canonical,
    district,
    prefecture:pref,
    aliases:[raw],
    status:"active",
    kind:"school",
    local_district:"",
    local_district_id:"",
    representative_area:pref,
    representative_area_id:"",
    established_year:"",
    closed_year:"",
    successor_id:""
  };

  schoolMaster.set(canonical,rec);
  saveMasterToStorage();

  try{
    await pushSharedMasterToGitHub(`Create same-name school from ledger: ${raw} / ${pref}`);
    await linkLedgerMatchTeamByRecord(rec);
    showSaveToast(`紐づけ修正済み：${raw} → ${canonical}`);
  }catch(err){
    alert(`学校作成または紐づけ保存に失敗しました。\n${err.message||err}`);
  }
}

async function createAndLinkLedgerSchool(name){
  const raw=String(name||"").trim(),pref=currentLedgerLinkPref();
  if(!raw||!pref){alert("学校名または試合の都道府県を確認できません。");return;}

  const existing=samePrefSchoolForRaw(raw,pref);
  if(existing){await linkLedgerMatchTeamByRecord(existing);return;}

  const district=PREF_TO_DISTRICT[pref]||"不明";
  const collision=
    schoolMaster.has(raw) ||
    [...schoolMaster.values()].some(x=>(x.aliases||[]).includes(raw));

  const canonical=collision ? `${raw}（${pref}）` : raw;
  let schoolId=provisionalSchoolId(canonical,district,pref,"00");
  const used=new Set([...schoolMaster.values()].map(x=>String(x.school_id||"")));
  if(used.has(schoolId)) schoolId=provisionalSchoolId(`${canonical}-${Date.now()}`,district,pref,"00");

  const rec={
    school_id:schoolId,canonical_name:canonical,district,prefecture:pref,
    aliases:[raw],status:"active",kind:"school",
    local_district:"",local_district_id:"",representative_area:pref,representative_area_id:"",
    established_year:"",closed_year:"",successor_id:""
  };

  schoolMaster.set(canonical,rec);
  saveMasterToStorage();
  try{
    await pushSharedMasterToGitHub(`Create school from ledger link: ${raw} / ${pref}`);
    await linkLedgerMatchTeamByRecord(rec);
    showSaveToast(`学校作成・紐づけ保存済み：${raw} → ${canonical}`);
  }catch(err){
    alert(`学校は端末内に作成しましたがGitHub保存に失敗しました。\n${err.message||err}`);
  }
}
function renderLedgerLinkCandidates(query=""){
  const wrap=document.getElementById("ledgerLinkCandidates");
  if(!wrap)return;
  const rawQuery=String(query||"").trim();
  const q=rawQuery.toLowerCase();
  const pref=currentLedgerLinkPref();

  if(!q){
    wrap.innerHTML=`<div class="school-detail-empty">校名を入力してください。<br><small>この試合と同じ県を優先し、完全一致 → 前方一致 → 部分一致の順で表示します。</small></div>`;
    return;
  }

  const all=[...schoolMaster.values()]
    .filter(x=>(x.status||"active")!=="merged" && x.kind!=="union")
    .map(rec=>{
      const score=ledgerSchoolNameSearchScore(rec,q);
      const samePref=Boolean(pref && normalizePrefectureName(rec.prefecture)===pref);
      const names=[String(rec.canonical_name||""),...(rec.aliases||[])].map(x=>x.trim().toLowerCase()).filter(Boolean);
      return {
        rec,score,samePref,
        exact:names.includes(q),
        prefix:names.some(n=>n.startsWith(q))
      };
    })
    .filter(x=>x.score<999);

  const exactSamePref=all.filter(x=>x.samePref && x.exact);
  const samePrefHits=all.filter(x=>x.samePref);
  let scored;
  if(pref && exactSamePref.length){
    scored=exactSamePref;
  }else if(pref && samePrefHits.length){
    // A prefecture-tagged row should not offer hundreds of similarly named
    // schools from other prefectures while a local candidate exists.
    scored=samePrefHits;
  }else{
    scored=all;
  }

  scored.sort((a,b)=>
    Number(b.samePref)-Number(a.samePref) ||
    Number(b.exact)-Number(a.exact) ||
    Number(b.prefix)-Number(a.prefix) ||
    a.score-b.score ||
    String(a.rec.canonical_name||"").length-String(b.rec.canonical_name||"").length ||
    String(a.rec.canonical_name||"").localeCompare(String(b.rec.canonical_name||""),"ja")
  );

  const rows=scored.slice(0,q.length<=1?12:30).map(x=>x.rec);
  const createHtml=(pref&&!exactSamePref.length)
    ? `<button type="button" class="ledger-link-create" data-create-ledger-school="1">
         <strong>${esc(pref)}の「${esc(rawQuery)}」を新しい学校として作成して紐づけ</strong>
         <small>この試合の県情報で別IDにします。他県の同名・類似校には影響しません。</small>
       </button>`:"";

  wrap.innerHTML=createHtml+rows.map(x=>{
    const c=schoolRowColor(x),xp=normalizePrefectureName(x.prefecture)||"",same=pref&&xp===pref;
    const exact=[String(x.canonical_name||""),...(x.aliases||[])].some(n=>String(n||"").trim().toLowerCase()===q);
    return `<button type="button" class="ledger-link-candidate ${same?"same-pref":""} ${exact?"exact-hit":""}" data-link-school-id="${esc(x.school_id||"")}"
      style="--candidate-bg:${c.bg};--candidate-accent:${c.accent}">
      <span class="candidate-color"></span>
      <span class="ledger-link-candidate-text">
        <strong>${esc(x.canonical_name)}</strong>
        <small>${same?"★ この試合と同じ県 / ":""}${exact?"完全一致 / ":""}${esc(xp)}${x.school_id?` / ${esc(x.school_id)}`:""}</small>
      </span>
    </button>`;
  }).join("")||(!createHtml?`<div class="school-detail-empty">「${esc(rawQuery)}」に一致する学校はありません</div>`:"");

  wrap.querySelectorAll("[data-link-school-id]").forEach(btn=>btn.addEventListener("click",async()=>{
    const rec=schoolRecordById(btn.dataset.linkSchoolId); if(!rec)return;
    try{await linkLedgerMatchTeamByRecord(rec);}
    catch(err){alert(`紐づけ保存に失敗しました。\n${err.message||err}`);}
  }));
  wrap.querySelector("[data-create-ledger-school]")?.addEventListener("click",()=>createAndLinkLedgerSchool(rawQuery));
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

  const row=currentLedgerLinkRow();
  const specific=row ? specificLinkForRow(row,ledgerLinkSide) : null;
  const eff=row ? effectiveMatchSchool(row,ledgerLinkSide) : {canonical:ledgerLinkRawName};
  const pref=currentLedgerLinkPref();
  label.textContent=`この試合の${ledgerLinkSide==="team1"?"チーム1":"チーム2"}：${ledgerLinkRawName}${pref?`（${pref}）`:""}`;
  if(specific?.canonical_name){
    const target=specific.school_id ? schoolByIdMap.get(String(specific.school_id)) : schoolRecordByNameOrId(specific.canonical_name);
    const targetPref=normalizePrefectureName(target?.prefecture||"");
    const wrongPref=Boolean(pref && targetPref && targetPref!==pref);
    current.innerHTML=`現在の試合別紐づけ：<strong>${esc(specific.canonical_name)}</strong>
      ${targetPref?`<div class="school-meta">紐づけ先：${esc(targetPref)}</div>`:""}
      ${wrongPref?`<div class="ledger-link-warning">この試合は${esc(pref)}ですが、${esc(targetPref)}の学校へ紐づいています。</div>
      <button type="button" class="save-btn compact" id="forcePrefSchoolLinkBtn">${esc(pref)}の「${esc(ledgerLinkRawName)}」として分離・紐づけ</button>`:
      `<div class="school-meta">この変更はこの試合だけに適用されます。</div>`}`;
    if(wrongPref){
      setTimeout(()=>document.getElementById("forcePrefSchoolLinkBtn")?.addEventListener("click",async()=>{
        try{await forceLinkRawAsPrefSchool();}catch(err){alert(err.message||err);}
      }),0);
    }
  }else if(eff.canonical!==ledgerLinkRawName){
    current.innerHTML=`現在：<strong>${esc(eff.canonical)}</strong>
      <div class="school-meta">県・試合情報による暫定解決。ここで選ぶと、この試合専用の紐づけになります。</div>`;
  }else{
    current.innerHTML=`現在の試合別紐づけ：<strong>未設定</strong>
      <div class="school-meta">${pref?`${esc(pref)}の試合として候補を優先表示します。`:""} この試合だけに紐づけます。</div>
      ${pref?`<button type="button" class="ghost compact" id="forcePrefSchoolLinkBtn">${esc(pref)}の「${esc(ledgerLinkRawName)}」として分離・紐づけ</button>`:""}`;
    if(pref){
      setTimeout(()=>document.getElementById("forcePrefSchoolLinkBtn")?.addEventListener("click",async()=>{
        try{await forceLinkRawAsPrefSchool();}catch(err){alert(err.message||err);}
      }),0);
    }
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
  const target=schoolMaster.get(targetName)||schoolRecordByNameOrId(targetName);
  if(!target)return;
  try{await linkLedgerMatchTeamByRecord(target);}
  catch(err){alert(`紐づけは画面に反映しましたがGitHub保存に失敗しました。\n${err.message||err}\n変更はこの端末に保留しています。`);}
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

async function auditManualMatchPersistence(){
  const localIds=new Set((matchEditsState.manual_matches||[]).map(x=>String(x.manual_id||"")).filter(Boolean));
  const backupIds=new Set(loadManualMatchesBackup().map(x=>String(x.manual_id||"")).filter(Boolean));
  const cfg=loadGitHubSyncConfig();
  let remoteIds=new Set(),remoteSource="未確認",remoteError="";
  try{
    let remote=null;
    if(cfg.owner&&cfg.repo&&githubSessionToken){
      remote=await fetchGithubJsonFile(MATCH_EDITS_PATH);
      remoteSource="GitHub API main";
    }else if(cfg.owner&&cfg.repo){
      const safePath=MATCH_EDITS_PATH.split("/").map(encodeURIComponent).join("/");
      const url=`https://raw.githubusercontent.com/${encodeURIComponent(cfg.owner)}/${encodeURIComponent(cfg.repo)}/${encodeURIComponent(cfg.branch||"main")}/${safePath}?t=${Date.now()}`;
      const res=await fetch(url,{cache:"no-store"});
      if(!res.ok) throw new Error(`HTTP ${res.status}`);
      remote={state:await res.json()};
      remoteSource="GitHub raw main";
    }
    remoteIds=new Set((remote?.state?.manual_matches||[]).map(x=>String(x.manual_id||"")).filter(Boolean));
  }catch(err){ remoteError=String(err?.message||err); }
  const missing=[...localIds].filter(x=>!remoteIds.has(x));
  const msg=[
    `画面/共有状態: ${localIds.size}件`,
    `手入力専用バックアップ: ${backupIds.size}件`,
    `GitHub main: ${remoteIds.size}件（${remoteSource}）`,
    missing.length?`GitHub未確認: ${missing.length}件`:`GitHub未確認: 0件`,
    remoteError?`GitHub確認エラー: ${remoteError}`:""
  ].filter(Boolean).join("\n");
  setLedgerReflectionStatus(missing.length||remoteError?"error":"saved",missing.length||remoteError?"手入力保存監査：要確認":"手入力保存監査：一致",msg.replace(/\n/g," / "));
  alert(msg+(missing.length?`\n\n未確認ID（先頭5件）\n${missing.slice(0,5).join("\n")}`:""));
}

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
    manual_id:id,edit_key:id,match_id:id,year,season,
    region:normalizeRegionName(document.getElementById("manualRegion").value),
    prefecture:document.getElementById("manualPref").value.trim(),
    tournament,round:document.getElementById("manualRound").value.trim(),date,
    team1,score1:s1,team2,score2:s2,
    innings:Number(document.getElementById("manualInnings").value)||"",
    finish_type:document.getElementById("manualFinish").value,
    source_url:document.getElementById("manualSourceUrl").value.trim(),
    note,
    updated_at:new Date().toISOString()
  };
  matchEditsState.manual_matches.push(row);
  appendMatchAuthorityOp("ADD",row,row);
  persistManualMatchesBackup();
  setLedgerReflectionStatus("local","① 画面へ反映済み","手入力専用バックアップへ保存済み。続けてGitHubへ保存します。");
  const nr=normalizeRows([row])[0];
  if(nr){
    allMatches.push(nr);
    ledgerMatches.push({...nr,_id:ledgerMatches.length});
    detectedSchoolGeo=buildSchoolMeta(allMatches);
  }
  ledgerLastManualKeys=new Set([id]);
  resetLedgerFiltersForManual();
  closeManualMatchModal();
  buildFastIndexes();ensureManualMatchesInLedger();renderLedger();persistPendingMatchEdits();
  try{
    setLedgerReflectionStatus("saving","② GitHub保存中","共有台帳 master/match_edits_shared.json へ保存・照合しています。");
    const saveProof=await saveMatchEditsImmediately(`Add manual match: ${team1} ${s1}-${s2} ${team2}`,[],[id]);
    const savedRow=ledgerMatches.find(x=>String(x.manual_id||"")===String(id)) || nr;
    const commitShort=String(saveProof?.commit||"").slice(0,7);
    setLedgerReflectionStatus("waiting","③ GitHub保存・照合済み",`台帳への登録は完了しました${commitShort?`（commit ${commitShort}）`:""}。Rating自動再計算を待っています。`);
    if(savedRow) markRatingPendingForRow(savedRow);
    showSaveToast(`GitHub台帳へ登録完了：${team1} ${s1}-${s2} ${team2} / Rating再計算中`);
  }catch(err){
    alert(`試合は画面に追加しましたがGitHub保存に失敗しました。\n${err.message||err}`);
  }
}


let ledgerEditInitialSignature="";
let ledgerEditDirty=false;

function ledgerEditDraft(){
  const level=document.getElementById("editMatchLevel")?.value||"";
  const rawNote=document.getElementById("editMatchNote")?.value.trim()||"";
  const note=setNoteLevel(rawNote,level);
  const type1=document.getElementById("editMatchType1")?.value||"school";
  const type2=document.getElementById("editMatchType2")?.value||"school";
  return {
    year:document.getElementById("editMatchYear")?.value.trim()||"",
    season:document.getElementById("editMatchSeason")?.value.trim()||"",
    level,
    region:normalizeRegionName(document.getElementById("editMatchRegion")?.value),
    prefecture:document.getElementById("editMatchPref")?.value.trim()||"",
    date:document.getElementById("editMatchDate")?.value||"",
    tournament:document.getElementById("editMatchTournament")?.value.trim()||"",
    round:document.getElementById("editMatchRound")?.value.trim()||"",
    innings:Number(document.getElementById("editMatchInnings")?.value)||"",
    finish_type:document.getElementById("editMatchFinish")?.value||"normal",
    team1:document.getElementById("editMatchTeam1")?.value.trim()||"",
    score1:Number(document.getElementById("editMatchScore1")?.value),
    team1_canonical:document.getElementById("editMatchCanonical1")?.value.trim()||"",
    team1_type:type1,
    team1_union_id:type1==="union"?(document.getElementById("editMatchUnion1")?.value||""):"",
    team2:document.getElementById("editMatchTeam2")?.value.trim()||"",
    score2:Number(document.getElementById("editMatchScore2")?.value),
    team2_canonical:document.getElementById("editMatchCanonical2")?.value.trim()||"",
    team2_type:type2,
    team2_union_id:type2==="union"?(document.getElementById("editMatchUnion2")?.value||""):"",
    source_url:document.getElementById("editMatchSourceUrl")?.value.trim()||"",
    note
  };
}
function ledgerEditSignature(){
  return JSON.stringify(ledgerEditDraft());
}
function refreshLedgerEditDirty(){
  const btn=document.getElementById("saveLedgerEditBtn");
  if(!btn)return;
  ledgerEditDirty=Boolean(activeLedgerEditRow) && ledgerEditSignature()!==ledgerEditInitialSignature;
  btn.disabled=!ledgerEditDirty;
  btn.textContent=ledgerEditDirty?"変更を保存":"変更なし";
  btn.classList.toggle("is-dirty",ledgerEditDirty);
}
function wireLedgerEditDirtyTracking(){
  const form=document.querySelector("#ledgerEditModal .ledger-edit-form");
  if(!form||form.dataset.dirtyWired)return;
  form.dataset.dirtyWired="1";
  form.addEventListener("input",refreshLedgerEditDirty);
  form.addEventListener("change",refreshLedgerEditDirty);
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
  refreshUnionSelects(r.team1_union_id||"",r.team2_union_id||"");
  const type1=document.getElementById("editMatchType1"),type2=document.getElementById("editMatchType2");
  if(type1)type1.value=(r.team1_type==="union"||r.team1_union_id)?"union":"school";
  if(type2)type2.value=(r.team2_type==="union"||r.team2_union_id)?"union":"school";
  wireLedgerEditDirtyTracking();
  ledgerEditInitialSignature=ledgerEditSignature();
  ledgerEditDirty=false;
  refreshLedgerEditDirty();
  document.getElementById("ledgerEditModal")?.classList.remove("hidden");
}
function closeLedgerEdit(force=false){
  if(!force && ledgerEditDirty && !confirm("変更内容が保存されていません。編集を閉じますか？")) return;
  document.getElementById("ledgerEditModal")?.classList.add("hidden");
  activeLedgerEditRow=null;
  ledgerEditInitialSignature="";
  ledgerEditDirty=false;
}

async function saveLedgerEdit(){
  const r=activeLedgerEditRow;if(!r||!ledgerEditDirty)return;
  const key=matchEditKey(r),draft=ledgerEditDraft();
  const {level,team1_canonical,team2_canonical,...changes}=draft;
  const isManual=Boolean(r.manual_id)||(matchEditsState.manual_matches||[]).some(x=>String(x.manual_id||"")===key);
  if(isManual)updateManualMatchById(r.manual_id||key,{...changes,level});else upsertMatchOverride(key,changes);
  const c1=schoolRecordByNameOrId(team1_canonical),c2=schoolRecordByNameOrId(team2_canonical);
  if(c1)upsertMatchTeamLink(key,"team1",c1);if(c2)upsertMatchTeamLink(key,"team2",c2);
  Object.assign(r,changes,{level,region:normalizeRegionName(changes.region),edit_key:key,match_id:matchAuthorityId(r),team1_school_id:c1?.school_id||r.team1_school_id||"",team1_canonical:c1?.canonical_name||r.team1_canonical||"",team2_school_id:c2?.school_id||r.team2_school_id||"",team2_canonical:c2?.canonical_name||r.team2_canonical||""});
  appendMatchAuthorityOp("UPDATE",r,{...changes,level});
  ledgerEditDirty=false;closeLedgerEdit(true);buildFastIndexes();renderLedger();persistPendingMatchEdits();
  const verifyLinks=[];if(c1)verifyLinks.push(teamLinkVerification(key,"team1",c1));if(c2)verifyLinks.push(teamLinkVerification(key,"team2",c2));
  try{
    await saveMatchEditsImmediately(`Edit match ledger: ${changes.team1} ${changes.score1}-${changes.score2} ${changes.team2}`,[],isManual?[r.manual_id||key]:[],verifyLinks);
    markRatingPendingForRow(r);
    showSaveToast("対戦台帳を保存・照合しました / Rating再計算待ち");
  }catch(err){
    alert(`編集内容は端末に保持していますがGitHub保存に失敗しました。\n${err.message||err}`);
  }
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


function ledgerTeamPrimaryName(r,side){
  if(String(r?.[`${side}_type`]||"")==="union" || r?.[`${side}_union_id`]){
    return unionDisplayNameForRow(r,side);
  }
  return effectiveMatchSchoolName(r,side) || String(r?.[side]||"");
}

function ledgerIdentityNote(r,side){
  const stale=staleCrossPrefLinkForRow(r,side);
  if(stale){
    return `<div class="ledger-identity-note stale" title="旧誤紐づけ ${esc(stale.targetPref)} を無効化。この試合は ${esc(stale.rowPref)}">
      誤紐づけ無効：${esc(stale.targetPref)}→${esc(stale.rowPref)}
    </div>`;
  }

  const raw=String(r?.[side]||"").trim();
  const eff=effectiveMatchSchool(r,side);
  const shown=eff?.canonical||raw;
  if(!raw || shown===raw) return "";

  const label=eff.source==="match"?"試合別":eff.source==="geo"?"県判定":"別名";
  return `<div class="ledger-identity-note" title="${esc(label)}：元表記 ${raw} → ${shown}">
    ${esc(label)}：${esc(raw)}→${esc(shown)}
  </div>`;
}

function ledgerSchoolQueryCandidateIds(query,pref){
  const q=String(query||"").trim().toLowerCase();
  const p=normalizePrefectureName(pref)||"";
  if(!q) return new Set();

  const hits=[...schoolMaster.values()].filter(x=>{
    if((x.status||"active")==="merged" || x.kind==="union") return false;
    if(p && normalizePrefectureName(x.prefecture)!==p) return false;
    const names=[String(x.canonical_name||""),...(x.aliases||[])].map(v=>v.trim().toLowerCase()).filter(Boolean);
    return names.some(n=>n===q);
  });

  return new Set(hits.map(x=>String(x.school_id||"")).filter(Boolean));
}
function renderLedger(){
  const tbody = document.querySelector("#ledgerTable tbody");
  if(!tbody) return;
  const year=selected("ledgerYear"), region=selected("ledgerRegion"), pref=selected("ledgerPref");
  if(!ledgerDataLoaded){
    document.getElementById("ledgerCount").textContent="年代＋地区/県を指定";
    document.getElementById("ledgerSourceSummary").innerHTML='<span class="source-stat">未読込</span>';
    tbody.innerHTML='<tr><td colspan="21"><div class="school-detail-empty">年代と地区または県を指定すると、その範囲だけ読み込みます。</div></td></tr>';
    return;
  }
  ensureManualMatchesInLedger();
  const filtered = filteredLedgerMatches();
  const allRows = sortLedgerRows(filtered);
  document.getElementById("ledgerCount").textContent = ledgerPreviewMode
    ? `高速表示 ${allRows.length.toLocaleString()}試合（最新分）`
    : `${allRows.length.toLocaleString()}試合`;

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

  let webCount=0, ledgerCount=0, missingCount=0;
  for(const r of filtered){
    const k=sourceKind(r);
    if(k==="web") webCount++;
    else if(k==="ledger") ledgerCount++;
    else missingCount++;
  }
  let latestDate="",undatedCount=0;
  for(const r of filtered){const d=normalizeDateValue(r.date);if(!d)undatedCount++;else if(d>latestDate)latestDate=d;}
  latestDate=latestDate||"―";
  document.getElementById("ledgerSourceSummary").innerHTML = `
    <span class="source-stat source-web">Web URLあり ${webCount.toLocaleString()}</span>
    <span class="source-stat source-ledger">元帳あり・URL未登録 ${ledgerCount.toLocaleString()}</span>
    <span class="source-stat source-missing">未登録 ${missingCount.toLocaleString()}</span>
    <span class="source-stat">最新試合日 ${esc(latestDate)}</span>
    <span class="source-stat ${undatedCount?"source-missing":""}">日付未確定 ${undatedCount.toLocaleString()}</span>
  `;

  tbody.innerHTML = rows.map(r=>{
    const ev = ratingEventForMatch(r);
    const sev1=schoolRatingEventForMatchSide(r,"team1"), sev2=schoolRatingEventForMatchSide(r,"team2");
    const before1=sev1?Number(sev1.rating_before):Number(ev?.team1_rating_before), before2=sev2?Number(sev2.rating_before):Number(ev?.team2_rating_before);
    const delta1=sev1?Number(sev1.rating_delta):Number(ev?.team1_delta), delta2=sev2?Number(sev2.rating_delta):Number(ev?.team2_delta);
    const after1=sev1?Number(sev1.rating_after):Number(ev?.team1_rating_after), after2=sev2?Number(sev2.rating_after):Number(ev?.team2_rating_after);
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
    const rowKey=matchEditKey(r);
    const selectionKey=ledgerSelectionKey(r);
    const checked=ledgerSelectedKeys.has(selectionKey)?" checked":"";
    return `<tr class="ledger-click-row" data-ledger-row-key="${esc(rowKey)}" tabindex="0" role="button" aria-label="${esc(ledgerTeamPrimaryName(r,"team1"))} 対 ${esc(ledgerTeamPrimaryName(r,"team2"))} を編集">
      <td class="ledger-select-cell"><input type="checkbox" class="ledger-row-select" data-ledger-select-key="${esc(selectionKey)}"${checked} aria-label="この試合を選択"></td>
      <td>${esc(r.year)}</td>
      <td>${esc(seasonLabel(r.season))}</td>
      <td>${esc(levelLabel(r.level))}</td>
      <td>${esc(district)}</td>
      <td>${esc(prefs)} ${ledgerPrefTagWarning(r)}</td>
      <td>${esc(r.sub_area||"")}</td>
      <td>${esc(r.date||"")}</td>
      <td>${esc(r.tournament||"")}</td>
      <td>${esc(r.round||"")}</td>
      <td>${inningBadge(r)}</td>
      <td class="ledger-team-cell">${teamNameWithColors(ledgerTeamPrimaryName(r,"team1"),"ledger-team-name")} ${unionBadgeForRow(r,"team1")} ${inlineUnionControl(r,"team1")}
        ${(String(r.team1_type||"")==="union"||r.team1_union_id)?"":ledgerLinkButton(r,"team1")}
        ${ledgerIdentityNote(r,"team1")}</td>
      <td class="ledger-score-cell">${r.score1}</td>
      <td class="ledger-team-cell">${teamNameWithColors(ledgerTeamPrimaryName(r,"team2"),"ledger-team-name")} ${unionBadgeForRow(r,"team2")} ${inlineUnionControl(r,"team2")}
        ${(String(r.team2_type||"")==="union"||r.team2_union_id)?"":ledgerLinkButton(r,"team2")}
        ${ledgerIdentityNote(r,"team2")}</td>
      <td class="ledger-score-cell">${r.score2}</td>
      <td>${ev ? `${fmtR(before1)}<div class="school-meta">${fmtR(before2)}</div>` : (isRatingPendingForRow(r)?'<span class="rating-pending">再計算待ち</span>':"-")}</td>
      <td>${ev ? `${(Number(ev.team1_expected)*100).toFixed(1)}%<div class="school-meta">${(Number(ev.team2_expected)*100).toFixed(1)}%</div>` : (isRatingPendingForRow(r)?'<span class="rating-pending">待機中</span>':"-")}</td>
      <td>${ev ? `<button type="button" class="rating-index-button" data-rating-detail-key="${esc(matchEditKey(r))}" title="指数の計算根拠を拡大表示">
        <span class="rating-index-main">${Number(ev.round_weight||1).toFixed(2)}</span>
        <span class="school-meta rating-index-detail">
          T${Number(ev.tournament_size_weight||1).toFixed(2)}
          × L${Number(ev.level_weight||1).toFixed(2)}
          × S${Number(ev.season_weight||1).toFixed(2)}
          × R${Number(ev.round_weight||1).toFixed(2)}
          × W${Number(ev.win_count_weight||1).toFixed(2)}
          × D${Number(ev.mov_multiplier||1).toFixed(2)}
          × I${Number(ev.inning_multiplier||1).toFixed(2)}
        </span>
      </button>` : (isRatingPendingForRow(r)?'<span class="rating-pending">待機中</span>':"-")}</td>
      <td>${ev ? `<span class="${delta1>=0?"rating-up":"rating-down"}">${fmtDelta(delta1)}</span><div class="school-meta ${delta2>=0?"rating-up":"rating-down"}">${fmtDelta(delta2)}</div>` : (isRatingPendingForRow(r)?'<span class="rating-pending">待機中</span>':"-")}</td>
      <td>${ev ? `${fmtR(after1)}<div class="school-meta">${fmtR(after2)}</div>` : (isRatingPendingForRow(r)?'<span class="rating-pending">待機中</span>':"-")}</td>
      <td>${source}</td>
    </tr>`;
  }).join("");


  const ledgerPageCheckboxes=[...tbody.querySelectorAll("[data-ledger-select-key]")];
  ledgerPageCheckboxes.forEach((cb,index)=>{
    cb.addEventListener("click",e=>{
      e.stopPropagation();
      if(e.shiftKey && ledgerLastRangeIndex!==null){
        const a=Math.min(index,ledgerLastRangeIndex), b=Math.max(index,ledgerLastRangeIndex);
        const makeChecked=cb.checked;
        for(let i=a;i<=b;i++){
          const x=ledgerPageCheckboxes[i];
          x.checked=makeChecked;
          const k=x.dataset.ledgerSelectKey;
          if(makeChecked) ledgerSelectedKeys.add(k); else ledgerSelectedKeys.delete(k);
        }
      }else{
        const key=cb.dataset.ledgerSelectKey;
        if(cb.checked) ledgerSelectedKeys.add(key); else ledgerSelectedKeys.delete(key);
      }
      ledgerLastRangeIndex=index;
      updateLedgerBulkBar();
    });
  });
  updateLedgerBulkBar();

  tbody.querySelectorAll("[data-rating-detail-key]").forEach(btn=>{
    btn.addEventListener("click",(e)=>{
      e.preventDefault(); e.stopPropagation();
      const key=btn.dataset.ratingDetailKey;
      const row=ledgerMatches.find(x=>matchEditKey(x)===key) || allMatches.find(x=>matchEditKey(x)===key);
      if(row) openRatingFormula(row);
    });
  });

  const openRowEdit=(tr)=>{
    const key=tr?.dataset?.ledgerRowKey;
    if(!key)return;
    const row=ledgerMatches.find(x=>matchEditKey(x)===key) || allMatches.find(x=>matchEditKey(x)===key);
    if(row)openLedgerEdit(row);
  };
  tbody.querySelectorAll("[data-ledger-row-key]").forEach(tr=>{
    tr.addEventListener("click",e=>{
      // Buttons, links, inputs, selects, labels and inline controls keep their own action.
      if(e.target.closest("a,button,input,select,textarea,label,[data-rating-detail-key],[data-inline-union-key],[data-ledger-link-key]")) return;
      openRowEdit(tr);
    });
    tr.addEventListener("keydown",e=>{
      if((e.key==="Enter"||e.key===" ") && !e.target.closest("a,button,input,select,textarea,label")){
        e.preventDefault();openRowEdit(tr);
      }
    });
  });

  tbody.querySelectorAll("[data-inline-union-key]").forEach(cb=>{
    cb.addEventListener("change",async(e)=>{
      e.stopPropagation();
      const key=cb.dataset.inlineUnionKey;
      const side=cb.dataset.inlineUnionSide;
      const row=ledgerMatches.find(x=>matchEditKey(x)===key);
      if(!row) return;
      cb.disabled=true;
      try{ await setInlineUnionState(row,side,cb.checked); }
      catch(err){ console.error(err); alert(`連合設定に失敗しました\n${err.message||err}`); renderLedger(); }
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


function ratingAxisLabel(ev){
  return {
    T:"大会規模",
    L:"階層",
    S:"季節",
    R:"大会固有ラウンド",
    W:"大会内勝利数",
    D:"得失点差",
    I:"イニング"
  };
}

function ratingRoundReason(ev){
  const rule=String(ev?.round_rule||"");
  if(rule==="national_match_count"){
    return `全国大会：大会内 ${ev.national_match_no||"-"} / ${ev.national_match_total||"-"} 試合目。後ろから ${ev.national_from_end||"-"} 試合目として終盤段階を判定。`;
  }
  if(rule.startsWith("autumn_region:")){
    return `秋季地区大会：${rule.split(":")[1]||""}の選抜枠特性を反映。`;
  }
  if(rule==="prefecture_summer") return "夏県大会：甲子園出場決定に近い終盤ほど重く評価。";
  if(rule==="prefecture_autumn") return "秋県大会：秋の代表争いを反映。3位決定・代表決定は1.20。";
  if(rule==="prefecture_spring") return "春県大会の終盤補正。";
  if(rule==="regional") return "地区大会の一般終盤補正。";
  return "通常ラウンド補正。";
}

function ratingLevelReason(ev){
  const level=String(ev?.level||"");
  const map={
    branch:"地区・地域予選",
    district_qualifier:"地区・地域予選",
    first_qualifier:"一次予選",
    preliminary:"予備予選",
    qualifier_league:"予選リーグ",
    repechage:"敗者復活",
    prefecture:"県大会本戦・支庁戦",
    regional:"9地区大会",
    national:"全国大会"
  };
  return map[level]||level||"未設定";
}

function ratingSeasonReason(ev){
  const s=String(ev?.season||"");
  const map={
    spring:"春",summer:"夏",autumn:"秋",
    senbatsu:"選抜→春扱い",koshien:"選手権→夏扱い",jingu:"神宮→秋扱い"
  };
  return map[s]||s||"未設定";
}

function openRatingFormula(row){
  const ev=ratingEventForMatch(row);
  if(!ev) return;
  const modal=document.getElementById("ratingFormulaModal");
  const meta=document.getElementById("ratingFormulaMeta");
  const body=document.getElementById("ratingFormulaBody");
  if(!modal||!meta||!body) return;

  const T=Number(ev.tournament_size_weight||1);
  const L=Number(ev.level_weight||1);
  const S=Number(ev.season_weight||1);
  const R=Number(ev.round_weight||1);
  const W=Number(ev.win_count_weight||1);
  const D=Number(ev.mov_multiplier||1);
  const I=Number(ev.inning_multiplier||1);
  const k=Number(ev.k||0);
  const product=T*L*S*R*W*D*I;
  const expected1=Number(ev.team1_expected||0);
  const scoreA=Number(row.score1)>Number(row.score2)?1:Number(row.score1)<Number(row.score2)?0:0.5;
  const calcDelta=k*(scoreA-expected1);

  meta.textContent=`${row.date||""} ${row.team1} ${row.score1}-${row.score2} ${row.team2}`;

  const axis=(code,label,value,reason)=>`
    <div class="formula-axis-row">
      <div class="formula-code">${code}</div>
      <div>
        <strong>${label}</strong>
        <div class="formula-reason">${reason}</div>
      </div>
      <div class="formula-value">${Number(value).toFixed(4)}</div>
    </div>`;

  body.innerHTML=`
    <div class="formula-main">
      <div class="formula-title">実効K</div>
      <div class="formula-equation">
        20 × ${T.toFixed(2)} × ${L.toFixed(2)} × ${S.toFixed(2)} × ${R.toFixed(2)}
        × ${W.toFixed(2)} × ${D.toFixed(2)} × ${I.toFixed(2)}
        = <strong>${k.toFixed(4)}</strong>
      </div>
      <div class="formula-sub">係数積 ${product.toFixed(6)} × 基礎K20</div>
    </div>

    <div class="formula-axis-list">
      ${axis("T","大会規模",T,`参加校 ${ev.tournament_team_count||"-"}校 → ${ev.tournament_level||"-"}校級として判定。`)}
      ${axis("L","階層",L,`${ratingLevelReason(ev)}。`)}
      ${axis("S","季節",S,`${ratingSeasonReason(ev)}。春0.95 / 夏1.15 / 秋1.00。`)}
      ${axis("R","大会固有ラウンド",R,ratingRoundReason(ev))}
      ${axis("W","大会内勝利数",W,`次の勝利は ${row.team1}: ${ev.team1_next_win||"-"}勝目、${row.team2}: ${ev.team2_next_win||"-"}勝目。両校係数の幾何平均。`)}
      ${axis("D","得失点差",D,`スコア差 ${Math.abs(Number(row.score1)-Number(row.score2))} 点から算出。上限1.55。`)}
      ${axis("I","イニング",I,`${ev.innings||9}回 / ${ev.finish_type||"normal"}。通常9回=1.00、コールドは加算、延長は減算。`)}
    </div>

    <div class="formula-result-grid">
      <div><span>試合前R</span><strong>${Number(ev.team1_rating_before||0).toFixed(1)} / ${Number(ev.team2_rating_before||0).toFixed(1)}</strong></div>
      <div><span>期待勝率</span><strong>${(expected1*100).toFixed(1)}% / ${((1-expected1)*100).toFixed(1)}%</strong></div>
      <div><span>県Rating補正</span><strong>${Number(ev.pref_strength_component1||0)>=0?"+":""}${Number(ev.pref_strength_component1||0).toFixed(1)} / ${Number(ev.pref_strength_component2||0)>=0?"+":""}${Number(ev.pref_strength_component2||0).toFixed(1)}</strong></div>
      <div><span>県相性補正</span><strong>${Number(ev.matchup_component1||0)>=0?"+":""}${Number(ev.matchup_component1||0).toFixed(1)} / ${Number(ev.matchup_component2||0)>=0?"+":""}${Number(ev.matchup_component2||0).toFixed(1)}</strong></div>
      <div><span>学校相性（過去3戦以上）</span><strong>${Number(ev.school_matchup_bias_prob||0)>=0?"+":""}${(Number(ev.school_matchup_bias_prob||0)*100).toFixed(2)}pt <small>${Number(ev.school_matchup_prior_games||0)}戦</small></strong></div>
      <div><span>結果値</span><strong>${scoreA.toFixed(1)} / ${(1-scoreA).toFixed(1)}</strong></div>
      <div><span>Rating変動</span><strong>${Number(ev.team1_delta||calcDelta).toFixed(2)} / ${Number(ev.team2_delta||-calcDelta).toFixed(2)}</strong></div>
    </div>

    <div class="formula-delta">
      ΔR = 実効K × (結果 − 期待値)<br>
      ${k.toFixed(4)} × (${scoreA.toFixed(1)} − ${expected1.toFixed(6)})
      = <strong>${calcDelta>=0?"+":""}${calcDelta.toFixed(4)}</strong>
    </div>
  `;
  modal.classList.remove("hidden");
}

function closeRatingFormula(){
  document.getElementById("ratingFormulaModal")?.classList.add("hidden");
}

function masterRecordForMatchSide(row,side){
  const eff=effectiveMatchSchool(row,side);
  if(eff.school_id && schoolByIdMap.has(String(eff.school_id))) return schoolByIdMap.get(String(eff.school_id));
  return schoolMaster.get(eff.canonical)||null;
}

function prefectureRepairCandidates(){
  const source=ledgerMatches.length?ledgerMatches:allMatches;
  const out=[];
  for(const r of source){
    const scope=ledgerScope(r.level);
    if(scope!=="prefecture" && scope!=="subpref") continue;

    const a=masterRecordForMatchSide(r,"team1");
    const b=masterRecordForMatchSide(r,"team2");
    const pa=normalizePrefectureName(a?.prefecture||"");
    const pb=normalizePrefectureName(b?.prefecture||"");
    const current=normalizePrefectureName(r.prefecture||"");

    // 県内階層で両校の学校マスタ所属県が一致するなら、
    // それを強い根拠としてrow.prefectureのタグ揺れを補正する。
    if(!pa||!pb||pa==="不明"||pb==="不明"||pa!==pb) continue;
    if(current===pa) continue;

    out.push({
      key:matchEditKey(r),
      row:r,
      current:current||"(空欄)",
      suggested:pa,
      scope,
      reason:`両校所属=${pa}`,
      region:DISTRICT_TO_REGION[PREF_TO_DISTRICT[pa]||""] || r.region || ""
    });
  }
  return out;
}

function renderPrefRepair(){
  const body=document.getElementById("prefRepairBody");
  const summary=document.getElementById("prefRepairSummary");
  if(!body) return;
  const rows=prefectureRepairCandidates();
  if(summary) summary.textContent=`県大会・県以下のタグ揺れ候補 ${rows.length}試合`;
  if(!rows.length){
    body.innerHTML=`<div class="school-detail-empty">自動判定できる県タグ不一致はありません。</div>`;
    return;
  }

  const groups=new Map();
  for(const x of rows){
    const k=`${x.current} → ${x.suggested}`;
    groups.set(k,(groups.get(k)||0)+1);
  }
  const chips=[...groups.entries()].sort((a,b)=>b[1]-a[1]).map(([k,n])=>`<span class="pref-repair-chip">${esc(k)} <strong>${n}</strong></span>`).join("");

  body.innerHTML=`
    <div class="pref-repair-groups">${chips}</div>
    <div class="pref-repair-list">
      ${rows.map((x,i)=>`
        <label class="pref-repair-row">
          <input type="checkbox" data-pref-repair-key="${esc(x.key)}" checked>
          <span class="pref-repair-date">${esc(x.row.year||"")} ${esc(x.row.date||"")}</span>
          <span class="pref-repair-match"><strong>${esc(x.row.team1)}</strong> ${esc(x.row.score1)}-${esc(x.row.score2)} <strong>${esc(x.row.team2)}</strong></span>
          <span class="pref-repair-change">${esc(x.current)} → <strong>${esc(x.suggested)}</strong></span>
          <span class="pref-repair-tournament">${esc(x.row.tournament||"")}<small class="pref-repair-reason">${esc(x.reason||"")}</small></span>
        </label>
      `).join("")}
    </div>`;
}

function openPrefRepair(){
  renderPrefRepair();
  document.getElementById("prefRepairModal")?.classList.remove("hidden");
}

function closePrefRepair(){
  document.getElementById("prefRepairModal")?.classList.add("hidden");
}

async function applyPrefRepair(){
  const checked=[...document.querySelectorAll("[data-pref-repair-key]:checked")];
  if(!checked.length){ alert("補正する試合を選択してください。"); return; }
  const all=new Map(prefectureRepairCandidates().map(x=>[x.key,x]));
  const targets=checked.map(cb=>all.get(cb.dataset.prefRepairKey)).filter(Boolean);
  if(!targets.length) return;
  if(!confirm(`${targets.length}試合の県タグを補正します。\n県大会・県以下で両校の学校マスタ所属県が一致する場合、その県を正として台帳タグを直します。よろしいですか？`)) return;

  const btn=document.getElementById("applyPrefRepairBtn");
  if(btn){btn.disabled=true;btn.textContent="保存中…";}
  try{
    for(const x of targets){
      upsertMatchOverride(x.key,{prefecture:x.suggested,region:x.region});
      for(const arr of [ledgerMatches,allMatches]){
        const row=arr.find(r=>matchEditKey(r)===x.key);
        if(row){
          row.prefecture=x.suggested;
          if(x.region) row.region=x.region;
        }
      }
    }
    await pushMatchEditsShared(`Bulk fix prefecture tags: ${targets.length} matches`);
    buildFastIndexes();
    refillSelectPreserve("ledgerPref",sortPrefectureNames(ledgerMatches.flatMap(ledgerPrefValues)));
    refillSelectPreserve("ledgerRegion",uniq(ledgerMatches.map(x=>x.region)));
    renderLedger();
    renderPrefRepair();
    showSaveToast(`${targets.length}試合の県タグを補正しました`);
  }catch(err){
    console.error(err);
    alert(`県タグ補正の保存に失敗しました\n${err.message}`);
  }finally{
    if(btn){btn.disabled=false;btn.textContent="チェックした候補を一括補正";}
  }
}

function ledgerBulkFieldPrompt(){
  const fields=[
    ["year","年度"],["season","季節"],["level","大会階層（level）"],["region","地区"],
    ["prefecture","都道府県"],["sub_area","県以下"],["date","試合日"],["tournament","大会名"],
    ["round","回戦"],["team1","チーム1"],["score1","チーム1得点"],
    ["team2","チーム2"],["score2","チーム2得点"],["source_url","出典URL"]
  ];
  const levels=[
    ["branch","支部大会（0.55）"],["district_qualifier","地区予選（0.55）"],
    ["first_qualifier","一次予選（0.55）"],["preliminary","予備予選（0.55）"],
    ["qualifier_league","予選リーグ（0.50）"],["repechage","敗者復活戦（0.50）"],
    ["prefecture","都道府県大会（0.85）"],["regional","地区大会・北信越など（1.15）"],
    ["national","全国大会・甲子園など（1.35）"]
  ];
  return new Promise(resolve=>{
    const shade=document.createElement("div");
    shade.style.cssText="position:fixed;inset:0;background:rgba(0,0,0,.66);z-index:99999;display:flex;align-items:center;justify-content:center;padding:16px";
    const panel=document.createElement("div");
    panel.setAttribute("role","dialog");panel.setAttribute("aria-modal","true");panel.setAttribute("aria-label","対戦台帳の一括変更");
    panel.style.cssText="background:var(--card,#20252c);color:var(--text,#fff);border:1px solid #73808d;border-radius:14px;padding:22px;width:min(440px,100%);box-shadow:0 14px 50px #0008;display:grid;gap:12px";
    const title=document.createElement("strong");title.textContent="対戦台帳・一括変更";panel.appendChild(title);
    const fieldLabel=document.createElement("label");fieldLabel.textContent="変更する項目";
    const field=document.createElement("select");
    for(const [code,label] of fields){const opt=new Option(label,code);field.add(opt);}
    field.value="level";fieldLabel.appendChild(field);panel.appendChild(fieldLabel);
    const valueLabel=document.createElement("label");valueLabel.textContent="変更後の値";
    const levelSelect=document.createElement("select");
    for(const [code,label] of levels)levelSelect.add(new Option(label,code));
    levelSelect.value="prefecture";
    const textInput=document.createElement("input");textInput.type="text";textInput.placeholder="変更後の値を入力";
    const hint=document.createElement("small");hint.textContent="日本語で選択できます。保存は従来の英字コードで行います。";
    for(const el of [field,levelSelect,textInput]){el.style.cssText="display:block;box-sizing:border-box;width:100%;padding:10px;border-radius:7px;margin-top:6px;background:var(--input-bg,#fff);color:var(--input-text,#111)";}
    valueLabel.append(levelSelect,textInput);panel.append(valueLabel,hint);
    const buttons=document.createElement("div");buttons.style.cssText="display:flex;gap:10px;justify-content:flex-end";
    const cancel=document.createElement("button");cancel.type="button";cancel.textContent="キャンセル";
    const ok=document.createElement("button");ok.type="button";ok.textContent="変更内容を確認";ok.className="save-btn";
    buttons.append(cancel,ok);panel.append(buttons);shade.append(panel);document.body.append(shade);
    function refresh(){const level=field.value==="level";levelSelect.hidden=!level;textInput.hidden=level;hint.hidden=!level;}
    function done(v){document.removeEventListener("keydown",onKey);shade.remove();resolve(v);}
    function onKey(e){if(e.key==="Escape")done(null);}
    field.addEventListener("change",refresh);
    cancel.addEventListener("click",()=>done(null));
    shade.addEventListener("click",e=>{if(e.target===shade)done(null);});
    ok.addEventListener("click",()=>done({field:field.value,value:field.value==="level"?levelSelect.value:textInput.value}));
    document.addEventListener("keydown",onKey);
    refresh();field.focus();
  });
}

async function bulkEditLedgerMatches(){
  const rows=ledgerSelectedRows();
  if(!rows.length){alert("試合を選択してください。");return;}
  const x=await ledgerBulkFieldPrompt(); if(!x)return;
  if(!confirm(`${rows.length}試合の ${x.field} を「${x.value}」へ一括変更しますか？`)) return;
  const verify=[]; const manual=[];
  // One pass over each ledger instead of O(selected matches × entire ledger).
  const buildIndex=arr=>{
    const map=new Map();
    for(const item of arr){const k=matchEditKey(item);if(!map.has(k))map.set(k,[]);map.get(k).push(item);}
    return map;
  };
  const bulkLedgerIndex=buildIndex(ledgerMatches);
  const bulkAllIndex=buildIndex(allMatches);
  for(const r of rows){
    const key=matchEditKey(r);
    let value=x.value;
    if(x.field==="score1"||x.field==="score2") value=Number(value);
    const changes={[x.field]:value};
    if(x.field==="level") changes.note=setNoteLevel(r.note||"",String(value));
    if(r.manual_id){ updateManualMatchById(r.manual_id,changes); manual.push(r.manual_id); }
    else { upsertMatchOverride(key,changes); verify.push({edit_key:key,changes}); }
    // Apply locally via prebuilt edit-key indices, not a full-table scan per selected match.
    for(const index of [bulkLedgerIndex,bulkAllIndex]){
      for(const target of index.get(key)||[])Object.assign(target,changes);
    }
  }
  markIdentityIndexesDirty(); renderLedger(); persistPendingMatchEdits();
  try{
    await saveMatchEditsImmediately(`Bulk edit ${rows.length} matches: ${x.field}`,verify,manual);
    showSaveToast(`${rows.length}試合を一括変更・保存しました / Rating再計算待ち`);
    markRatingPendingRows(rows);
  }catch(err){alert(`一括変更は画面に反映しましたがGitHub保存に失敗しました。\n${err.message||err}`);}
}

async function bulkDuplicateLedgerMatches(){
  const rows=ledgerSelectedRows();
  if(!rows.length){alert("複製する試合を選択してください。");return;}
  const raw=prompt("各試合を何件ずつ複製しますか？", "1");
  if(raw===null)return;
  const copies=Math.max(1,Math.min(50,Number(raw)||1));
  if(!confirm(`${rows.length}試合 × ${copies}件 = ${rows.length*copies}件を手入力試合として複製しますか？`))return;
  const ids=[]; const now=Date.now(); let seq=0;
  for(const r of rows){
    for(let i=0;i<copies;i++){
      const id=`MAN-${now}-${++seq}`;
      const clone={...r,manual_id:id,edit_key:id,match_id:id,_id:undefined,updated_at:new Date().toISOString(),note:[setNoteLevel(r.note||"",r.level||"prefecture"),"manual=1","duplicated=1"].filter(Boolean).join(";")};
      matchEditsState.manual_matches.push(clone); appendMatchAuthorityOp("ADD",clone,clone); ids.push(id);
    }
  }
  ensureManualMatchesInLedger();
  ledgerSelectedKeys=new Set(ids); ledgerLastManualKeys=new Set(ids);
  resetLedgerFiltersForManual(); buildFastIndexes(); renderLedger(); persistPendingMatchEdits();
  try{
    await saveMatchEditsImmediately(`Bulk duplicate ${ids.length} matches`,[],ids);
    showSaveToast(`${ids.length}試合を複製・保存しました`);
  }catch(err){alert(`複製は画面に反映しましたがGitHub保存に失敗しました。\n${err.message||err}`);}
}

async function bulkDeleteLedgerMatches(){
  const rows=ledgerSelectedRows();
  if(!rows.length){alert("削除する試合を選択してください。");return;}

  // Destructive safety: always surface the exact tournament set before delete.
  const tournamentCounts=new Map();
  for(const r of rows){
    const name=String(r.tournament||"").trim()||"（大会名なし）";
    tournamentCounts.set(name,(tournamentCounts.get(name)||0)+1);
  }
  const tournamentLines=[...tournamentCounts.entries()].map(([name,count])=>`${name}: ${count}試合`);
  if(tournamentCounts.size>1){
    const proceed=confirm(
      `注意：削除対象に複数の大会名が混在しています。\n\n${tournamentLines.join("\n")}\n\nこのまま一括削除を続けますか？`
    );
    if(!proceed) return;
  }

  const ok=await confirmDangerAction({
    title:`${rows.length}試合を一括削除しますか？`,
    message:"チェックした試合だけを台帳から除外します。",
    details:`${tournamentLines.join("\n")}\n\nRating再計算にも反映されます。`,
    confirmText:`${rows.length}試合を削除`
  });
  if(!ok)return;
  const del=matchEditsState.deleted_matches||(matchEditsState.deleted_matches=[]);
  const now=new Date().toISOString();
  const keys=new Set(); const exactIds=new Set(); const manualIds=new Set();
  for(const r of rows){
    const key=matchEditKey(r);
    const mid=matchAuthorityId(r);
    keys.add(key); exactIds.add(mid);
    if(r.manual_id)manualIds.add(String(r.manual_id));
    const tomb={edit_key:key,match_id:mid,deleted_at:now,updated_at:now,team1:r.team1||"",team2:r.team2||"",year:r.year||"",tournament:r.tournament||""};
    const i=del.findIndex(x=>String(x.match_id||"")===mid || (!x.match_id && x.edit_key===key));
    if(i>=0)del[i]=tomb; else del.push(tomb);
    appendMatchAuthorityOp("DELETE",r,{});
  }
  matchEditsState.manual_matches=(matchEditsState.manual_matches||[]).filter(x=>!manualIds.has(String(x.manual_id||"")));
  allMatches=allMatches.filter(x=>!exactIds.has(matchAuthorityId(x)));
  ledgerMatches=ledgerMatches.filter(x=>!exactIds.has(matchAuthorityId(x)));
  matchEditsState=compactMatchEditsState(matchEditsState);
  purgeDeletedRowsFromMemory();
  ledgerSelectedKeys.clear(); buildFastIndexes(); renderLedger(); persistPendingMatchEdits();
  try{
    await saveMatchEditsImmediately(`Bulk delete ${rows.length} matches`,[],[],[],[...keys]);
    await pushMatchDeleteIndexToGitHub(`Refresh delete index after bulk delete ${rows.length}`);
    showSaveToast(`${rows.length}試合を一括削除・GitHub照合済み`);
  }catch(err){
    alert(`削除は画面に反映しましたが共有保存の完了に失敗しました。\n${err.message||err}`);
  }
}

function selectLedgerCurrentPage(){
  document.querySelectorAll("[data-ledger-select-key]").forEach(cb=>{cb.checked=true;ledgerSelectedKeys.add(cb.dataset.ledgerSelectKey);});
  updateLedgerBulkBar();
}
function selectLedgerAllFiltered(){
  for(const r of filteredLedgerMatches()) ledgerSelectedKeys.add(ledgerSelectionKey(r));
  renderLedger();
}
function clearLedgerSelection(){ledgerSelectedKeys.clear();ledgerLastRangeIndex=null;renderLedger();}

function ledgerStrictDuplicateSignature(r){
  const clean=v=>cleanSchoolNoiseName(v).replace(/[\s　]+/g,"").toLowerCase();
  const t1=clean(r.team1), t2=clean(r.team2);
  const s1=scoreKey(r.score1), s2=scoreKey(r.score2);
  // Team order can be reversed across sources, so canonicalize team+score pairs.
  const pair=[[t1,s1],[t2,s2]].sort((a,b)=>a[0].localeCompare(b[0],"ja"));
  const date=normalizeDateValue(r.date)||"";
  const tournament=String(r.tournament||"").replace(/[\s　]+/g,"").toLowerCase();
  const round=String(r.round||"").replace(/[\s　]+/g,"").toLowerCase();
  return [r.year||"",r.season||"",r.prefecture||"",date,tournament,round,pair[0][0],pair[0][1],pair[1][0],pair[1][1]].join("¦");
}

function selectLedgerStrictDuplicates(){
  // Fresh destructive selection: never carry checked rows from another page/filter.
  ledgerSelectedKeys.clear();
  const rows=filteredLedgerMatches();
  const groups=new Map();
  for(const r of rows){
    const sig=ledgerStrictDuplicateSignature(r);
    if(!groups.has(sig)) groups.set(sig,[]);
    groups.get(sig).push(r);
  }
  let duplicateGroups=0, selected=0;
  for(const group of groups.values()){
    if(group.length<2) continue;
    duplicateGroups++;
    // Keep one record. Prefer a manual record, then a record with Web URL, then first.
    const ranked=[...group].sort((a,b)=>{
      const av=(a.manual_id?4:0)+(a.source_url?2:0)+(a.source_ref?1:0);
      const bv=(b.manual_id?4:0)+(b.source_url?2:0)+(b.source_ref?1:0);
      return bv-av;
    });
    const keepKey=ledgerSelectionKey(ranked[0]);
    for(const r of group){
      const key=ledgerSelectionKey(r);
      if(key!==keepKey && !ledgerSelectedKeys.has(key)){ledgerSelectedKeys.add(key);selected++;}
    }
  }
  ledgerLastRangeIndex=null;
  renderLedger();
  if(!duplicateGroups){
    alert("現在の絞込結果には、日付・大会・回戦・対戦校・得点が一致する厳密重複は見つかりませんでした。");
  }else{
    showSaveToast(`厳密重複 ${duplicateGroups}組から、削除候補 ${selected}試合を選択しました`);
  }
}

function ledgerNearDuplicateSignature(r){
  const clean=v=>cleanSchoolNoiseName(v).replace(/[\s　]+/g,"").toLowerCase();
  const t1=clean(r.team1), t2=clean(r.team2);
  const s1=scoreKey(r.score1), s2=scoreKey(r.score2);
  const pair=[[t1,s1],[t2,s2]].sort((a,b)=>a[0].localeCompare(b[0],"ja"));
  const date=normalizeDateValue(r.date)||"";
  const pref=String(r.prefecture||"").trim();
  // Ignore tournament and round text here. Category-wide imports often create
  // the same game twice with slightly different tournament/round labels.
  return [r.year||"",r.season||"",pref,date,pair[0][0],pair[0][1],pair[1][0],pair[1][1]].join("¦");
}

function duplicateKeepScore(r){
  return (r.manual_id?16:0) + (r.source_url?8:0) + (r.source_ref?4:0) +
    (String(r.tournament||"").trim()?2:0) + (String(r.round||"").trim()?1:0);
}

function selectLedgerNearDuplicates(){
  // Fresh destructive selection: never carry checked rows from another page/filter.
  ledgerSelectedKeys.clear();
  const rows=filteredLedgerMatches();
  const groups=new Map();
  for(const r of rows){
    const sig=ledgerNearDuplicateSignature(r);
    if(!groups.has(sig)) groups.set(sig,[]);
    groups.get(sig).push(r);
  }
  let duplicateGroups=0, selected=0, ambiguous=0;
  for(const group of groups.values()){
    if(group.length<2) continue;

    // V66.1 safest cleanup rule:
    // when the same date/teams/score exists both with and without a tournament
    // name, only the blank-tournament rows are deletion candidates.
    const named=group.filter(r=>String(r.tournament||"").trim());
    const blank=group.filter(r=>!String(r.tournament||"").trim());
    if(named.length && blank.length){
      duplicateGroups++;
      for(const r of blank){
        const key=ledgerSelectionKey(r);
        if(!ledgerSelectedKeys.has(key)){ledgerSelectedKeys.add(key);selected++;}
      }
      continue;
    }

    // If all candidates have tournament names, different competitions can
    // legitimately share date/teams/score. Never auto-delete those.
    if(named.length===group.length){
      const tournaments=new Set(named.map(r=>String(r.tournament||"").replace(/[\s　]+/g,"").toLowerCase()));
      if(tournaments.size>1){ambiguous++;continue;}
    }

    // Same tournament (or all blank): keep the richer record.
    duplicateGroups++;
    const ranked=[...group].sort((a,b)=>
      duplicateKeepScore(b)-duplicateKeepScore(a) ||
      String(b.updated_at||"").localeCompare(String(a.updated_at||""))
    );
    const keepKey=ledgerSelectionKey(ranked[0]);
    for(const r of group){
      const key=ledgerSelectionKey(r);
      if(key!==keepKey && !ledgerSelectedKeys.has(key)){
        ledgerSelectedKeys.add(key);selected++;
      }
    }
  }
  ledgerLastRangeIndex=null;
  renderLedger();
  if(!duplicateGroups){
    alert(ambiguous
      ?"大会名が異なる候補は安全のため自動選択しませんでした。"
      :"現在の絞込結果には、日付・対戦校・得点が一致する実質重複は見つかりませんでした。");
  }else{
    showSaveToast(`実質重複 ${duplicateGroups}組から削除候補 ${selected}試合を選択${ambiguous?` / 判定保留 ${ambiguous}組`:""}`);
  }
}

function selectLedgerSameTournament(){
  const selectedRows=ledgerSelectedRows();
  if(!selectedRows.length){
    alert("基準にする試合を1件チェックしてください。");
    return;
  }
  const tournaments=[...new Set(selectedRows.map(r=>String(r.tournament||"").trim()).filter(Boolean))];
  if(!tournaments.length){
    alert("選択した試合に大会名がありません。");
    return;
  }
  if(tournaments.length!==1){
    alert(`基準の大会名が複数あります（${tournaments.length}大会）。\nいったん選択を解除して、残したい1大会の試合を1件だけチェックしてください。`);
    return;
  }
  const tournament=tournaments[0];

  // V66.3: this is REPLACE selection, not additive selection.
  // Old checked rows from another tournament/page must never survive into bulk delete.
  ledgerSelectedKeys.clear();

  let selected=0;
  for(const r of filteredLedgerMatches()){
    if(String(r.tournament||"").trim()!==tournament) continue;
    const key=ledgerSelectionKey(r);
    ledgerSelectedKeys.add(key);
    selected++;
  }
  ledgerLastRangeIndex=null;
  renderLedger();
  showSaveToast(`「${tournament}」だけを ${selected}試合 選択しました`);
}

function invertLedgerCurrentPageSelection(){
  document.querySelectorAll("[data-ledger-select-key]").forEach(cb=>{
    const key=cb.dataset.ledgerSelectKey;
    if(ledgerSelectedKeys.has(key)){ledgerSelectedKeys.delete(key);cb.checked=false;}
    else{ledgerSelectedKeys.add(key);cb.checked=true;}
  });
  ledgerLastRangeIndex=null;
  updateLedgerBulkBar();
}

async function deleteActiveLedgerMatch(){
  const r=activeLedgerEditRow;
  if(!r) return;
  const key=matchEditKey(r);
  const manualId=String(r.manual_id||"");
  const ok=await confirmDangerAction({
    title:"対戦台帳から試合を削除しますか？",
    message:`${r.team1} ${r.score1}-${r.score2} ${r.team2}`,
    details:`${r.year||""} ${seasonLabel(r.season||"")} / ${r.tournament||""} / ${r.round||""}\\nこの削除はRating再計算にも反映されます。元CSVにある試合は削除記録で除外します。`,
    confirmText:"この試合を削除"
  });
  if(!ok) return;

  const list=matchEditsState.deleted_matches||(matchEditsState.deleted_matches=[]);
  const i=list.findIndex(x=>x.edit_key===key);
  const tomb={
    edit_key:key,
    match_id:matchAuthorityId(r),
    deleted_at:new Date().toISOString(),
    updated_at:new Date().toISOString(),
    team1:r.team1||"",team2:r.team2||"",
    year:r.year||"",tournament:r.tournament||""
  };
  if(i>=0) list[i]=tomb; else list.push(tomb);
  appendMatchAuthorityOp("DELETE",r,{});

  if(manualId){
    matchEditsState.manual_matches=(matchEditsState.manual_matches||[]).filter(x=>String(x.manual_id||"")!==manualId);
  }
  matchEditsState.overrides=(matchEditsState.overrides||[]).filter(x=>x.edit_key!==key);
  matchEditsState.team_links=(matchEditsState.team_links||[]).filter(x=>x.edit_key!==key);

  const exactId=matchAuthorityId(r);
  allMatches=allMatches.filter(x=>matchAuthorityId(x)!==exactId);
  ledgerMatches=ledgerMatches.filter(x=>matchAuthorityId(x)!==exactId);
  // Also purge by saved DELETE snapshot, not only mutable edit_key.
  purgeDeletedRowsFromMemory();
  prefInterstateCache=null;
  markIdentityIndexesDirty();

  matchEditsState=compactMatchEditsState(matchEditsState);
  closeLedgerEdit();renderLedger();persistPendingMatchEdits();
  try{
    await saveMatchEditsImmediately(`Delete match: ${r.team1} ${r.score1}-${r.score2} ${r.team2}`,[],[],[],[key]);
    await pushMatchDeleteIndexToGitHub(`Refresh delete index after deleting ${r.team1} vs ${r.team2}`);
    showSaveToast(`試合削除・GitHub照合済み：${r.team1} ${r.score1}-${r.score2} ${r.team2}`);
  }catch(err){
    alert(`削除は画面に反映しましたが共有保存の完了に失敗しました。\n${err.message||err}`);
  }
}


let ledgerPagingDelegationInstalled=false;
function installLedgerPagingDelegation(){
  if(ledgerPagingDelegationInstalled) return;
  ledgerPagingDelegationInstalled=true;
  document.addEventListener("click",e=>{
    const prev=e.target.closest?.("#ledgerPrev");
    const next=e.target.closest?.("#ledgerNext");
    if(!prev && !next) return;
    e.preventDefault();
    e.stopPropagation();

    const filtered=filteredLedgerMatches();
    const pageSize=Number(document.getElementById("ledgerPageSize")?.value||100);
    const totalPages=Math.max(1,Math.ceil(filtered.length/pageSize));

    if(prev){
      if(ledgerPage>1){
        ledgerPage--;
        renderLedger();
        document.getElementById("ledgerTable")?.scrollIntoView({block:"start",behavior:"instant"});
      }
      return;
    }
    if(next && ledgerPage<totalPages){
      ledgerPage++;
      renderLedger();
      document.getElementById("ledgerTable")?.scrollIntoView({block:"start",behavior:"instant"});
    }
  },true);
}
function setupLedgerUi(){
  installLedgerPagingDelegation();
  const yearEl=document.getElementById("ledgerYear");
  const regionEl=document.getElementById("ledgerRegion");
  const prefEl=document.getElementById("ledgerPref");
  const subEl=document.getElementById("ledgerSubArea");

  // Preserve current selections when history data arrives later.
  const saved={
    year:yearEl?.value||"all",
    region:regionEl?.value||"all",
    pref:prefEl?.value||"all",
    sub:subEl?.value||"all"
  };
  const ledgerYears=ledgerShardManifest?.years?.length ? ledgerShardManifest.years.map(x=>String(x.year||"")).filter(Boolean) : uniq(ledgerMatches.map(x=>x.year)).sort((a,b)=>Number(b)-Number(a));
  fillSelect("ledgerYear", ledgerYears);
  fillSelect("ledgerRegion", ["北海道","東北","関東・東京","北信越","東海","近畿","中国","四国","九州","全国"]);
  fillSelect("ledgerPref", BASEBALL_PREF_ORDER);
  fillSelect("ledgerSubArea", uniq(ledgerMatches.map(x=>x.sub_area)));

  if(yearEl && [...yearEl.options].some(o=>o.value===saved.year)) yearEl.value=saved.year;
  if(regionEl && [...regionEl.options].some(o=>o.value===saved.region)) regionEl.value=saved.region;
  if(prefEl && [...prefEl.options].some(o=>o.value===saved.pref)) prefEl.value=saved.pref;
  if(subEl && [...subEl.options].some(o=>o.value===saved.sub)) subEl.value=saved.sub;

  if(ledgerUiSetupDone) return;
  ledgerUiSetupDone = true;

  ["ledgerSeason","ledgerScope","ledgerSubArea","ledgerSource","ledgerSort"]
    .forEach(id=>document.getElementById(id)?.addEventListener("change",()=>{ledgerPage=1;renderLedger();}));
  ["ledgerRegion","ledgerPref"].forEach(id=>document.getElementById(id)?.addEventListener("change",async()=>{
    ledgerPage=1;
    const count=document.getElementById("ledgerCount");
    if(count) count.textContent="必要な地域だけ読込中…";
    try{ await ensureLedgerSelectionData(); }catch(err){ console.warn("regional ledger load failed",err); }
    renderLedger();
  }));
  document.getElementById("ledgerYear")?.addEventListener("change",async()=>{
    ledgerPage=1;
    const y=document.getElementById("ledgerYear")?.value||"all";
    const count=document.getElementById("ledgerCount");
    if(count) count.textContent=y==="all"?"全年度読込中…":`${y}年 読込中…`;
    try{
      const regionNow=document.getElementById("ledgerRegion")?.value||"all";
      await ensureLedgerYearsForSelection(y);
      setupLedgerUi();
      const yearEl=document.getElementById("ledgerYear");
      const regionEl=document.getElementById("ledgerRegion");
      if(yearEl) yearEl.value=y;
      if(regionEl && [...regionEl.options].some(o=>o.value===regionNow)) regionEl.value=regionNow;
      renderLedger();
    }catch(err){
      console.error("ledger year shard load failed",err);
      if(count) count.textContent="台帳読込失敗";
    }
  });
  document.getElementById("ledgerSchool")?.addEventListener("input",debounce(()=>{ledgerPage=1;renderLedger();},180));
  document.getElementById("ledgerPageSize")?.addEventListener("change",()=>{ledgerPage=1;renderLedger();});
  document.getElementById("ledgerSelectPage")?.addEventListener("click",selectLedgerCurrentPage);
  document.getElementById("ledgerSelectFiltered")?.addEventListener("click",selectLedgerAllFiltered);
  document.getElementById("ledgerSelectDuplicates")?.addEventListener("click",selectLedgerStrictDuplicates);
  document.getElementById("ledgerSelectNearDuplicates")?.addEventListener("click",selectLedgerNearDuplicates);
  document.getElementById("ledgerSelectSameTournament")?.addEventListener("click",selectLedgerSameTournament);
  document.getElementById("ledgerInvertPageSelection")?.addEventListener("click",invertLedgerCurrentPageSelection);
  document.getElementById("ledgerClearSelection")?.addEventListener("click",clearLedgerSelection);
  document.getElementById("ledgerBulkEdit")?.addEventListener("click",bulkEditLedgerMatches);
  document.getElementById("ledgerBulkDuplicate")?.addEventListener("click",bulkDuplicateLedgerMatches);
  document.getElementById("ledgerBulkDelete")?.addEventListener("click",bulkDeleteLedgerMatches);

  document.getElementById("addManualMatchBtn")?.addEventListener("click",openManualMatchModal);
  document.getElementById("auditManualPersistenceBtn")?.addEventListener("click",auditManualMatchPersistence);
  document.getElementById("closeManualMatchBtn")?.addEventListener("click",closeManualMatchModal);
  document.getElementById("manualMatchModal")?.addEventListener("click",e=>{if(e.target.id==="manualMatchModal") closeManualMatchModal();});
  document.getElementById("saveManualMatchBtn")?.addEventListener("click",saveManualMatch);

  document.getElementById("closeLedgerEditBtn")?.addEventListener("click",closeLedgerEdit);
  document.getElementById("ledgerEditModal")?.addEventListener("click",e=>{if(e.target.id==="ledgerEditModal") closeLedgerEdit();});
  document.getElementById("saveLedgerEditBtn")?.addEventListener("click",saveLedgerEdit);
  document.getElementById("deleteLedgerMatchBtn")?.addEventListener("click",deleteActiveLedgerMatch);

  document.getElementById("openPrefRepairBtn")?.addEventListener("click",openPrefRepair);
  document.getElementById("closePrefRepairBtn")?.addEventListener("click",closePrefRepair);
  document.getElementById("prefRepairModal")?.addEventListener("click",e=>{if(e.target.id==="prefRepairModal") closePrefRepair();});
  document.getElementById("applyPrefRepairBtn")?.addEventListener("click",applyPrefRepair);
  document.getElementById("selectAllPrefRepairBtn")?.addEventListener("click",()=>document.querySelectorAll("[data-pref-repair-key]").forEach(x=>x.checked=true));
  document.getElementById("clearAllPrefRepairBtn")?.addEventListener("click",()=>document.querySelectorAll("[data-pref-repair-key]").forEach(x=>x.checked=false));

  document.getElementById("closeRatingFormulaBtn")?.addEventListener("click",closeRatingFormula);
  document.getElementById("ratingFormulaModal")?.addEventListener("click",e=>{if(e.target.id==="ratingFormulaModal") closeRatingFormula();});

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
      .forEach(id=>{const el=document.getElementById(id);if(el)el.value="all";});
    document.getElementById("ledgerSort").value="date_desc";
    document.getElementById("ledgerSchool").value="";
    ledgerMatches=[];
    ledgerLoadedYears.clear();
    ledgerLoadedSlices.clear();
    ledgerSelectedKeys.clear();
    ledgerPage=1;
    const count=document.getElementById("ledgerCount");
    if(count) count.textContent="年代＋地区/県を指定";
    renderLedger();
  });
  document.getElementById("ledgerUnion")?.addEventListener("change",()=>{ledgerPage=1;renderLedger();});

  const wireEditUnionType=(side)=>{
    const type=document.getElementById(`editMatchType${side==="team1"?"1":"2"}`);
    const sel=document.getElementById(`editMatchUnion${side==="team1"?"1":"2"}`);
    if(!type||!sel) return;
    type.addEventListener("change",()=>{
      if(type.value!=="union") return;
      const r=activeLedgerEditRow; if(!r) return;
      let u=findMatchingUnionForRow(r,side);
      if(!u){
        u=createUnionDraftFromRow(r,side);
        queueSharedMasterSave(`Auto-create union from editor: ${r[side]} / ${r.tournament||""}`);
      }
      refreshUnionSelects(side==="team1"?u.union_id:(document.getElementById("editMatchUnion1")?.value||""),side==="team2"?u.union_id:(document.getElementById("editMatchUnion2")?.value||""));
      setTimeout(refreshLedgerEditDirty,0);
    });
  };
  wireEditUnionType("team1"); wireEditUnionType("team2");
  document.getElementById("exportLedgerCsvBtn")?.addEventListener("click",exportLedgerCsv);
  document.getElementById("importLedgerCsvInput")?.addEventListener("change",async e=>{const f=e.target.files?.[0];if(f){try{await importLedgerCsvFile(f);}catch(err){alert(`CSV取込失敗\n${err.message}`);}e.target.value="";}});
}


function prefStrengthMap(){
  const m=new Map();
  if(prefectureCurrentRatings?.length){
    for(const r of prefectureCurrentRatings){
      const p=normalizePrefectureDisplayName(r.prefecture||"").trim();
      if(!p) continue;
      const rating=Number(r.rating||1000);
      m.set(p,{...r,rating:Number.isFinite(rating)?rating:1000,history_strength_elo:Number(r.historical_prior||0)});
    }
    return m;
  }
  for(const r of prefectureStrengthRows||[]){
    const p=normalizePrefectureDisplayName(r.prefecture||"").trim();
    if(!p) continue;
    const elo=Number(r.history_strength_elo||0);
    m.set(p,{...r,history_strength_elo:Number.isFinite(elo)?elo:0,rating:1000+(Number.isFinite(elo)?elo:0)});
  }
  return m;
}

function prefMatchupLookup(a,b){
  a=String(a||"").trim(); b=String(b||"").trim();
  if(!a||!b||a===b) return {biasA:0,biasB:0,row:null};

  const rows=prefectureMatchupRows||[];
  let row=rows.find(r=>String(r.pref_a||"").trim()===a && String(r.pref_b||"").trim()===b);
  if(row){
    const va=Number(row.compatibility_elo_a||0), vb=Number(row.compatibility_elo_b||0);
    return {biasA:Number.isFinite(va)?va:0,biasB:Number.isFinite(vb)?vb:0,row};
  }

  row=rows.find(r=>String(r.pref_a||"").trim()===b && String(r.pref_b||"").trim()===a);
  if(row){
    const va=Number(row.compatibility_elo_a||0), vb=Number(row.compatibility_elo_b||0);
    return {biasA:Number.isFinite(vb)?vb:0,biasB:Number.isFinite(va)?va:0,row};
  }
  return {biasA:0,biasB:0,row:null};
}

function matchSidePref(row,side){
  const rec=masterRecordForMatchSide(row,side);
  const p=normalizePrefectureName(rec?.prefecture||row?.[`${side}_prefecture`]||"");
  return p;
}

function buildPrefInterstateCache(){
  if(prefInterstateCache) return prefInterstateCache;
  const cache=new Map();
  const source=ledgerMatches.length?ledgerMatches:allMatches;
  for(const r of source){
    const p1=matchSidePref(r,"team1");
    const p2=matchSidePref(r,"team2");
    if(!p1||!p2||p1===p2) continue;

    const add=(pref,is1,opp)=>{
      const sf=Number(is1?r.score1:r.score2);
      const sa=Number(is1?r.score2:r.score1);
      const item={
        row:r,
        pref,
        opponent:opp,
        team:is1?effectiveMatchSchoolName(r,"team1"):effectiveMatchSchoolName(r,"team2"),
        opponentTeam:is1?effectiveMatchSchoolName(r,"team2"):effectiveMatchSchoolName(r,"team1"),
        sf,sa,
        result:sf>sa?"W":sf<sa?"L":"D"
      };
      if(!cache.has(pref)) cache.set(pref,[]);
      cache.get(pref).push(item);
    };
    add(p1,true,p2);
    add(p2,false,p1);
  }
  prefInterstateCache=cache;
  return cache;
}

function prefectureInterstateMatches(pref){
  return buildPrefInterstateCache().get(pref)||[];
}

function filteredPrefHistory(pref){
  const year=document.getElementById("prefRatingYear")?.value||"all";
  const season=document.getElementById("prefRatingSeason")?.value||"all";
  const tournament=document.getElementById("prefRatingTournament")?.value||"all";
  return (prefectureRatingEvents||[]).filter(e=>e.pref_a===pref||e.pref_b===pref).filter(e=>{
    if(year!=="all"&&String(e.year||"")!==year)return false;
    if(season!=="all"&&String(e.season||"")!==season)return false;
    if(tournament!=="all"&&String(e.tournament||"")!==tournament)return false;
    return true;
  }).map(e=>{
    const isA=e.pref_a===pref;
    return {row:e,opponentPref:isA?e.pref_b:e.pref_a,opponent:isA?e.pref_b:e.pref_a,team:e.team_a||"",opponentTeam:e.team_b||"",sf:Number(isA?e.score_a:e.score_b),sa:Number(isA?e.score_b:e.score_a),result:Number(isA?e.score_a:e.score_b)>Number(isA?e.score_b:e.score_a)?"W":Number(isA?e.score_a:e.score_b)<Number(isA?e.score_b:e.score_a)?"L":"D",rating_after:Number(isA?e.rating_a_after:e.rating_b_after)};
  }).sort((a,b)=>eventReverseChronoCompare(a.row,b.row));
}
function renderPrefHistoryChart(rows,pref){
  const el=document.getElementById("prefHistoryChart");
  if(!el) return;
  const events=(prefectureRatingEvents||[]).filter(e=>e.pref_a===pref||e.pref_b===pref)
    .filter(e=>{
      const year=document.getElementById("prefRatingYear")?.value||"all";
      const season=document.getElementById("prefRatingSeason")?.value||"all";
      const tournament=document.getElementById("prefRatingTournament")?.value||"all";
      if(year!=="all" && String(e.year||"")!==year) return false;
      if(season!=="all" && String(e.season||"")!==season) return false;
      if(tournament!=="all" && String(e.tournament||"")!==tournament) return false;
      return true;
    }).sort(eventChronoCompare);
  if(!events.length){ el.innerHTML=`<div class="school-detail-empty">該当する県Rating履歴なし</div>`; return; }
  const pts=events.map((e,i)=>{
    const isA=e.pref_a===pref;
    return {i,value:Number(isA?e.rating_a_after:e.rating_b_after),date:e.date||"",opp:isA?e.pref_b:e.pref_a};
  });
  const min=Math.min(...pts.map(x=>x.value))-8,max=Math.max(...pts.map(x=>x.value))+8;
  const W=760,H=220,pad=28,xp=i=>pad+(pts.length<=1?0:i/(pts.length-1)*(W-pad*2)),yp=v=>H-pad-(v-min)/(max-min||1)*(H-pad*2);
  const color=PREFECTURE_ROW_ACCENTS[pref]||"#68707c";
  const path=pts.map((p,i)=>`${i?"L":"M"} ${xp(i).toFixed(1)} ${yp(p.value).toFixed(1)}`).join(" ");
  el.innerHTML=`<svg viewBox="0 0 ${W} ${H}" class="pref-history-svg" style="color:${color}">
    <line x1="${pad}" x2="${W-pad}" y1="${yp(1000)}" y2="${yp(1000)}" class="pref-chart-zero"/>
    <path d="${path}" class="pref-chart-line"/>
    ${pts.map((p,i)=>`<circle cx="${xp(i)}" cy="${yp(p.value)}" r="3.8" class="pref-chart-dot"><title>${esc(p.date)} vs ${esc(p.opp)} / ${p.value.toFixed(1)}</title></circle>`).join("")}
  </svg>
  <div class="school-meta">正式な県Ratingイベント履歴</div>`;
}



function normalizePrefectureDisplayName(v){
  const s=String(v??"").trim();
  // Backward compatibility for stale generated CSV made by the old Kyoto bug.
  if(s==="京") return "京都";
  if(s==="京都府") return "京都";
  if(s==="大阪府") return "大阪";
  return s.replace(/県$/,"").replace(/府$/,"");
}

function renderPrefRatingRanking(){
  const body=document.getElementById("prefRankingBody");
  if(!body) return;

  const selectedPref=document.getElementById("prefRatingPref")?.value||"";
  const q=String(document.getElementById("prefRankingSearch")?.value||"").trim().toLowerCase();
  const mode=document.getElementById("prefRankingSort")?.value||"rating_desc";
  const strength=prefStrengthMap();
  const year=document.getElementById("prefRatingYear")?.value||"all";
  const season=document.getElementById("prefRatingSeason")?.value||"all";
  const tournament=document.getElementById("prefRatingTournament")?.value||"all";
  const filtered=year!=="all" || season!=="all" || tournament!=="all";

  let rows;
  if(filtered){
    const latest=new Map();
    for(const e of prefectureRatingEvents||[]){
      if(year!=="all" && String(e.year||"")!==year) continue;
      if(season!=="all" && String(e.season||"")!==season) continue;
      if(tournament!=="all" && String(e.tournament||"")!==tournament) continue;
      const a=String(e.pref_a||"").trim(), b=String(e.pref_b||"").trim();
      const ra=Number(e.rating_a_after), rb=Number(e.rating_b_after);
      if(a && Number.isFinite(ra)) latest.set(a,ra);
      if(b && Number.isFinite(rb)) latest.set(b,rb);
    }
    rows=[...latest.entries()].map(([pref,rating])=>({
      pref,rating,
      prior:Number(strength.get(pref)?.history_strength_elo ?? strength.get(pref)?.historical_prior ?? 0)
    }));
  }else{
    rows=[...strength.entries()].map(([pref,row])=>({
      pref,
      rating:Number(row?.rating||1000),
      prior:Number(row?.history_strength_elo ?? row?.historical_prior ?? 0)
    })).filter(x=>Number.isFinite(x.rating));
  }

  const periodLabel=document.getElementById("prefRankingPeriodLabel");
  if(periodLabel){
    const parts=[];
    if(year!=="all") parts.push(`${year}年`);
    if(season!=="all") parts.push(seasonLabel(season));
    if(tournament!=="all") parts.push(tournament);
    periodLabel.textContent=filtered
      ? `${parts.join(" / ")} の最終県Rating順位（期間内に対外戦がある県）`
      : "現在の県Rating順位";
  }

  // Rank is always based on Rating descending, independent of display sort.
  const ranked=[...rows].sort((a,b)=>b.rating-a.rating || baseballPrefSort(a.pref,b.pref));
  const rankMap=new Map();
  let lastRating=null,lastRank=0;
  ranked.forEach((x,i)=>{
    if(lastRating===null || Math.abs(x.rating-lastRating)>1e-9) lastRank=i+1;
    rankMap.set(x.pref,lastRank);
    lastRating=x.rating;
  });
  const leader=ranked.length?ranked[0].rating:1000;

  if(q) rows=rows.filter(x=>String(x.pref).toLowerCase().includes(q));
  if(mode==="rating_asc"){
    rows.sort((a,b)=>a.rating-b.rating || baseballPrefSort(a.pref,b.pref));
  }else if(mode==="baseball"){
    rows.sort((a,b)=>baseballPrefSort(a.pref,b.pref));
  }else{
    rows.sort((a,b)=>b.rating-a.rating || baseballPrefSort(a.pref,b.pref));
  }

  body.innerHTML=rows.map(x=>{
    const rank=rankMap.get(x.pref)||"-";
    const gap=x.rating-leader;
    const bg=PREFECTURE_ROW_COLORS[x.pref]||"#fff";
    const accent=PREFECTURE_ROW_ACCENTS[x.pref]||"#777";
    return `<tr class="pref-ranking-row ${x.pref===selectedPref?"selected":""}"
      data-pref-ranking-pref="${esc(x.pref)}"
      style="--pref-row-bg:${bg};--pref-row-accent:${accent}">
      <td class="pref-rank-num">${rank}</td>
      <td><span class="pref-rank-name"><i></i>${esc(x.pref)}</span></td>
      <td><strong>${x.rating.toFixed(1)}</strong></td>
      <td class="${x.prior>0?"pos":x.prior<0?"neg":""}">${x.prior>=0?"+":""}${x.prior.toFixed(1)}</td>
      <td>${gap===0?"-":gap.toFixed(1)}</td>
    </tr>`;
  }).join("") || `<tr><td colspan="5" class="school-detail-empty">該当する県なし</td></tr>`;

  body.querySelectorAll("[data-pref-ranking-pref]").forEach(tr=>{
    tr.addEventListener("click",()=>{
      const pref=tr.dataset.prefRankingPref||"";
      const sel=document.getElementById("prefRatingPref");
      if(sel && [...sel.options].some(o=>o.value===pref)){
        sel.value=pref;
        refreshPrefTournamentOptions();
        savePrefRatingLastSelection();
        renderPrefRating();
        document.getElementById("prefRatingSummary")?.scrollIntoView({behavior:"smooth",block:"start"});
      }
    });
  });
}

function renderPrefRating(){
  const pref=document.getElementById("prefRatingPref")?.value||"";
  if(!pref) return;

  const strength=prefStrengthMap().get(pref)||{history_strength_elo:0,rating:1000};
  const rows=filteredPrefHistory(pref);
  const wins=rows.filter(x=>x.result==="W").length;
  const losses=rows.filter(x=>x.result==="L").length;
  const draws=rows.filter(x=>x.result==="D").length;
  const games=rows.length;
  const rf=rows.reduce((a,x)=>a+(Number.isFinite(x.sf)?x.sf:0),0);
  const ra=rows.reduce((a,x)=>a+(Number.isFinite(x.sa)?x.sa:0),0);

  const summary=document.getElementById("prefRatingSummary");
  const prefColor=PREFECTURE_ROW_ACCENTS[pref]||"#68707c";
  const prefBg=PREFECTURE_ROW_COLORS[pref]||"#fff";
  if(summary){ summary.style.setProperty("--pref-accent",prefColor); summary.style.setProperty("--pref-bg",prefBg); }
  if(summary) summary.innerHTML=`
    <div class="pref-summary-card"><span>現在の県マスタRating</span><strong>${Number(strength.rating||1000).toFixed(1)}</strong><small>1000 + history_strength_elo (${Number(strength.history_strength_elo||0)>=0?"+":""}${Number(strength.history_strength_elo||0).toFixed(1)})</small></div>
    <div class="pref-summary-card"><span>抽出対外戦</span><strong>${games}</strong><small>${wins}勝 ${losses}敗 ${draws}分</small></div>
    <div class="pref-summary-card"><span>勝率</span><strong>${games?((wins/games)*100).toFixed(1):"0.0"}%</strong><small>選択中フィルタ</small></div>
    <div class="pref-summary-card"><span>得失点</span><strong>${rf}-${ra}</strong><small>差 ${rf-ra>=0?"+":""}${rf-ra}</small></div>`;

  const count=document.getElementById("prefHistoryCount");
  if(count) count.textContent=`${games}試合`;
  renderPrefHistoryChart(rows,pref);

  const list=document.getElementById("prefHistoryList");
  if(list) list.innerHTML=rows.slice().reverse().slice(0,50).map(x=>`
    <div class="pref-history-row">
      <span>${esc(x.row.date||"")}</span>
      <span>${esc(seasonLabel(x.row.season||""))}</span>
      <span>${esc(x.row.tournament||"")}</span>
      <span class="${x.result==="W"?"win":x.result==="L"?"loss":""}">${x.result}</span>
      <span>${esc(x.team)} ${x.sf}-${x.sa} ${esc(x.opponentTeam)}</span>
      <span>${esc(x.opponent)}</span>
    </div>`).join("") || `<div class="school-detail-empty">該当試合なし</div>`;

  renderPrefRatingRanking();
  renderPrefCompare();
  renderPrefCompatibilityScatter(pref);
}

function renderPrefCompare(){
  const a=document.getElementById("prefCompareA")?.value||"";
  const b=document.getElementById("prefCompareB")?.value||"";
  const body=document.getElementById("prefCompareBody");
  if(!body||!a||!b) return;
  const lookup=prefMatchupLookup(a,b);
  const strength=prefStrengthMap();
  const ra=Number(strength.get(a)?.rating||1000);
  const rb=Number(strength.get(b)?.rating||1000);
  const ea=1/(1+Math.pow(10,((rb-lookup.biasB)-(ra+lookup.biasA))/400));
  const head=prefectureInterstateMatches(a).filter(x=>x.opponent===b);
  const w=head.filter(x=>x.result==="W").length;
  const l=head.filter(x=>x.result==="L").length;
  const d=head.filter(x=>x.result==="D").length;
  body.innerHTML=`
    <div class="pref-compare-hero">
      <div style="--compare-accent:${PREFECTURE_ROW_ACCENTS[a]||"#777"};--compare-bg:${PREFECTURE_ROW_COLORS[a]||"#fff"}"><span>${esc(a)}</span><strong>${ra.toFixed(1)}</strong><small>相性 ${lookup.biasA>=0?"+":""}${lookup.biasA.toFixed(1)}</small></div>
      <div class="pref-versus">VS</div>
      <div style="--compare-accent:${PREFECTURE_ROW_ACCENTS[b]||"#777"};--compare-bg:${PREFECTURE_ROW_COLORS[b]||"#fff"}"><span>${esc(b)}</span><strong>${rb.toFixed(1)}</strong><small>相性 ${lookup.biasB>=0?"+":""}${lookup.biasB.toFixed(1)}</small></div>
    </div>
    <div class="pref-compare-metrics">
      <div><span>${esc(a)}期待値</span><strong>${(ea*100).toFixed(1)}%</strong></div>
      <div><span>直接対戦</span><strong>${head.length}</strong><small>${w}勝 ${l}敗 ${d}分</small></div>
      <div><span>相性差</span><strong>${(lookup.biasA-lookup.biasB)>=0?"+":""}${(lookup.biasA-lookup.biasB).toFixed(1)}</strong><small>Elo換算</small></div>
    </div>`;
}

function renderPrefCompatibilityScatter(pref){
  const el=document.getElementById("prefCompatibilityScatter");
  if(!el) return;
  const strength=prefStrengthMap();
  const prefs=[...strength.keys()].filter(p=>p!==pref);
  const pts=prefs.map(p=>{
    const lookup=prefMatchupLookup(pref,p);
    return {p,x:Number(strength.get(p)?.rating||1000),y:Number(lookup.biasA||0)};
  });
  if(!pts.length){
    el.innerHTML=`<div class="school-detail-empty">相性データなし</div>`;
    return;
  }
  const W=900,H=360,pad=44;
  const xs=pts.map(x=>x.x), ys=pts.map(x=>x.y);
  const xmin=Math.min(...xs,950)-10,xmax=Math.max(...xs,1050)+10;
  const ymin=Math.min(...ys,-20)-5,ymax=Math.max(...ys,20)+5;
  const xp=v=>pad+((v-xmin)/(xmax-xmin||1))*(W-pad*2);
  const yp=v=>H-pad-((v-ymin)/(ymax-ymin||1))*(H-pad*2);
  el.innerHTML=`<svg viewBox="0 0 ${W} ${H}" class="pref-scatter-svg">
    <line x1="${pad}" x2="${W-pad}" y1="${yp(0)}" y2="${yp(0)}" class="pref-chart-zero"/>
    <line y1="${pad}" y2="${H-pad}" x1="${xp(1000)}" x2="${xp(1000)}" class="pref-chart-zero"/>
    ${pts.map(pt=>`<g class="pref-scatter-point">
      <circle cx="${xp(pt.x)}" cy="${yp(pt.y)}" r="5" style="fill:${PREFECTURE_ROW_ACCENTS[pt.p]||"#777"}">
        <title>${esc(pt.p)} / Rating ${pt.x.toFixed(1)} / 相性 ${pt.y>=0?"+":""}${pt.y.toFixed(1)}</title>
      </circle>
    </g>`).join("")}
    <text x="${W-180}" y="${H-8}" class="pref-chart-label">相手県Rating →</text>
    <text x="6" y="18" class="pref-chart-label">${esc(pref)}の相性補正 ↑</text>
  </svg>`;
}

function loadPrefRatingLastSelection(){
  try{
    const x=JSON.parse(localStorage.getItem(PREF_RATING_LAST_SELECTION_KEY)||"{}");
    return x && typeof x==="object" ? x : {};
  }catch(e){ return {}; }
}
function savePrefRatingLastSelection(){
  const state={
    pref:document.getElementById("prefRatingPref")?.value||"",
    year:document.getElementById("prefRatingYear")?.value||"all",
    season:document.getElementById("prefRatingSeason")?.value||"all",
    tournament:document.getElementById("prefRatingTournament")?.value||"all",
    compareA:document.getElementById("prefCompareA")?.value||"",
    compareB:document.getElementById("prefCompareB")?.value||""
  };
  try{localStorage.setItem(PREF_RATING_LAST_SELECTION_KEY,JSON.stringify(state));}catch(e){}
}
function setupPrefRatingUi(){
  const prefs=[...new Set([
    ...prefectureStrengthRows.map(r=>normalizePrefectureDisplayName(r.prefecture||"").trim()),
    ...[...schoolMaster.values()].map(s=>normalizePrefectureName(s.prefecture||""))
  ].filter(Boolean))].sort(baseballPrefSort);

  const fill=(id,first=true)=>{
    const el=document.getElementById(id); if(!el) return;
    const before=el.value;
    el.innerHTML=(first?`<option value="">県を選択</option>`:"")+prefs.map(p=>`<option value="${esc(p)}">${esc(p)}</option>`).join("");
    if(before && prefs.includes(before)) el.value=before;
  };
  fill("prefRatingPref",true); fill("prefCompareA",false); fill("prefCompareB",false);

  const saved=loadPrefRatingLastSelection();
  const main=document.getElementById("prefRatingPref");
  if(main){
    if(saved.pref && prefs.includes(saved.pref)) main.value=saved.pref;
    else if(!main.value && prefs.length) main.value=prefs[0];
  }
  const a=document.getElementById("prefCompareA");
  const b=document.getElementById("prefCompareB");
  if(a){
    if(saved.compareA && prefs.includes(saved.compareA)) a.value=saved.compareA;
    else if(!a.value) a.value=main?.value||prefs[0]||"";
  }
  if(b){
    if(saved.compareB && prefs.includes(saved.compareB)) b.value=saved.compareB;
    else if(!b.value) b.value=prefs.find(p=>p!==a?.value)||prefs[1]||prefs[0]||"";
  }

  const source=ledgerMatches.length?ledgerMatches:allMatches;
  const years=uniq([...source.map(r=>r.year),...(prefectureRatingEvents||[]).map(r=>r.year)].filter(Boolean)).sort((x,y)=>Number(y)-Number(x));
  const yel=document.getElementById("prefRatingYear");
  if(yel){
    const before=yel.value||"all";
    yel.innerHTML=`<option value="all">すべて</option>`+years.map(y=>`<option value="${esc(y)}">${esc(y)}</option>`).join("");
    yel.value=years.includes(before)?before:"all";
  }

  const saved2=loadPrefRatingLastSelection();
  const yel2=document.getElementById("prefRatingYear");
  const sel2=document.getElementById("prefRatingSeason");
  if(yel2 && saved2.year && [...yel2.options].some(o=>o.value===saved2.year)) yel2.value=saved2.year;
  if(sel2 && saved2.season && [...sel2.options].some(o=>o.value===saved2.season)) sel2.value=saved2.season;
  refreshPrefTournamentOptions();
  const tel2=document.getElementById("prefRatingTournament");
  if(tel2 && saved2.tournament && [...tel2.options].some(o=>o.value===saved2.tournament)) tel2.value=saved2.tournament;

  const rankSort=document.getElementById("prefRankingSort");
  if(rankSort && !rankSort.dataset.wired){
    rankSort.dataset.wired="1";
    rankSort.addEventListener("change",renderPrefRatingRanking);
  }
  const rankSearch=document.getElementById("prefRankingSearch");
  if(rankSearch && !rankSearch.dataset.wired){
    rankSearch.dataset.wired="1";
    rankSearch.addEventListener("input",debounce(renderPrefRatingRanking,100));
  }

  renderPrefRating();
}

function refreshPrefTournamentOptions(){
  const pref=document.getElementById("prefRatingPref")?.value||"";
  const sel=document.getElementById("prefRatingTournament");
  if(!sel||!pref) return;
  const before=sel.value||"all";
  const ts=uniq(prefectureInterstateMatches(pref).map(x=>x.row.tournament));
  sel.innerHTML=`<option value="all">すべて</option>`+ts.map(t=>`<option value="${esc(t)}">${esc(t)}</option>`).join("");
  sel.value=ts.includes(before)?before:"all";
}


function seasonShortLabel(s){return ({spring:"春",summer:"夏",autumn:"秋",senbatsu:"選抜",koshien:"選手権",jingu:"神宮"})[s]||s||"-";}
function unionById(id){return (unionTeams||[]).find(x=>String(x.union_id||"")===String(id||""))||null;}
function unionMembersText(u){return (u?.members||[]).map(m=>m.school_name||schoolByIdMap.get(String(m.school_id||""))?.canonical_name||m.school_id||"?").join("・");}
function unionIdForDraft(year,season,pref){
  const p=`U${year||"0000"}-${String(season||"X").slice(0,2).toUpperCase()}-${String(pref||"UNK").replace(/\s/g,"").slice(0,3)}`;
  let n=1; while(unionTeams.some(x=>x.union_id===`${p}-${String(n).padStart(3,"0")}`))n++;
  return `${p}-${String(n).padStart(3,"0")}`;
}
function refreshUnionSelects(s1="",s2=""){
  [["editMatchUnion1",s1],["editMatchUnion2",s2]].forEach(([id,sel])=>{
    const el=document.getElementById(id); if(!el)return;
    const rows=(unionTeams||[]).slice().sort((a,b)=>Number(b.year||0)-Number(a.year||0)||String(a.display_name||"").localeCompare(String(b.display_name||""),"ja"));
    el.innerHTML=`<option value="">未設定</option>`+rows.map(u=>`<option value="${esc(u.union_id)}" ${u.union_id===sel?"selected":""}>${esc(u.year||"")} ${esc(seasonShortLabel(u.season))} / ${esc(u.display_name||"")} / ${esc(u.tournament||"")}</option>`).join("");
  });
}

function unionMemberSchoolRecordById(id){
  return schoolByIdMap.get(String(id||""))||null;
}
function unionMemberSearchCandidates(query){
  const q=String(query||"").trim().toLowerCase();
  if(!q) return [];
  return [...schoolMaster.values()]
    .filter(s=>(s.status||"active")!=="merged" && s.kind!=="union")
    .filter(s=>String(s.canonical_name||"").toLowerCase().includes(q))
    .sort((a,b)=>{
      const an=String(a.canonical_name||"").toLowerCase(), bn=String(b.canonical_name||"").toLowerCase();
      const as=an.startsWith(q)?0:1, bs=bn.startsWith(q)?0:1;
      return as-bs || an.localeCompare(bn,"ja");
    })
    .slice(0,30);
}
function unionMemberCandidateHtml(rows){
  return rows.map(s=>`<button type="button" class="union-member-candidate" data-union-member-school-id="${esc(s.school_id||"")}">
    <strong>${esc(s.canonical_name||"")}</strong>
    <small>${esc(s.prefecture||"")} / ${esc(s.district||"")} / ${esc(s.school_id||"")}</small>
  </button>`).join("");
}
function unionMemberRow(m={school_id:"",weight:""}){
  const rec=unionMemberSchoolRecordById(m.school_id);
  const name=rec?.canonical_name||m.school_name||"";
  return `<div class="union-member-row" data-member-school-id="${esc(m.school_id||"")}">
    <div class="union-member-school-picker">
      <input class="union-member-search" type="text" autocomplete="off"
        placeholder="学校名を入力（例：駒場）" value="${esc(name)}">
      <input class="union-member-school-id" type="hidden" value="${esc(m.school_id||"")}">
      <div class="union-member-candidates hidden"></div>
      <div class="union-member-picked">${m.school_id?`選択中：${esc(name)} / ${esc(rec?.prefecture||"")}`:"学校名だけで検索します"}</div>
    </div>
    <input class="union-member-weight" type="number" min="0" step="0.01" placeholder="比率" value="${esc(m.weight??"")}">
    <button type="button" class="ghost union-member-remove">×</button>
  </div>`;
}

let unionNewSchoolTargetRow=null;

function ensureUnionNewSchoolModal(){
  if(document.getElementById("unionNewSchoolModal")) return;
  document.body.insertAdjacentHTML("beforeend",`
    <div class="merge-modal hidden" id="unionNewSchoolModal" role="dialog" aria-modal="true">
      <div class="merge-card union-new-school-card">
        <div class="merge-head">
          <div><h3>学校マスタへ新規登録</h3><p>連合の構成校として使う実在校を登録します。</p></div>
          <button type="button" class="ghost" id="closeUnionNewSchoolBtn">閉じる</button>
        </div>
        <div class="master-form">
          <label class="wide">学校名<input id="unionNewSchoolName" placeholder="例：駒場"></label>
          <label>所属地区<select id="unionNewSchoolDistrict"></select></label>
          <label>都道府県<select id="unionNewSchoolPref"></select></label>
          <label>県内地区<input id="unionNewSchoolLocal" placeholder="任意"></label>
          <label>フリガナ<input id="unionNewSchoolFurigana" placeholder="任意"></label>
          <div class="wide union-new-school-actions">
            <button type="button" class="save-btn" id="saveUnionNewSchoolBtn">学校マスタへ登録して選択</button>
          </div>
        </div>
      </div>
    </div>`);
  const d=document.getElementById("unionNewSchoolDistrict");
  const p=document.getElementById("unionNewSchoolPref");
  d.innerHTML=MASTER_DISTRICTS.map(x=>`<option value="${esc(x)}">${esc(x)}</option>`).join("");
  p.innerHTML=MASTER_PREFECTURES.filter(x=>x!=="不明").map(x=>`<option value="${esc(x)}">${esc(x)}</option>`).join("");
  document.getElementById("closeUnionNewSchoolBtn").onclick=()=>document.getElementById("unionNewSchoolModal").classList.add("hidden");
  document.getElementById("saveUnionNewSchoolBtn").onclick=saveUnionNewSchoolFromModal;
}
function openUnionNewSchoolModal(row,query=""){
  ensureUnionNewSchoolModal();
  unionNewSchoolTargetRow=row||null;
  document.getElementById("unionNewSchoolName").value=String(query||"").trim();
  document.getElementById("unionNewSchoolLocal").value="";
  document.getElementById("unionNewSchoolFurigana").value="";
  const uPref=document.getElementById("unionEditPref")?.value||"";
  const uRegion=document.getElementById("unionEditRegion")?.value||"";
  if(uPref && [...document.getElementById("unionNewSchoolPref").options].some(o=>o.value===uPref)) document.getElementById("unionNewSchoolPref").value=uPref;
  if(uRegion && [...document.getElementById("unionNewSchoolDistrict").options].some(o=>o.value===uRegion)) document.getElementById("unionNewSchoolDistrict").value=uRegion;
  document.getElementById("unionNewSchoolModal").classList.remove("hidden");
  setTimeout(()=>document.getElementById("unionNewSchoolName")?.focus(),40);
}
async function saveUnionNewSchoolFromModal(){
  const name=(document.getElementById("unionNewSchoolName")?.value||"").trim();
  const district=document.getElementById("unionNewSchoolDistrict")?.value||"不明";
  const pref=document.getElementById("unionNewSchoolPref")?.value||"不明";
  const local=(document.getElementById("unionNewSchoolLocal")?.value||"").trim();
  const furigana=(document.getElementById("unionNewSchoolFurigana")?.value||"").trim();
  if(!name){alert("学校名を入力してください。");return;}
  if(schoolMaster.has(name)){
    alert("同じ表示名の学校がすでに学校マスタにあります。候補から選択してください。");
    return;
  }
  let sid=provisionalSchoolId(name,district,pref,"00");
  let suffix=1;
  const used=new Set([...schoolMaster.values()].map(x=>String(x.school_id||"")));
  while(used.has(sid)){sid=provisionalSchoolId(`${name}#${suffix++}`,district,pref,"00");}
  const rec={
    school_id:sid,canonical_name:name,furigana,district,prefecture:pref,
    local_district:local,local_district_id:"",representative_area:pref,representative_area_id:"",
    aliases:[name],status:"active",established_year:"",closed_year:"",successor_id:""
  };
  schoolMaster.set(name,rec);
  saveMasterToStorage();
  markIdentityIndexesDirty(); ensureIdentityIndexes();
  queueSharedMasterSave(`Add school master from union: ${name}`);
  refillSelectPreserve("masterDistrictFilter",uniq([...schoolMaster.values()].map(v=>v.district)));
  refillSelectPreserve("masterPrefFilter",sortPrefectureNames([...schoolMaster.values()].map(v=>v.prefecture)));
  refillSelectPreserve("masterLocalFilter",uniq([...schoolMaster.values()].map(v=>v.local_district)));
  renderMasterTable();

  if(unionNewSchoolTargetRow){
    const inp=unionNewSchoolTargetRow.querySelector(".union-member-search");
    const hidden=unionNewSchoolTargetRow.querySelector(".union-member-school-id");
    const picked=unionNewSchoolTargetRow.querySelector(".union-member-picked");
    if(inp) inp.value=name;
    if(hidden) hidden.value=sid;
    unionNewSchoolTargetRow.dataset.memberSchoolId=sid;
    if(picked) picked.textContent=`選択中：${name} / ${pref}`;
    unionNewSchoolTargetRow.querySelector(".union-member-candidates")?.classList.add("hidden");
  }
  document.getElementById("unionNewSchoolModal").classList.add("hidden");
  showSaveToast(`学校マスタ新規登録：${name}`);
}
function wireUnionMemberRows(){
  const wrap=document.getElementById("unionMemberRows"); if(!wrap) return;
  wrap.querySelectorAll(".union-member-remove").forEach(b=>{
    b.onclick=()=>b.closest(".union-member-row")?.remove();
  });
  wrap.querySelectorAll(".union-member-search").forEach(inp=>{
    if(inp.dataset.wired) return;
    inp.dataset.wired="1";
    const row=inp.closest(".union-member-row");
    const hidden=row.querySelector(".union-member-school-id");
    const box=row.querySelector(".union-member-candidates");
    const picked=row.querySelector(".union-member-picked");
    const render=()=>{
      const q=inp.value.trim();
      // Editing the text invalidates the previous school until a candidate is explicitly picked.
      const current=unionMemberSchoolRecordById(hidden.value);
      if(current && current.canonical_name!==q){
        hidden.value="";
        row.dataset.memberSchoolId="";
        picked.textContent="候補から学校を選択してください";
      }
      if(!q){ box.classList.add("hidden"); box.innerHTML=""; return; }
      const candidates=unionMemberSearchCandidates(q);
      box.innerHTML=unionMemberCandidateHtml(candidates)+
        `<button type="button" class="union-member-create-school" data-create-union-school>
          ＋「${esc(q)}」を学校マスタへ新規登録
        </button>`;
      box.classList.remove("hidden");
      box.querySelector("[data-create-union-school]")?.addEventListener("click",()=>openUnionNewSchoolModal(row,q));
      box.querySelectorAll("[data-union-member-school-id]").forEach(btn=>{
        btn.onclick=()=>{
          const rec=unionMemberSchoolRecordById(btn.dataset.unionMemberSchoolId);
          if(!rec) return;
          hidden.value=rec.school_id||"";
          row.dataset.memberSchoolId=rec.school_id||"";
          inp.value=rec.canonical_name||"";
          picked.textContent=`選択中：${rec.canonical_name||""} / ${rec.prefecture||""}`;
          box.classList.add("hidden");
        };
      });
    };
    inp.addEventListener("input",debounce(render,80));
    inp.addEventListener("focus",()=>{ if(inp.value.trim()) render(); });
    inp.addEventListener("keydown",e=>{ if(e.key==="Escape") box.classList.add("hidden"); });
  });
}

function unionPrefSortIndex(pref){
  const p=normalizePrefectureName(pref)||String(pref||"");
  const order=[
    "北海道","青森","岩手","秋田","山形","宮城","福島","茨城","栃木","群馬","埼玉","千葉",
    "東京","神奈川","山梨","静岡","愛知","岐阜","三重","新潟","長野","富山","石川","福井",
    "滋賀","京都","大阪","兵庫","奈良","和歌山","岡山","広島","鳥取","島根","山口",
    "香川","徳島","愛媛","高知","福岡","佐賀","長崎","熊本","大分","宮崎","鹿児島","沖縄"
  ];
  const i=order.indexOf(p);
  return i>=0?i:999;
}

function renderUnionTable(){
  ensureIdentityIndexes();
  const body=document.querySelector("#unionTable tbody"); if(!body)return;
  const q=(document.getElementById("unionSearch")?.value||"").trim().toLowerCase();
  const pref=document.getElementById("unionPrefFilter")?.value||"all";
  const yr=document.getElementById("unionYearFilter")?.value||"all";
  const se=document.getElementById("unionSeasonFilter")?.value||"all";
  const sort=document.getElementById("unionSort")?.value||"year_desc";

  let rows=(unionTeams||[]).filter(u=>
    (pref==="all" || normalizePrefectureName(u.prefecture)===pref) &&
    (yr==="all" || String(u.year)===yr) &&
    (se==="all" || u.season===se) &&
    (!q || `${u.display_name||""} ${u.tournament||""} ${unionMembersText(u)}`.toLowerCase().includes(q))
  );

  rows.sort((a,b)=>{
    const pa=unionPrefSortIndex(a.prefecture),pb=unionPrefSortIndex(b.prefecture);
    const prefCmp=pa-pb || String(a.prefecture||"").localeCompare(String(b.prefecture||""),"ja");
    const yearCmp=Number(b.year||0)-Number(a.year||0);
    const nameCmp=String(a.display_name||"").localeCompare(String(b.display_name||""),"ja");
    const tournamentCmp=String(a.tournament||"").localeCompare(String(b.tournament||""),"ja");
    if(sort==="pref_year") return prefCmp || yearCmp || tournamentCmp || nameCmp;
    if(sort==="pref_name") return prefCmp || nameCmp || yearCmp || tournamentCmp;
    if(sort==="name") return nameCmp || yearCmp || prefCmp;
    return yearCmp || tournamentCmp || prefCmp || nameCmp;
  });

  body.innerHTML=rows.map(u=>`<tr>
    <td>${esc(u.year||"")}</td>
    <td>${esc(seasonShortLabel(u.season))}</td>
    <td>${esc(u.prefecture||"")}</td>
    <td>${esc(u.tournament||"")}</td>
    <td><strong>${esc(u.display_name||"")}</strong>${!(u.members||[]).length?'<span class="union-draft-badge">構成校未設定</span>':""}<div class="school-meta">${esc(u.union_id||"")}</div></td>
    <td>${esc(unionMembersText(u)||"未設定")}</td>
    <td><button class="row-edit-btn" data-union-edit="${esc(u.union_id)}">編集</button></td>
  </tr>`).join("")||`<tr><td colspan="7">該当する連合登録なし</td></tr>`;

  body.querySelectorAll("[data-union-edit]").forEach(b=>b.onclick=()=>showUnionEditor(b.dataset.unionEdit));
}
function showUnionEditor(id=""){
  ensureIdentityIndexes();
  const e=document.getElementById("unionEditor"); if(!e)return;
  const u=unionById(id)||{union_id:"",year:new Date().getFullYear(),season:"spring",region:"",prefecture:"",tournament:"",display_name:"",members:[]};
  e.innerHTML=`<div class="school-title"><div><h3>${id?"連合を編集":"連合を追加"}</h3><div class="school-meta">大会ごとに別ID</div></div></div><div class="master-form">
    <label>年度<input id="unionEditYear" type="number" value="${esc(u.year||"")}"></label>
    <label>季節<select id="unionEditSeason">${["spring","summer","autumn","senbatsu","koshien","jingu"].map(s=>`<option value="${s}" ${u.season===s?"selected":""}>${seasonShortLabel(s)}</option>`).join("")}</select></label>
    <label>地区<input id="unionEditRegion" value="${esc(u.region||"")}"></label><label>県<input id="unionEditPref" value="${esc(u.prefecture||"")}"></label>
    <label class="wide">大会<input id="unionEditTournament" value="${esc(u.tournament||"")}"></label><label class="wide">連合表示名<input id="unionEditName" value="${esc(u.display_name||"")}"></label>
    <label class="wide">連合ID<input id="unionEditId" value="${esc(u.union_id||"")}" placeholder="空欄なら自動採番"></label>
    <div class="wide"><div class="union-member-head"><strong>構成校</strong><div class="union-member-head-actions"><button id="addUnionMemberBtn" type="button" class="ghost compact">＋ 構成校</button><button id="addNewSchoolMasterBtn" type="button" class="ghost compact">＋ 学校マスタ新規登録</button></div></div><div id="unionMemberRows">${(u.members||[]).map(unionMemberRow).join("")||unionMemberRow()}</div></div>
    <div class="wide union-editor-actions">${id?'<button id="deleteUnionBtn" type="button" class="danger-delete-btn">この連合を削除</button>':"<span></span>"}<button id="saveUnionBtn" type="button" class="save-btn">保存</button></div></div>`;
  const rows=document.getElementById("unionMemberRows");
  wireUnionMemberRows();
  document.getElementById("addUnionMemberBtn")?.addEventListener("click",()=>{rows.insertAdjacentHTML("beforeend",unionMemberRow());wireUnionMemberRows();});
  document.getElementById("addNewSchoolMasterBtn")?.addEventListener("click",()=>openUnionNewSchoolModal(null,""));
  document.getElementById("saveUnionBtn")?.addEventListener("click",()=>saveUnionEditor(id));
  document.getElementById("deleteUnionBtn")?.addEventListener("click",()=>deleteUnionTeam(id));
}
async function saveUnionEditor(oldId=""){
  const year=String(document.getElementById("unionEditYear")?.value||"").trim(), season=document.getElementById("unionEditSeason")?.value||"", pref=document.getElementById("unionEditPref")?.value.trim()||"", tournament=document.getElementById("unionEditTournament")?.value.trim()||"", name=document.getElementById("unionEditName")?.value.trim()||"";
  if(!year||!season||!tournament||!name){alert("年度・季節・大会・連合表示名は必須です。");return;}
  const uid=document.getElementById("unionEditId")?.value.trim()||oldId||unionIdForDraft(year,season,pref);
  const members=[...document.querySelectorAll("#unionMemberRows .union-member-row")].map(r=>{
    const sid=r.querySelector(".union-member-school-id")?.value||"";
    const rec=schoolByIdMap.get(String(sid));
    const w=Number(r.querySelector(".union-member-weight")?.value||0);
    return sid&&rec?{school_id:sid,school_name:rec.canonical_name||"",weight:Number.isFinite(w)&&w>0?w:0}:null;
  }).filter(Boolean);
  const memberRows=[...document.querySelectorAll("#unionMemberRows .union-member-row")];
  const typedButUnselected=memberRows.some(r=>r.querySelector(".union-member-search")?.value.trim() && !r.querySelector(".union-member-school-id")?.value);
  if(typedButUnselected){alert("構成校は入力後、候補から学校を選択してください。");return;}
  if(members.length<2){alert("構成校を2校以上登録してください。");return;}
  if(!members.every(m=>m.weight>0))members.forEach(m=>m.weight=1/members.length); else {const t=members.reduce((a,m)=>a+m.weight,0)||1;members.forEach(m=>m.weight=m.weight/t);}
  const item={union_id:uid,year:Number(year),season,region:document.getElementById("unionEditRegion")?.value.trim()||"",prefecture:pref,tournament,display_name:name,members,updated_at:new Date().toISOString()};
  if(oldId)unionTeams=unionTeams.filter(x=>x.union_id!==oldId); unionTeams.push(item); saveUnionTeamsLocal();syncUnionComponentsToSchoolMaster();saveMasterToStorage();
  renderUnionTable();refreshUnionSelects();queueSharedMasterSave(`Update union team: ${name}`);showSaveToast(`連合保存：${name}`);showUnionEditor(uid);
}
async function deleteUnionTeam(id){
  const u=unionById(id);if(!u)return;const used=ledgerMatches.filter(r=>r.team1_union_id===id||r.team2_union_id===id).length;
  const ok=await confirmDangerAction({title:"連合マスタを削除しますか？",message:`${u.display_name} / ${u.tournament}`,details:`紐づく台帳 ${used}試合。削除後は連合ID未解決になります。`,confirmText:"連合を削除"});if(!ok)return;
  unionTeams=unionTeams.filter(x=>x.union_id!==id);saveUnionTeamsLocal();renderUnionTable();refreshUnionSelects();queueSharedMasterSave(`Delete union team: ${u.display_name}`);document.getElementById("unionEditor").innerHTML='<div class="school-detail-empty">削除しました</div>';
}
function splitUnionDisplayName(name){return String(name||"").split(/[・･＋+／/、,&＆\s]+/).map(x=>x.trim()).filter(Boolean);}
function candidateSchoolsForUnionPart(part,pref){
  ensureIdentityIndexes();
  const q=String(part||"").trim();
  if(!q)return [];
  const p=identityPrefUnit(pref);
  const rows=schoolNameCandidateMap.get(q)||[];
  return rows.filter(s=>
    (s.status||"active")!=="merged" &&
    s.kind!=="union" &&
    (!p || identityPrefUnit(s.prefecture)===p)
  );
}
function inferUnionMembers(u){const parts=splitUnionDisplayName(u.display_name),found=[],ambiguous=[];for(const part of parts){const c=candidateSchoolsForUnionPart(part,u.prefecture);if(c.length===1)found.push(c[0]);else ambiguous.push({part,candidates:c});}const unique=[...new Map(found.map(s=>[s.school_id,s])).values()];return {parts,found:unique,ambiguous,complete:parts.length>=2&&unique.length===parts.length&&ambiguous.length===0};}
async function autoResolveUnionMembers(){
  ensureIdentityIndexes();
  const targets=(unionTeams||[]).filter(u=>!(u.members||[]).length);
  if(!targets.length){alert("構成校未設定の連合はありません。");return;}

  const btn=document.getElementById("autoResolveUnionMembersBtn");
  if(btn){btn.disabled=true;btn.textContent="解析中…";}
  let complete=0,partial=0;

  try{
    for(let i=0;i<targets.length;i++){
      const u=targets[i];
      const inf=inferUnionMembers(u);
      if(inf.found.length){
        u.members=inf.found.map(s=>({school_id:s.school_id,school_name:s.canonical_name,weight:1/inf.found.length}));
        u.status=inf.complete?"active":"draft";
        u.updated_at=new Date().toISOString();
        if(inf.complete)complete++; else partial++;
      }
      // Yield every 40 unions so the page stays responsive.
      if(i>0 && i%40===0) await new Promise(requestAnimationFrame);
    }

    saveUnionTeamsLocal();
    syncUnionComponentsToSchoolMaster();
    saveMasterToStorage();
    markIdentityIndexesDirty();
    ensureIdentityIndexes();
    renderUnionTable();
    queueSharedMasterSave(`Auto infer union members: ${complete} complete / ${partial} partial`);
    alert(`未設定連合 ${targets.length}件を解析\n自動確定 ${complete}件\n一部候補 ${partial}件`);
  }finally{
    if(btn){btn.disabled=false;btn.textContent="構成校を自動解析";}
  }
}
function setupUnionUi(){
  const p=document.getElementById("unionPrefFilter");
  if(p){
    const cur=p.value||"all";
    const prefs=[...new Set((unionTeams||[])
      .map(x=>normalizePrefectureName(x.prefecture))
      .filter(Boolean))]
      .sort((a,b)=>unionPrefSortIndex(a)-unionPrefSortIndex(b)||a.localeCompare(b,"ja"));
    p.innerHTML='<option value="all">全都道府県</option>'+prefs.map(v=>`<option value="${esc(v)}">${esc(v)}</option>`).join("");
    p.value=prefs.includes(cur)?cur:"all";
  }

  const y=document.getElementById("unionYearFilter");
  if(y){
    const cur=y.value||"all";
    const ys=[...new Set((unionTeams||[]).map(x=>String(x.year||"")).filter(Boolean))]
      .sort((a,b)=>Number(b)-Number(a));
    y.innerHTML='<option value="all">全年度</option>'+ys.map(v=>`<option value="${v}">${v}</option>`).join("");
    y.value=ys.includes(cur)?cur:"all";
  }

  const auto=document.getElementById("autoResolveUnionMembersBtn");
  if(auto&&!auto.dataset.wired){auto.dataset.wired="1";auto.onclick=autoResolveUnionMembers;}

  const cleanup=document.getElementById("cleanupLegacyUnionSchoolsBtn");
  if(cleanup&&!cleanup.dataset.wired){cleanup.dataset.wired="1";cleanup.onclick=cleanupLegacyUnionSchools;}

  const add=document.getElementById("addUnionBtn");
  if(add&&!add.dataset.wired){
    add.dataset.wired="1";
    add.onclick=()=>showUnionEditor("");
    document.getElementById("unionSearch")?.addEventListener("input",debounce(renderUnionTable,100));
    document.getElementById("unionPrefFilter")?.addEventListener("change",renderUnionTable);
    document.getElementById("unionYearFilter")?.addEventListener("change",renderUnionTable);
    document.getElementById("unionSeasonFilter")?.addEventListener("change",renderUnionTable);
    document.getElementById("unionSort")?.addEventListener("change",renderUnionTable);
  }
  renderUnionTable();
}

function unionDisplayNameForRow(r,side){
  const isUnion=String(r?.[`${side}_type`]||"")==="union" || Boolean(r?.[`${side}_union_id`]);
  return isUnion ? String(r?.[side]||"") : effectiveMatchSchoolName(r,side);
}

function normalizeUnionKeyPart(v){
  return String(v||"").replace(/[　\s]+/g,"").trim();
}
function findMatchingUnionForRow(r,side){
  const name=normalizeUnionKeyPart(r?.[side]);
  const year=String(r?.year||"");
  const season=String(r?.season||"");
  const tournament=normalizeUnionKeyPart(r?.tournament);
  const pref=normalizePrefectureName(ratingUnitForSide(r,side)||r?.prefecture||"");
  return (unionTeams||[]).find(u=>
    String(u.year||"")===year &&
    String(u.season||"")===season &&
    normalizeUnionKeyPart(u.tournament)===tournament &&
    normalizeUnionKeyPart(u.display_name)===name &&
    (!pref || !u.prefecture || normalizePrefectureName(u.prefecture)===pref)
  )||null;
}
function createUnionDraftFromRow(r,side){
  const existing=findMatchingUnionForRow(r,side);
  if(existing) return existing;
  const pref=normalizePrefectureName(ratingUnitForSide(r,side)||r?.prefecture||"");
  const item={
    union_id:unionIdForDraft(r?.year||"",r?.season||"",pref),
    year:Number(r?.year||0)||"",
    season:String(r?.season||""),
    region:String(r?.region||""),
    prefecture:pref,
    tournament:String(r?.tournament||""),
    display_name:String(r?.[side]||"").trim(),
    members:[],
    status:"draft",
    created_from:"ledger_inline",
    updated_at:new Date().toISOString()
  };
  unionTeams.push(item);
  saveUnionTeamsLocal();
  return item;
}

function bestMatchingSavedUnionForRow(r,side){
  const exact=findMatchingUnionForRow(r,side);
  if(exact) return exact;
  const name=normalizeUnionKeyPart(r?.[side]);
  const year=String(r?.year||"");
  const season=String(r?.season||"");
  const pref=normalizePrefectureName(ratingUnitForSide(r,side)||r?.prefecture||"");
  const candidates=(unionTeams||[]).filter(u=>
    String(u.year||"")===year &&
    String(u.season||"")===season &&
    normalizeUnionKeyPart(u.display_name)===name &&
    (!pref || !u.prefecture || normalizePrefectureName(u.prefecture)===pref)
  );
  return candidates.length===1?candidates[0]:null;
}

function reconcileSavedUnionAssignments(rows,{persist=true}={}){
  let changed=0;
  const verify=[];
  const unionNames=new Set((unionTeams||[]).map(u=>normalizeUnionKeyPart(u.display_name)).filter(Boolean));
  if(!unionNames.size) return 0;
  for(const r of rows||[]){
    for(const side of ["team1","team2"]){
      const raw=String(r?.[side]||"").trim();
      if(!raw) continue;
      const currentId=String(r?.[`${side}_union_id`]||"").trim();
      if(!currentId && !unionNames.has(normalizeUnionKeyPart(raw))) continue;
      const currentType=String(r?.[`${side}_type`]||"").trim();
      const current=unionById(currentId);

      // A saved union master is authoritative for the same year/season/tournament/name.
      // Also recover stale union_ids when the master ID changed in an older build.
      const candidate=bestMatchingSavedUnionForRow(r,side);
      const shouldRecover=Boolean(candidate) && (
        currentType==="union" || Boolean(currentId) || !current
      );
      const shouldRecognize=Boolean(candidate) && currentType!=="union" && !currentId;

      if(!candidate || (!shouldRecover && !shouldRecognize)) continue;
      if(currentType==="union" && currentId===candidate.union_id) continue;

      const changes={
        [`${side}_type`]:"union",
        [`${side}_union_id`]:candidate.union_id
      };
      Object.assign(r,changes);
      const key=matchEditKey(r);
      upsertMatchOverride(key,changes);
      verify.push({edit_key:key,changes});
      changed++;
    }
  }
  if(changed){
    prefInterstateCache=null;
    markIdentityIndexesDirty();
    saveUnionTeamsLocal();
    if(persist){
      persistPendingMatchEdits();
      // One coalesced save for every recovered assignment.
      queueMatchEditsSave(`Recover saved union assignments: ${changed}`);
    }
  }
  return changed;
}

function inlineUnionControl(r,side){
  const on=String(r?.[`${side}_type`]||"")==="union" || Boolean(r?.[`${side}_union_id`]);
  const uid=String(r?.[`${side}_union_id`]||"");
  const u=unionById(uid);
  const incomplete=on && (!u || !(u.members||[]).length);
  return `<label class="inline-union-toggle ${on?"is-on":""} ${incomplete?"is-incomplete":""}" title="${incomplete?"連合マスタの構成校が未設定です":on?"連合ON":"連合として登録"}">
    <input type="checkbox" data-inline-union-key="${esc(matchEditKey(r))}" data-inline-union-side="${esc(side)}" ${on?"checked":""}>
    <span class="inline-union-switch"></span>
    <span class="inline-union-label">${on?"連合ON":"連合"}</span>
  </label>`;
}
async function setInlineUnionState(r,side,on){
  const key=matchEditKey(r);
  let unionId="";
  let created=false;
  if(on){
    let u=findMatchingUnionForRow(r,side);
    if(!u){ u=createUnionDraftFromRow(r,side); saveUnionTeamsLocal(); created=true; }
    unionId=u.union_id;
  }
  const changes={
    [`${side}_type`]:on?"union":"school",
    [`${side}_union_id`]:on?unionId:""
  };
  upsertMatchOverride(key,changes);
  for(const arr of [ledgerMatches,allMatches]){
    const row=arr.find(x=>matchEditKey(x)===key);
    if(row) Object.assign(row,changes);
  }
  prefInterstateCache=null;
  markIdentityIndexesDirty();
  renderLedger();

  if(created){
    queueSharedMasterSave(`Auto-create union from ledger: ${r[side]} / ${r.tournament||""}`);
    renderUnionTable();
  }
  persistPendingMatchEdits();
  try{await saveMatchEditsImmediately(`${on?"Set":"Clear"} union: ${r[side]} / ${r.tournament||""}`,[{edit_key:key,changes}],[],[]);}
  catch(err){alert(`連合指定は画面に反映しましたがGitHub保存に失敗しました。\n${err.message||err}`);}
  if(on){
    const u=unionById(unionId);
    showSaveToast(`${r[side]} を連合登録${created?"・連合マスタ自動作成":""}${u?.members?.length?"":"（構成校未設定）"}`);
  }else{
    showSaveToast(`${r[side]} の連合指定を解除しました`);
  }
}
function unionBadgeForRow(r,side){const uid=String(r?.[`${side}_union_id`]||""),isUnion=String(r?.[`${side}_type`]||"")==="union"||uid;if(!isUnion)return"";const u=unionById(uid);return `<span class="union-badge" title="${esc(u?`${u.tournament} / ${unionMembersText(u)}`:"連合チーム")}">連</span>`;}

function csvCell(v){
  const s=String(v??"");
  return /[",\r\n]/.test(s)?`"${s.replace(/"/g,'""')}"`:s;
}
function downloadTextFile(name,text,type="text/csv;charset=utf-8"){
  const blob=new Blob(["\ufeff",text],{type});
  const url=URL.createObjectURL(blob);
  const a=document.createElement("a");a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),1500);
}
function exportLedgerCsv(){
  const rows=sortLedgerRows(filteredLedgerMatches());
  const fields=["edit_key","year","season","region","prefecture","tournament","round","date","team1","score1","team2","score2","innings","finish_type","source_url","note","team1_type","team1_union_id","team2_type","team2_union_id"];
  const lines=[fields.join(",")];
  for(const r of rows){
    const fin=inferredInningsAndFinish(r);
    const rec={...r,...fin,edit_key:matchEditKey(r)};
    lines.push(fields.map(f=>csvCell(rec[f]??"")).join(","));
  }
  downloadTextFile(`HS-BB-L_ledger_${new Date().toISOString().slice(0,10)}.csv`,lines.join("\r\n"));
}
function syncFinishNote(note,innings,finish){
  const parts=String(note||"").split(";").map(x=>x.trim()).filter(Boolean).filter(x=>!/^\d{1,2}回コールド$/.test(x)&&!/^延長\d{1,2}回$/.test(x));
  const n=Math.max(1,Math.min(30,Number(innings)||9));const f=String(finish||"normal").toLowerCase();
  if(f==="cold"&&n<9)parts.push(`${n}回コールド`);if(f==="extra"&&n>9)parts.push(`延長${n}回`);return parts.join(";");
}
function normalizeCsvLedgerRow(r){
  return {
    year:String(r.year||"").trim(),season:String(r.season||"").trim(),region:normalizeRegionName(r.region),
    prefecture:normalizePrefectureDisplayName(r.prefecture||"").trim(),tournament:String(r.tournament||"").trim(),round:String(r.round||"").trim(),
    date:String(r.date||"").trim(),team1:String(r.team1||"").trim(),score1:Number(r.score1),
    team2:String(r.team2||"").trim(),score2:Number(r.score2),
    innings:Math.max(1,Math.min(30,Number(r.innings)||9)),
    finish_type:["normal","cold","extra"].includes(String(r.finish_type||"").toLowerCase())?String(r.finish_type).toLowerCase():"normal",
    source_url:String(r.source_url||"").trim(),
    note:syncFinishNote(String(r.note||"").trim(),r.innings,r.finish_type),team1_type:String(r.team1_type||"school").trim(),
    team1_union_id:String(r.team1_union_id||"").trim(),team2_type:String(r.team2_type||"school").trim(),
    team2_union_id:String(r.team2_union_id||"").trim()
  };
}
async function importLedgerCsvFile(file){
  const text=await file.text();
  const rows=csvParse(text);
  if(!rows.length){alert("CSVにデータがありません");return;}

  const byKey=new Map(ledgerMatches.map(r=>[matchEditKey(r),r]));
  let updated=0,added=0,skipped=0;
  const verifyOverrides=[];
  const seenCsvKeys=new Set();
  const duplicateKeys=[];
  const addedManualIds=[];

  fastSaveStatus("CSVを解析中","saving");

  for(const src of rows){
    const r=normalizeCsvLedgerRow(src);
    if(!r.year||!r.season||!r.team1||!r.team2||!Number.isFinite(r.score1)||!Number.isFinite(r.score2)){skipped++;continue;}
    const key=String(src.edit_key||"").trim();

    if(key){
      if(seenCsvKeys.has(key)){ duplicateKeys.push(key); skipped++; continue; }
      seenCsvKeys.add(key);
    }

    const existing=key?byKey.get(key):null;
    if(existing){
      upsertMatchOverride(key,r);
      Object.assign(existing,r);
      const a=allMatches.find(x=>matchEditKey(x)===key); if(a)Object.assign(a,r);
      verifyOverrides.push({edit_key:key,changes:r});
      updated++;
    }else{
      // Blank or unknown edit_key means a new manual match; never overwrite an unrelated match.
      const manual_id=`csv-${Date.now()}-${Math.random().toString(36).slice(2,10)}`;
      const item={manual_id,...r,level:getLevel(r.note)||"prefecture",updated_at:new Date().toISOString()};
      matchEditsState.manual_matches||(matchEditsState.manual_matches=[]);
      matchEditsState.manual_matches.push(item);
      ledgerMatches.push({...item,edit_key:manual_id});
      allMatches.push({...item,edit_key:manual_id});
      added++;
    }
  }

  buildFastIndexes();
  renderLedger();
  persistPendingMatchEdits();

  try{
    const saved=await saveMatchEditsImmediately(
      `Import ledger CSV (durable): ${updated} updates / ${added} adds`,verifyOverrides,addedManualIds);
    const dupMsg=duplicateKeys.length?`\nCSV内の重複edit_key ${duplicateKeys.length}件は除外しました。`:"";
    const commitMsg=saved?.commit?`\n保存commit ${String(saved.commit).slice(0,8)}`:"";
    alert(`CSV取込・GitHub保存完了\n更新 ${updated}件\n追加 ${added}件\n除外 ${skipped}件\nGitHub照合 ${verifyOverrides.length+addedManualIds.length}件${commitMsg}${dupMsg}\n\nこの表示後はページ更新しても変更が残ります。`);
  }catch(err){
    alert(`CSVの画面反映は行いましたが、GitHubへの確定保存に失敗しました。\n変更内容はこの端末に保留しています。\n\n${err.message||err}\n\nページ更新せず、同期状態を確認してから再保存してください。`);
    throw err;
  }
}

function generationAuditRows(){
  const groups=new Map();
  for(const e of ratingSchoolEvents||[]){
    const sid=String(e.school_id||"").trim(), school=String(e.school||e.raw_team||"").trim();
    const y=Number(e.year||0); if(!y||(!sid&&!school))continue;
    const k=`${sid||school}|${y}`;
    if(!groups.has(k))groups.set(k,{school_id:sid,school,year:y,autumn:[],summer:[],reset:[]});
    const g=groups.get(k);
    if(String(e.event_type||"")==="generation_reset")g.reset.push(e);
    else if(String(e.season||"")==="autumn")g.autumn.push(e);
    else if(["summer","koshien"].includes(String(e.season||"")))g.summer.push(e);
  }
  const out=[];
  for(const g of groups.values()){
    if(!g.autumn.length)continue;
    g.autumn.sort((a,b)=>String(a.date||"").localeCompare(String(b.date||""))||String(a.match_key||"").localeCompare(String(b.match_key||"")));
    g.summer.sort((a,b)=>String(a.date||"").localeCompare(String(b.date||"")));
    const first=g.autumn[0], lastSummer=g.summer.at(-1)||null, reset=g.reset.sort((a,b)=>String(a.date||"").localeCompare(String(b.date||"")))[0]||null;
    const ok=reset && String(reset.date||"")===String(first.date||"");
    out.push({...g,first,lastSummer,reset,status:ok?"OK":reset?"要修正":"欠落"});
  }
  return out.sort((a,b)=>a.status.localeCompare(b.status)||b.year-a.year||a.school.localeCompare(b.school,"ja"));
}
function ensureAuditModal(){
  if(document.getElementById("ratingAuditModal"))return;
  document.body.insertAdjacentHTML("beforeend",`<div class="merge-modal hidden" id="ratingAuditModal"><div class="merge-card rating-audit-card">
    <div class="merge-head"><div><h3 id="ratingAuditTitle">Rating監査</h3><p id="ratingAuditMeta"></p></div><button class="ghost" id="closeRatingAuditBtn">閉じる</button></div>
    <div id="ratingAuditBody"></div></div></div>`);
  document.getElementById("closeRatingAuditBtn").onclick=()=>document.getElementById("ratingAuditModal").classList.add("hidden");
}
function upsertGenerationOverride(row){
  const list=matchEditsState.generation_reset_overrides||(matchEditsState.generation_reset_overrides=[]);
  const key=`${row.school_id||row.school}|${row.year}`;
  const item={school_id:row.school_id||"",school:row.school||"",year:row.year,anchor_match_key:row.first.match_key,updated_at:new Date().toISOString()};
  const i=list.findIndex(x=>`${x.school_id||x.school}|${x.year}`===key);
  if(i>=0)list[i]=item;else list.push(item);
}
function openGenerationAudit(){
  ensureAuditModal();const rows=generationAuditRows(),bad=rows.filter(x=>x.status!=="OK");
  document.getElementById("ratingAuditTitle").textContent="世代交代65% 監査";
  document.getElementById("ratingAuditMeta").textContent=`${rows.length}校年を確認 / 要修正 ${bad.length}`;
  document.getElementById("ratingAuditBody").innerHTML=`<div class="audit-actions"><button id="fixAllGenerationBtn" class="save-btn" ${bad.length?"":"disabled"}>要修正を秋初戦直前へ一括補正</button></div>
  <div class="table-wrap"><table><thead><tr><th>学校</th><th>年</th><th>夏最終</th><th>現在</th><th>秋初戦</th><th>判定</th><th></th></tr></thead><tbody>
  ${rows.map((x,i)=>`<tr><td>${esc(x.school)}</td><td>${x.year}</td><td>${esc(x.lastSummer?.date||"-")}</td><td>${esc(x.reset?.date||"-")}</td><td>${esc(x.first?.date||"-")} ${esc(x.first?.opponent||"")}</td><td class="${x.status==="OK"?"audit-ok":"audit-bad"}">${x.status}</td><td>${x.status!=="OK"?`<button class="ghost compact" data-fix-gen="${i}">修正</button>`:""}</td></tr>`).join("")}</tbody></table></div>`;
  document.querySelectorAll("[data-fix-gen]").forEach(b=>b.onclick=()=>{upsertGenerationOverride(rows[Number(b.dataset.fixGen)]);queueMatchEditsSave("Fix generation reset anchor");showSaveToast("世代交代位置を保存しました");openGenerationAudit();});
  document.getElementById("fixAllGenerationBtn")?.addEventListener("click",()=>{bad.forEach(upsertGenerationOverride);queueMatchEditsSave(`Fix generation reset anchors: ${bad.length}`);showSaveToast(`${bad.length}件の世代交代位置を補正しました`);openGenerationAudit();});
  document.getElementById("ratingAuditModal").classList.remove("hidden");
}
function openQualifierBiasAudit(){
  ensureAuditModal();
  const low=new Set(["branch","district_qualifier","first_qualifier","preliminary","qualifier_league","repechage"]);
  const map=new Map();
  for(const e of ratingSchoolEvents||[]){
    if(String(e.event_type||"")==="generation_reset"||!low.has(String(e.level||"")))continue;
    const sid=String(e.school_id||e.school||"");if(!sid)continue;
    if(!map.has(sid))map.set(sid,{school:e.school||e.raw_team||sid,pref:"",games:0,delta:0});
    const x=map.get(sid);x.games++;x.delta+=Number(e.rating_delta||0);
  }
  const rows=[...map.values()].sort((a,b)=>b.games-a.games||b.delta-a.delta);
  document.getElementById("ratingAuditTitle").textContent="県以下・予選試合数偏り監査";
  document.getElementById("ratingAuditMeta").textContent="まず偏りを可視化します。予選試合数補正VはまだRating本体へ適用していません。";
  document.getElementById("ratingAuditBody").innerHTML=`<div class="table-wrap"><table><thead><tr><th>学校</th><th>県以下試合</th><th>県以下ΔR合計</th><th>1試合平均</th></tr></thead><tbody>${rows.slice(0,200).map(x=>`<tr><td>${esc(x.school)}</td><td>${x.games}</td><td>${x.delta>=0?"+":""}${x.delta.toFixed(2)}</td><td>${x.games?(x.delta/x.games).toFixed(2):"-"}</td></tr>`).join("")}</tbody></table></div>`;
  document.getElementById("ratingAuditModal").classList.remove("hidden");
}
async function cleanupLegacyUnionSchools(){
  const names=unionDisplayNameSet();
  const memberIds=new Set((unionTeams||[])
    .flatMap(u=>(u.members||[]).map(m=>String(m.school_id||"").trim()))
    .filter(Boolean));

  const hits=[...schoolMaster.values()].filter(s=>{
    const sid=String(s.school_id||"").trim();
    return !memberIds.has(sid) &&
      (s.kind==="union" || names.has(String(s.canonical_name||"").trim()));
  });

  if(!hits.length){
    alert("学校マスタ内に旧連合レコードは見つかりませんでした。");
    return;
  }

  const sample=hits.slice(0,8).map(s=>`・${s.canonical_name}`).join("\\n");
  if(!confirm(
    `${hits.length}件の旧連合レコードを学校マスタから完全除外します。\\n\\n`+
    `${sample}${hits.length>8?`\\n…ほか${hits.length-8}件`:""}\\n\\n`+
    `連合マスタと構成校は残ります。よろしいですか？`
  )) return;

  const now=new Date().toISOString();
  for(const s of hits){
    const sid=String(s.school_id||"").trim();
    const already=(deletedSchoolTombstones||[]).some(x=>
      (sid && String(x.school_id||"")===sid) ||
      String(x.canonical_name||"")===String(s.canonical_name||"")
    );
    if(!already){
      deletedSchoolTombstones.push({
        school_id:sid,
        canonical_name:s.canonical_name,
        aliases:s.aliases||[],
        deleted_at:now,
        reason:"migrated_to_union_master"
      });
    }
    schoolMaster.delete(s.canonical_name);
  }

  saveMasterToStorage();
  markIdentityIndexesDirty();
  try{
    await pushSharedMasterToGitHub(`Remove legacy union school records: ${hits.length}`);
    buildFastIndexes();
    renderMasterTable();
    renderUnionTable();
    showSaveToast(`${hits.length}件の旧連合レコードを完全除外しました`);
  }catch(err){
    queueSharedMasterSave(`Remove legacy union school records: ${hits.length}`);
    alert(`端末内では除外しましたがGitHub保存に失敗しました。\\n${err.message||err}`);
  }
}

let matchupUiSetup=false;
function matchupIdentity(r,side){const e=effectiveMatchSchool(r,side);return {id:e.school_id?`SID:${e.school_id}`:`NAME:${e.canonical||r[side]}`,name:e.canonical||r[side]||""};}
function currentRatingNumber(name){const r=serverRatingForSchool(name);const n=Number(r?.rating??r);return Number.isFinite(n)?n:1000;}
function schoolMatchupRows(){const src=ledgerMatches.length?ledgerMatches:allMatches,map=new Map();for(const r of src){const x=matchupIdentity(r,"team1"),y=matchupIdentity(r,"team2");if(!x.name||!y.name||x.id===y.id)continue;const a=x.id<y.id?x:y,b=x.id<y.id?y:x,flip=a.id!==x.id,key=`${a.id}|${b.id}`;if(!map.has(key))map.set(key,{a,b,games:0,aw:0,bw:0,draw:0,apf:0,bpf:0,expectedSum:0,lastDate:""});const m=map.get(key),s1=Number(r.score1),s2=Number(r.score2),af=flip?s2:s1,bf=flip?s1:s2;m.games++;if(Number.isFinite(af)&&Number.isFinite(bf)){m.apf+=af;m.bpf+=bf;if(af>bf)m.aw++;else if(af<bf)m.bw++;else m.draw++;}const ra=currentRatingNumber(a.name),rb=currentRatingNumber(b.name);m.expectedSum+=1/(1+10**((rb-ra)/400));if(String(r.date||"")>m.lastDate)m.lastDate=String(r.date||"");}return [...map.values()].map(m=>{const actual=(m.aw+.5*m.draw)/m.games,expected=m.expectedSum/m.games,shrink=m.games/(m.games+6);return {...m,actual,expected,residual:(actual-expected)*shrink};});}
function matchupSchoolCell(name){
  const pref=simPref(name);
  const bg=PREFECTURE_ROW_COLORS[pref]||"#f7f8fa";
  const ac=PREFECTURE_ROW_ACCENTS[pref]||"#7b8490";
  return `<span class="matchup-school-pill" style="--m-bg:${bg};--m-ac:${ac}"><i></i>${esc(name)}<small>${esc(pref||"")}</small></span>`;
}
function renderSchoolMatchups(){
  const body=document.getElementById("matchupTableBody");if(!body)return;
  const min=Number(document.getElementById("matchupMinGames")?.value||3);
  const q=String(document.getElementById("matchupSearch")?.value||"").trim().toLowerCase();
  const sort=document.getElementById("matchupSort")?.value||"games";
  let rows=schoolMatchupRows().filter(x=>x.games>=min&&(!q||x.a.name.toLowerCase().includes(q)||x.b.name.toLowerCase().includes(q)));
  rows.sort((a,b)=>sort==="residual"?Math.abs(b.residual)-Math.abs(a.residual):sort==="recent"?String(b.lastDate).localeCompare(String(a.lastDate)):b.games-a.games);
  document.getElementById("matchupSummary").textContent=`${rows.length}カード / 3試合以上はRating計算時の期待率へごく小さく反映`;
  body.innerHTML=rows.slice(0,500).map(x=>{
    const eligible=x.games>=3;
    return `<tr class="${eligible?"matchup-eligible":""}">
      <td>${matchupSchoolCell(x.a.name)}</td><td>${matchupSchoolCell(x.b.name)}</td>
      <td>${x.games}</td><td>${x.aw}-${x.bw}${x.draw?` (${x.draw}分)`:""}</td><td>${x.apf}-${x.bpf}</td>
      <td>${(x.expected*100).toFixed(1)}%</td><td>${(x.actual*100).toFixed(1)}%</td>
      <td class="${x.residual>=0?"matchup-plus":"matchup-minus"}">${x.residual>=0?"+":""}${(x.residual*100).toFixed(1)}pt</td>
      <td>${eligible?'<span class="matchup-rating-on">対象</span>':'<span class="school-meta">対象外</span>'}</td>
      <td>${esc(x.lastDate||"-")}</td></tr>`;
  }).join("")||`<tr><td colspan="10">条件に合う複数回対戦カードなし</td></tr>`;
}
function setupMatchupUi(){if(matchupUiSetup)return;matchupUiSetup=true;["matchupMinGames","matchupSort"].forEach(id=>document.getElementById(id)?.addEventListener("change",renderSchoolMatchups));document.getElementById("matchupSearch")?.addEventListener("input",debounce(renderSchoolMatchups,120));}



let simTeams=[],simSlots=[],simSelectedSlot=null,simulatorUiSetup=false;let simMatchDates={};
let simStepState={round:0,current:[],rounds:[],done:false,ratings:{},lastDates:{}};
let simFastCache=null,simPairBiasCache=null;

function simPref(name){
  const rec=schoolMaster.get(resolveCanonicalName(name))||schoolMaster.get(name);
  return normalizePrefectureName(rec?.prefecture||"");
}
function simTeamStyle(name){
  const pref=simPref(name);
  return {
    pref,
    bg:PREFECTURE_ROW_COLORS[pref]||"#f7f8fa",
    accent:PREFECTURE_ROW_ACCENTS[pref]||"#7b8490"
  };
}
function buildSimPairBiasCache(){
  const map=new Map();
  for(const x of schoolMatchupRows()){
    if(x.games<3)continue;
    // Same conservative shape as Rating: residual is already shrunken in the UI model.
    const bias=Math.max(-0.025,Math.min(0.025,x.residual*0.15));
    map.set(`${x.a.name}\u0000${x.b.name}`,bias);
    map.set(`${x.b.name}\u0000${x.a.name}`,-bias);
  }
  simPairBiasCache=map;
}
function simPairBias(a,b){
  if(!simPairBiasCache)buildSimPairBiasCache();
  return simPairBiasCache.get(`${a}\u0000${b}`)||0;
}
function buildSimFastCache(){
  const home=normalizePrefectureName(document.getElementById("simHomePref")?.value||"");
  const homeE=Number(document.getElementById("simHomeElo")?.value||0);
  const kE=Number(document.getElementById("simKoshienElo")?.value||0);
  const gap=Math.max(0,Number(document.getElementById("simRoundGap")?.value||1));
  const rest=Number(document.getElementById("simRestElo")?.value||0);
  const teams={};
  for(const name of simTeams){
    teams[name]={
      rating:currentRatingNumber(name),
      pref:simPref(name),
      koshien:kE?schoolEventsFor(name).some(e=>["senbatsu","koshien"].includes(String(e.season))):false
    };
  }
  if(!simPairBiasCache)buildSimPairBiasCache();
  simFastCache={home,homeE,kE,gap,rest,teams};
  return simFastCache;
}
function simWinProbFast(a,b,roundIndex=0,cache=simFastCache||buildSimFastCache()){
  if(!a&&!b)return .5;if(!a)return 0;if(!b)return 1;
  const aa=cache.teams[a]||{rating:1000,pref:"",koshien:false};
  const bb=cache.teams[b]||{rating:1000,pref:"",koshien:false};
  let ra=aa.rating,rb=bb.rating;
  if(cache.home&&aa.pref===cache.home)ra+=cache.homeE;
  if(cache.home&&bb.pref===cache.home)rb+=cache.homeE;
  if(cache.kE&&aa.koshien)ra+=cache.kE;
  if(cache.kE&&bb.koshien)rb+=cache.kE;
  if(roundIndex>0){ra+=cache.rest*cache.gap;rb+=cache.rest*cache.gap;}
  let p=1/(1+10**((rb-ra)/400));
  p+=simPairBias(a,b);
  return Math.max(.03,Math.min(.97,p));
}
function simWinProb(a,b,roundIndex=0){return simWinProbFast(a,b,roundIndex,buildSimFastCache());}
function simScore(p){
  const close=1-Math.abs(p-.5)*2;
  const lose=Math.max(0,Math.round(1+Math.random()*4*close));
  const win=lose+1+Math.floor(Math.random()*(close>.65?4:7));
  return [win,lose];
}
function simNextPow2(n){let x=1;while(x<Math.max(2,n))x*=2;return x;}
function simRoundLabel(slotCount,roundIndex){
  const remain=slotCount/(2**roundIndex);
  if(remain===2)return "決勝";if(remain===4)return "準決勝";if(remain===8)return "準々決勝";
  if(remain===16)return "1回戦";return `R${remain}`;
}
function invalidateSimulatorCaches(){
  simFastCache=null;simPairBiasCache=null;
}
function resetSimStepState(){
  const ratings={};for(const t of simTeams)ratings[t]=currentRatingNumber(t);simStepState={round:0,current:[...simSlots],rounds:[],done:false,ratings,lastDates:{}};
  renderSimStepStatus();
}
function renderSimCandidates(){
  const q=String(document.getElementById("simSchoolSearch")?.value||"").trim().toLowerCase();
  const w=document.getElementById("simCandidateList");if(!w)return;
  if(!q){w.innerHTML="";return;}
  const rows=[...schoolMaster.values()].filter(s=>(s.status||"active")!=="merged"&&String(s.canonical_name||"").toLowerCase().includes(q)).slice(0,16);
  w.innerHTML=rows.map(s=>{
    const st=simTeamStyle(s.canonical_name);
    return `<button class="sim-candidate" style="--team-bg:${st.bg};--team-ac:${st.accent}" data-sim-cand="${esc(s.canonical_name)}">${esc(s.canonical_name)} <small>${esc(st.pref||"")} / ${currentRatingNumber(s.canonical_name).toFixed(0)}</small></button>`;
  }).join("");
  w.querySelectorAll("[data-sim-cand]").forEach(b=>b.onclick=()=>{
    const name=b.dataset.simCand;if(!simTeams.includes(name)){simTeams.push(name);simSlots=[];invalidateSimulatorCaches();renderSimulatorBracket();}
    w.innerHTML="";const qbox=document.getElementById("simSchoolSearch");if(qbox)qbox.value="";
  });
}
function autoBuildSimBracket(){
  const n=simTeams.length;if(n<2){simSlots=[];renderSimulatorBracket();return;}
  const size=simNextPow2(n),matchCount=size/2,byes=size-n;
  const byeFlags=Array(matchCount).fill(false);
  if(byes>0){
    for(let k=0;k<byes;k++){const pos=Math.floor((k+.5)*matchCount/byes);byeFlags[Math.min(matchCount-1,pos)]=true;}
    let need=byes-byeFlags.filter(Boolean).length;
    for(let i=0;need>0&&i<matchCount;i++)if(!byeFlags[i]){byeFlags[i]=true;need--;}
  }
  const slots=Array(size).fill(null);let ti=0;
  for(let m=0;m<matchCount;m++){
    if(byeFlags[m]){slots[m*2]=simTeams[ti++]||null;slots[m*2+1]=null;}
    else{slots[m*2]=simTeams[ti++]||null;slots[m*2+1]=simTeams[ti++]||null;}
  }
  simSlots=slots;simSelectedSlot=null;simMatchDates={};invalidateSimulatorCaches();applyDefaultSimSchedule();
}
function ensureSimBracket(){
  const wanted=simNextPow2(simTeams.length),currentTeams=simSlots.filter(Boolean);
  const sameTeams=currentTeams.length===simTeams.length&&simTeams.every(t=>currentTeams.includes(t));
  if(simTeams.length>=2&&(simSlots.length!==wanted||!sameTeams))autoBuildSimBracket();
}
function swapSimSlots(a,b){
  a=Number(a);b=Number(b);
  if(!Number.isInteger(a)||!Number.isInteger(b)||a<0||b<0||a>=simSlots.length||b>=simSlots.length||a===b)return;
  [simSlots[a],simSlots[b]]=[simSlots[b],simSlots[a]];
  simSelectedSlot=null;invalidateSimulatorCaches();resetSimStepState();renderSimulatorBracket();
}
function removeSimTeamAt(slotIndex){
  const name=simSlots[slotIndex];if(!name)return;
  simTeams=simTeams.filter(t=>t!==name);simSlots=[];simSelectedSlot=null;invalidateSimulatorCaches();renderSimulatorBracket();
}
function stepWinnerFor(round,matchIndex){
  return simStepState.rounds?.[round]?.[matchIndex]?.winner||null;
}
function simMatchKey(r,m){return `${r}-${m}`;}
function simDefaultDate(r){const raw=document.getElementById("simStartDate")?.value||"";if(!raw)return "";const [y,m,d]=raw.split("-").map(Number),dt=new Date(Date.UTC(y,m-1,d));dt.setUTCDate(dt.getUTCDate()+r*Math.max(1,Number(document.getElementById("simRoundGap")?.value||2)));return dt.toISOString().slice(0,10);}
function simMatchDate(r,m){return simMatchDates[simMatchKey(r,m)]||simDefaultDate(r);}
function applyDefaultSimSchedule(){if(!simSlots.length)return;for(let r=0;r<Math.log2(simSlots.length);r++)for(let m=0;m<simSlots.length/(2**(r+1));m++)simMatchDates[simMatchKey(r,m)]=simDefaultDate(r);resetSimStepState();renderSimulatorBracket();}
function restDays(prev,next){if(!prev||!next)return null;return Math.max(0,Math.round((Date.parse(next+"T00:00:00Z")-Date.parse(prev+"T00:00:00Z"))/86400000)-1);}
function simMovFactor(score){const x=String(score||"").match(/^(\d+)-(\d+)$/);if(!x)return 1;const d=Math.abs(+x[1]-+x[2]);return d<=1?1:Math.min(1.55,1+.22*Math.log(d));}
function simulatorRoundColumns(){
  const size=simSlots.length;if(!size)return [];
  const rounds=Math.log2(size),cols=[];
  for(let r=0;r<rounds;r++){
    const matches=size/(2**(r+1)),items=[];
    for(let m=0;m<matches;m++){
      if(r===0)items.push({a:simSlots[m*2]||null,b:simSlots[m*2+1]||null,slotA:m*2,slotB:m*2+1});
      else{
        const prevA=stepWinnerFor(r-1,m*2),prevB=stepWinnerFor(r-1,m*2+1);
        items.push({a:prevA||`勝者 ${r}-${m*2+1}`,b:prevB||`勝者 ${r}-${m*2+2}`,placeholder:!(prevA||prevB)});
      }
    }
    cols.push({round:r,label:simRoundLabel(size,r),items});
  }
  return cols;
}
function renderSimulatorBracket(){
  const canvas=document.getElementById("simBracketCanvas"),meta=document.getElementById("simBracketMeta");if(!canvas)return;
  if(simTeams.length<2){
    simSlots=[];canvas.innerHTML=`<div class="school-detail-empty">参加校を2校以上追加してください</div>`;
    if(meta)meta.textContent=`参加 ${simTeams.length}校`;refreshSimMoveSelects();renderSimStepStatus();return;
  }
  if(!simSlots.length){autoBuildSimBracket();return;}
  const size=simSlots.length,byeCount=simSlots.filter(x=>!x).length;
  if(meta)meta.textContent=`参加 ${simTeams.length}校 / ${size}枠 / BYE ${byeCount}`;
  const cols=simulatorRoundColumns();
  canvas.innerHTML=`<div class="sim-bracket-scroll"><div class="sim-bracket-columns">
    ${cols.map((col,ci)=>`<section class="sim-round-col"><h4>${esc(col.label)}</h4>
      <div class="sim-round-matches" style="--match-count:${col.items.length}">
      ${col.items.map((m,mi)=>`<div class="sim-match-box ${ci?"sim-future-match":""}"><div class="sim-match-date-row"><span>${ci+1}-${mi+1}</span><input type="date" data-sim-match-date="${ci}-${mi}" value="${esc(simMatchDate(ci,mi))}"></div>
        ${ci===0?[0,1].map(side=>{
          const slot=side===0?m.slotA:m.slotB,team=side===0?m.a:m.b;
          if(!team)return `<div class="sim-slot is-bye ${simSelectedSlot===slot?"selected":""}" data-sim-slot="${slot}"><span class="sim-slot-no">${slot+1}</span><button type="button" class="sim-bye-target">BYE</button></div>`;
          const st=simTeamStyle(team);
          return `<div class="sim-slot has-team ${simSelectedSlot===slot?"selected":""}" style="--team-bg:${st.bg};--team-ac:${st.accent}" data-sim-slot="${slot}">
            <span class="sim-slot-no">${slot+1}</span>
            <button type="button" class="sim-team-chip" draggable="true" data-sim-drag-slot="${slot}" title="ドラッグまたはタップで移動"><i></i><span>${esc(team)}<small>${esc(st.pref)} / R ${currentRatingNumber(team).toFixed(0)}</small></span></button>
            <button type="button" class="sim-slot-remove" data-sim-remove="${slot}">×</button></div>`;
        }).join(""):[m.a,m.b].map(team=>{
          const known=simTeams.includes(team),st=known?simTeamStyle(team):null;
          const rv=known?Number(simStepState.ratings?.[team]??currentRatingNumber(team)):null;return `<div class="sim-future-slot ${known?"resolved":""}" ${known?`style="--team-bg:${st.bg};--team-ac:${st.accent}"`:""}>${known?`<i></i><span><strong>${esc(team)}</strong><small>仮想R ${rv.toFixed(1)}</small></span>`:esc(team)}</div>`;
        }).join("")}
      </div>`).join("")}</div></section>`).join("")}
  </div></div>`;

  canvas.querySelectorAll("[data-sim-slot]").forEach(slotEl=>{
    slotEl.addEventListener("click",e=>{
      if(e.target.closest("[data-sim-remove]"))return;
      const n=Number(slotEl.dataset.simSlot);
      if(simSelectedSlot===null){if(simSlots[n]){simSelectedSlot=n;renderSimulatorBracket();}}
      else swapSimSlots(simSelectedSlot,n);
    });
    slotEl.addEventListener("dragover",e=>{e.preventDefault();slotEl.classList.add("drag-over");});
    slotEl.addEventListener("dragleave",()=>slotEl.classList.remove("drag-over"));
    slotEl.addEventListener("drop",e=>{e.preventDefault();slotEl.classList.remove("drag-over");const from=Number(e.dataTransfer?.getData("text/sim-slot"));if(Number.isInteger(from))swapSimSlots(from,Number(slotEl.dataset.simSlot));});
  });
  canvas.querySelectorAll("[data-sim-drag-slot]").forEach(chip=>chip.addEventListener("dragstart",e=>{e.dataTransfer?.setData("text/sim-slot",String(chip.dataset.simDragSlot));if(e.dataTransfer)e.dataTransfer.effectAllowed="move";}));
  canvas.querySelectorAll("[data-sim-remove]").forEach(btn=>btn.addEventListener("click",e=>{e.stopPropagation();removeSimTeamAt(Number(btn.dataset.simRemove));}));canvas.querySelectorAll("[data-sim-match-date]").forEach(inp=>inp.addEventListener("change",()=>{const [r,m]=inp.dataset.simMatchDate.split("-").map(Number);simMatchDates[simMatchKey(r,m)]=inp.value;resetSimStepState();}));
  refreshSimMoveSelects();renderSimStepStatus();
}
function refreshSimMoveSelects(){
  const from=document.getElementById("simMoveFrom"),to=document.getElementById("simMoveTo");if(!from||!to)return;
  const opts=simSlots.map((team,i)=>`<option value="${i}">${i+1}: ${esc(team||"BYE")}</option>`).join("");
  from.innerHTML=`<option value="">選択</option>${opts}`;to.innerHTML=`<option value="">選択</option>${opts}`;
}
function simRoundDate(round){
  const raw=document.getElementById("simStartDate")?.value||"";if(!raw)return "";
  const [y,m,d]=raw.split("-").map(Number),dt=new Date(Date.UTC(y,m-1,d));
  const gap=Math.max(0,Number(document.getElementById("simRoundGap")?.value||1));
  dt.setUTCDate(dt.getUTCDate()+round*(gap+1));return dt.toISOString().slice(0,10);
}
function simulateOneRound(cur,round,cache,withScore=true,ratings=null,lastDates=null){
  const next=[],events=[],rr=ratings||Object.fromEntries(simTeams.map(t=>[t,currentRatingNumber(t)])),ld=lastDates||{};
  for(let i=0;i<cur.length;i+=2){
    const mi=i/2,date=simMatchDate(round,mi),a=cur[i]||null,b=cur[i+1]||null;
    if(!a&&!b){next.push(null);continue;}
    if(!a||!b){const w=a||b;next.push(w);if(date)ld[w]=date;events.push({round,matchIndex:mi,date,a:a||"BYE",b:b||"BYE",winner:w,score:"不戦勝",bye:true,ratingAfter:rr[w]});continue;}
    const restA=restDays(ld[a],date),restB=restDays(ld[b],date),ra=Number(rr[a]),rb=Number(rr[b]),aa=cache.teams[a],bb=cache.teams[b];
    let ea=ra,eb=rb;if(cache.home&&aa?.pref===cache.home)ea+=cache.homeE;if(cache.home&&bb?.pref===cache.home)eb+=cache.homeE;if(cache.kE&&aa?.koshien)ea+=cache.kE;if(cache.kE&&bb?.koshien)eb+=cache.kE;if(restA!==null)ea+=cache.rest*restA;if(restB!==null)eb+=cache.rest*restB;
    let prob=1/(1+10**((eb-ea)/400));prob=Math.max(.03,Math.min(.97,prob+simPairBias(a,b)));
    const aw=Math.random()<prob,w=aw?a:b;let score="";if(withScore){const z=simScore(aw?prob:1-prob),ws=z[0],ls=z[1];score=aw?`${ws}-${ls}`:`${ls}-${ws}`;}
    const delta=20*simMovFactor(score)*((aw?1:0)-prob);rr[a]=ra+delta;rr[b]=rb-delta;if(date){ld[a]=date;ld[b]=date;}next.push(w);
    events.push({round,matchIndex:mi,date,a,b,winner:w,score,prob,restA,restB,ratingBeforeA:ra,ratingBeforeB:rb,ratingAfterA:rr[a],ratingAfterB:rr[b]});
  }
  return {next,events,ratings:rr,lastDates:ld};
}
function runTournamentFast(cache,withDetails=false){let cur=[...simSlots],round=0,results=[],ratings=Object.fromEntries(simTeams.map(t=>[t,currentRatingNumber(t)])),lastDates={};while(cur.length>1){const x=simulateOneRound(cur,round,cache,withDetails,ratings,lastDates);if(withDetails)results.push(...x.events);cur=x.next;round++;}return {champion:cur[0]||"",results,ratings};}

function runSimulator(){
  if(simTeams.length<2){alert("参加校を2校以上追加してください。");return;}
  ensureSimBracket();
  const trials=Math.max(100,Math.min(100000,Number(document.getElementById("simTrials")?.value||1000)));
  const cache=buildSimFastCache(),wins=new Map(simTeams.map(t=>[t,0]));
  const start=performance.now();
  let sample=runTournamentFast(cache,true);
  for(let z=0;z<trials;z++){
    const r=runTournamentFast(cache,false);
    if(r.champion)wins.set(r.champion,(wins.get(r.champion)||0)+1);
  }
  const rows=[...wins.entries()].map(([team,champ])=>({team,champ})).sort((a,b)=>b.champ-a.champ);
  const elapsed=performance.now()-start;
  document.getElementById("simResult").innerHTML=`<h3>${trials.toLocaleString()}回試行 順位予想 <small>${elapsed.toFixed(0)}ms</small></h3>
    <div class="table-wrap"><table><thead><tr><th>#</th><th>学校</th><th>県</th><th>Rating</th><th>優勝率</th></tr></thead><tbody>
    ${rows.map((x,i)=>{const st=simTeamStyle(x.team);return `<tr><td>${i+1}</td><td>${matchupSchoolCell(x.team)}</td><td>${esc(st.pref)}</td><td>${currentRatingNumber(x.team).toFixed(0)}</td><td>${(x.champ/trials*100).toFixed(2)}%</td></tr>`}).join("")}
    </tbody></table></div>
    <h4>1回の世界線</h4><div class="sim-worldline">${sample.results.map(x=>`<div>${x.date?`${esc(x.date)} / `:""}${esc(simRoundLabel(simSlots.length,x.round))}: ${esc(x.a)} ${esc(x.score)} ${esc(x.b)} → <strong>${esc(x.winner||"-")}</strong></div>`).join("")}</div>`;
}
function renderSimStepStatus(){
  const el=document.getElementById("simStepStatus");if(!el)return;
  if(simTeams.length<2){el.innerHTML="";return;}
  if(!simStepState.current.length)simStepState.current=[...simSlots];
  const total=Math.log2(simSlots.length);
  if(simStepState.done){
    el.innerHTML=`<div class="sim-step-card done"><strong>優勝：${esc(simStepState.current[0]||"-")}</strong><span>全${total}ラウンド完了</span></div>`;
    return;
  }
  el.innerHTML=`<div class="sim-step-card"><strong>次：${esc(simRoundLabel(simSlots.length,simStepState.round))}</strong><span>${simStepState.current.filter(Boolean).length}校 / ${simStepState.current.length}枠</span></div>`;
}
function simStepEventHtml(e){
  if(e.bye)return `<div><span>${esc(e.date||"日付未設定")} / ${esc(e.a)} ${esc(e.score)} ${esc(e.b)} → <b>${esc(e.winner)}</b></span><small>仮想R ${Number(e.ratingAfter||simStepState.ratings[e.winner]).toFixed(1)}</small></div>`;
  const restA=e.restA===null?"初戦":String(e.restA),restB=e.restB===null?"初戦":String(e.restB);
  return `<div><span>${esc(e.date||"日付未設定")} / ${esc(e.a)} <strong>${esc(e.score)}</strong> ${esc(e.b)} → <b>${esc(e.winner)}</b></span><small>中日 ${esc(restA)} : ${esc(restB)} / ${esc(e.a)} ${Number(e.ratingBeforeA).toFixed(1)}→${Number(e.ratingAfterA).toFixed(1)} / ${esc(e.b)} ${Number(e.ratingBeforeB).toFixed(1)}→${Number(e.ratingAfterB).toFixed(1)}</small></div>`;
}
function runSimulatorStep(){
  if(simTeams.length<2){alert("参加校を2校以上追加してください。");return;}
  ensureSimBracket();if(!simStepState.current.length)resetSimStepState();if(simStepState.done)return;
  const cache=buildSimFastCache(),round=simStepState.round,x=simulateOneRound(simStepState.current,round,cache,true,simStepState.ratings,simStepState.lastDates);
  simStepState.rounds[round]=x.events;simStepState.current=x.next;simStepState.ratings=x.ratings;simStepState.lastDates=x.lastDates;simStepState.round++;simStepState.done=x.next.filter(Boolean).length<=1;
  renderSimulatorBracket();
  document.getElementById("simResult").innerHTML=`<h3>${esc(simRoundLabel(simSlots.length,round))} 結果</h3><div class="sim-step-results">${x.events.filter(e=>e.winner).map(simStepEventHtml).join("")}</div>`;
}

function setupSimulatorUi(){
  if(simulatorUiSetup)return;simulatorUiSetup=true;
  document.getElementById("simSchoolSearch")?.addEventListener("input",debounce(renderSimCandidates,100));
  document.getElementById("simAutoBuildBtn")?.addEventListener("click",autoBuildSimBracket);
  document.getElementById("simClearBtn")?.addEventListener("click",()=>{simTeams=[];simSlots=[];simSelectedSlot=null;invalidateSimulatorCaches();resetSimStepState();renderSimulatorBracket();});
  document.getElementById("simRunBtn")?.addEventListener("click",runSimulator);
  document.getElementById("simStepBtn")?.addEventListener("click",runSimulatorStep);document.getElementById("simApplyScheduleBtn")?.addEventListener("click",applyDefaultSimSchedule);
  document.getElementById("simStepResetBtn")?.addEventListener("click",()=>{resetSimStepState();renderSimulatorBracket();document.getElementById("simResult").innerHTML='<div class="school-detail-empty">ステップシミュレーションをリセットしました。</div>';});
  document.getElementById("simMoveBtn")?.addEventListener("click",()=>{
    const a=document.getElementById("simMoveFrom")?.value,b=document.getElementById("simMoveTo")?.value;
    if(a===""||b===""){alert("移動元と移動先を選択してください。");return;}swapSimSlots(Number(a),Number(b));
  });
  ["simHomePref","simHomeElo","simKoshienElo","simRoundGap","simRestElo"].forEach(id=>document.getElementById(id)?.addEventListener("change",invalidateSimulatorCaches));
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
      document.getElementById("unionView")?.classList.toggle("hidden", view!=="union");
      document.getElementById("prefRatingView")?.classList.toggle("hidden", view!=="prefRating");
      document.getElementById("matchupView")?.classList.toggle("hidden", view!=="matchup");
      document.getElementById("simulatorView")?.classList.toggle("hidden", view!=="simulator");
      document.getElementById("importView")?.classList.toggle("hidden", view!=="import");
      try{
        if(view==="master"){
          // School history is per-school on demand; never pull the global 70MB+ event ledgers here.
          renderMasterTable();
        }
        if(view==="union"){setupUnionUi();renderUnionTable();}
        if(view==="prefRating"){
          const summary=document.getElementById("prefRatingSummary");
          if(summary && !prefRatingDataLoaded) summary.innerHTML=`<div class="school-detail-empty">県Ratingデータ読込中…</div>`;
          loadPrefRatingData().then(()=>{ setupPrefRatingUi(); renderPrefRating(); }).catch(err=>{
            console.error(err);
            if(summary) summary.innerHTML=`<div class="school-detail-empty">県Ratingデータ読込失敗：${esc(err.message||String(err))}</div>`;
          });
        }
        if(view==="matchup"){
          setupMatchupUi();
          const summary=document.getElementById("matchupSummary");
          if(summary)summary.textContent="最新の確定台帳を読み込んで学校相性を集計中…";
          ensureCoreMatchData().then(()=>{renderSchoolMatchups();}).catch(err=>{
            console.error(err);
            if(summary)summary.textContent="学校相性の読込失敗："+(err.message||String(err));
          });
        }
        if(view==="simulator"){setupSimulatorUi();renderSimulatorBracket();}
        if(view==="import") loadImportAudit();
        if(view==="ledger"){
          const count=document.getElementById("ledgerCount");
          if(!ledgerDataLoaded){
            if(count) count.textContent="台帳データ読込中…";
            ensureLedgerData().then(()=>{renderLedger();}).catch(err=>{
              console.error(err);
              if(count) count.textContent="台帳読込失敗";
            });
          }else{
            renderLedger();
          }
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


const PREFECTURE_ROW_COLORS = {"北北海道":"#dedaf4","南北海道":"#e5e1f9","北海道":"#e1dff6","青森":"#d3e1f0","岩手":"#d5e5f3","秋田":"#d8e8f7","山形":"#deecf9","宮城":"#d2e2ef","福島":"#dbe9f4","茨城":"#d5e8dd","栃木":"#d8ebe0","群馬":"#ddeee2","埼玉":"#d4e5dc","千葉":"#dbede0","神奈川":"#e1f0e4","山梨":"#d7e9de","東東京":"#d4e8e9","西東京":"#dceeee","東京":"#d8ecec","新潟":"#e6ecd3","長野":"#ecf0d7","富山":"#f2f4db","石川":"#eaefd5","福井":"#e2e9d1","静岡":"#f1ecd5","愛知":"#f3f0d9","岐阜":"#eee8d3","三重":"#f6f3dd","滋賀":"#f5e5d5","京都":"#f7e8d9","大阪":"#fbebdd","兵庫":"#f2e2d3","奈良":"#faeee1","和歌山":"#f1dfd2","岡山":"#ebe1d8","広島":"#f0e5db","鳥取":"#e8ded7","島根":"#f2e8de","山口":"#e3dbd5","香川":"#f6e1eb","徳島":"#f2dde7","愛媛":"#f9e5ef","高知":"#eedae3","福岡":"#edd9df","佐賀":"#f2dde3","長崎":"#e8d6dc","熊本":"#f4e0e5","大分":"#f6e4e9","宮崎":"#ead7dc","鹿児島":"#f0dae1","沖縄":"#f9e8ec"};
const PREFECTURE_ROW_ACCENTS = {"北北海道":"#5947C7","南北海道":"#7B6AE0","北海道":"#6B5DD3","青森":"#2367B2","岩手":"#2F7BC5","秋田":"#3D8AD8","山形":"#5B9FE2","宮城":"#1E6FAE","福島":"#4B91C9","茨城":"#2E8B57","栃木":"#3E9A63","群馬":"#57AA70","埼玉":"#277D50","千葉":"#4AA565","神奈川":"#67B47A","山梨":"#358F5A","東東京":"#278D92","西東京":"#51A9AA","東京":"#3A9FA0","新潟":"#839E22","長野":"#A1B437","富山":"#C0C84C","石川":"#98AE2C","福井":"#6E8F1A","静岡":"#B7A02C","愛知":"#C5B640","岐阜":"#A88E22","三重":"#D1C153","滋賀":"#CB7B2B","京都":"#D98B43","大阪":"#ED9D55","兵庫":"#BE6E24","奈良":"#E6A86A","和歌山":"#B9611D","岡山":"#9B6B3E","広島":"#B27C4B","鳥取":"#8B5C35","島根":"#C08A58","山口":"#744B2B","香川":"#D26B9B","徳島":"#BE5786","愛媛":"#E07FB0","高知":"#A94774","福岡":"#A63F5E","佐賀":"#BC5572","長崎":"#8E304F","熊本":"#C7647F","大分":"#D0778F","宮崎":"#983550","鹿児島":"#B64868","沖縄":"#E08AA0"};

function baseballPrefOrderIndex(pref){
  const p=normalizePrefectureName(pref);
  const i=BASEBALL_PREF_ORDER.indexOf(p);
  if(i>=0) return i;
  if(p==="北海道") return 0;
  if(p==="東京") return BASEBALL_PREF_ORDER.indexOf("東東京");
  return 999;
}
function baseballPrefSort(a,b){
  return baseballPrefOrderIndex(a)-baseballPrefOrderIndex(b) || String(a).localeCompare(String(b),"ja");
}

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
  "北海道":"#6B5DD3","東北":"#3B8EDB","関東・東京":"#49A86E",
  "東京":"#3A9FA0","北信越":"#A8B83E","東海":"#C2B444",
  "近畿":"#D98B43","中国":"#A67648","四国":"#D772A0","九州":"#B54B69",
  "national":"#60656d"
};

function normalizeRegionLabel(region){
  const r = String(region||"").trim();
  return REGION_LABEL[r] || r || "";
}

function teamGeo(teamName){
  const raw=String(teamName||"").trim();
  const exactRec=schoolMaster.get(raw)||null;
  const canonical = exactRec ? raw : resolveCanonicalName(raw);
  const rec = exactRec || schoolMaster.get(canonical);
  const detected = detectedSchoolGeo.get(raw) || detectedSchoolGeo.get(canonical) || null;

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

  const unionLabels=unionDisplayNameSet();
  const rows = [...schoolMaster.values()].filter(x=>x.kind!=="union"&&!unionLabels.has(String(x.canonical_name||"").trim()))
    .filter(x=>{
      if(districtFilter!=="all" && (x.district||"")!==districtFilter) return false;
      if(prefFilter!=="all" && (x.prefecture||"")!==prefFilter) return false;
      if(localFilter!=="all" && (x.local_district||"")!==localFilter) return false;
      if(statusFilter!=="all" && (x.status||"active")!==statusFilter) return false;
      // Free-text search is intentionally display-name only.
      // Prefecture/district/local area/ID/aliases must not create false hits
      // such as searching "福岡" and seeing every school in Fukuoka Prefecture.
      const displayName = String(x.canonical_name||"").toLowerCase();
      return !q || displayName.includes(q);
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



function ratingHistoryForSchool(name,cutoff=""){
  return schoolEventsFor(name).filter(e=>eventBeforeOrOn(e,cutoff)).sort(eventChronoCompare);
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
    const verifyLinks=selected.map(sel=>teamLinkVerification(sel.key,sel.side,target));
    persistPendingMatchEdits();
    await saveMatchEditsImmediately(`Move ${moved} match histories: ${sourceName} -> ${target.canonical_name}`,[],[],verifyLinks);
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


async function restoreMergedAliasAsSchool(sourceName,aliasName){
  const source=schoolMaster.get(sourceName);
  const alias=String(aliasName||"").trim();
  if(!source || !alias) return;

  // Capture affected match sides BEFORE removing the alias from the source.
  const affected=[];
  const rows=ledgerMatches.length?ledgerMatches:allMatches;
  for(const r of rows){
    for(const side of ["team1","team2"]){
      const raw=String(r?.[side]||"").trim();
      if(raw!==alias) continue;
      const eff=effectiveMatchSchool(r,side);
      if(
        (source.school_id && eff.school_id===source.school_id) ||
        eff.canonical===source.canonical_name
      ){
        affected.push({key:matchEditKey(r),side,row:r});
      }
    }
  }

  if(!affected.length){
    alert(`「${alias}」表記の試合が ${sourceName} に割り当てられていません。`);
    return;
  }

  const suggested=alias;
  const newName=prompt(
    `「${alias}」を ${sourceName} から独立した学校へ戻します。\n新しい正式表示名を入力してください。`,
    suggested
  )?.trim();
  if(!newName) return;

  const pref=prompt(
    "独立させる学校の都道府県を入力してください。",
    source.prefecture||""
  )?.trim();
  if(!pref) return;

  let target=schoolMaster.get(newName)||null;
  if(target){
    const ok=confirm(
      `${newName} は既に学校マスタにあります。\n既存IDへ ${affected.length} 試合を戻しますか？`
    );
    if(!ok) return;
  }else{
    const district=PREF_TO_DISTRICT[pref]||source.district||"不明";
    let schoolId=provisionalSchoolId(newName,district,pref,"00");
    const usedIds=new Set([...schoolMaster.values()].map(x=>String(x.school_id||"")));
    if(usedIds.has(schoolId)){
      schoolId=provisionalSchoolId(`${newName}-${Date.now()}`,district,pref,"00");
    }
    target={
      school_id:schoolId,
      canonical_name:newName,
      furigana:"",
      district,
      prefecture:pref,
      local_district:"",
      local_district_id:"",
      representative_area:"",
      representative_area_id:"",
      aliases:uniq([newName,alias]),
      status:"active",
      kind:"school",
      established_year:"",
      closed_year:"",
      successor_id:""
    };
    schoolMaster.set(newName,target);
  }

  // Detach this raw alias from the wrongly merged target.
  source.aliases=(source.aliases||[]).filter(a=>String(a||"").trim()!==alias);
  if(!source.aliases.includes(source.canonical_name)){
    source.aliases=uniq([source.canonical_name,...source.aliases]);
  }
  schoolMaster.set(source.canonical_name,source);

  const verifyLinks=[];
  for(const x of affected){
    upsertMatchTeamLink(x.key,x.side,target);
    for(const arr of [ledgerMatches,allMatches]){
      const row=arr.find(r=>matchEditKey(r)===x.key);
      if(row){
        row[`${x.side}_school_id`]=target.school_id||"";
        row[`${x.side}_canonical`]=target.canonical_name||"";
      }
    }
    verifyLinks.push(teamLinkVerification(x.key,x.side,target));
  }

  saveMasterToStorage();
  persistPendingMatchEdits();
  markIdentityIndexesDirty();

  try{
    await pushSharedMasterToGitHub(`Restore merged alias as school: ${alias} -> ${target.canonical_name}`);
    await saveMatchEditsImmediately(
      `Restore ${affected.length} match sides from ${sourceName} to ${target.canonical_name}`,
      [],[],verifyLinks
    );
    buildFastIndexes();
    renderLedger();
    renderMasterTable();
    openSchoolMasterDetail(target.canonical_name);
    showSaveDialog(
      `誤統合を解除しました\n\n`+
      `${alias} → ${target.canonical_name}\n`+
      `${affected.length}試合を独立IDへ戻しました\n\n`+
      `${sourceName} の別名から「${alias}」も外しました。`
    );
  }catch(err){
    showSaveDialog(`端末内では誤統合解除しましたがGitHub保存に失敗しました\n${err.message||err}`);
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
          const isGeneration=String(r.event_type||"")==="generation_reset";
          const opponent=isGeneration ? "世代交代 65%持越し" : (r.opponent || r.opponent_name || "");
          return `<div class="school-detail-rating-row ${isGeneration?"generation-reset-row":""}" title="${esc(r.event_note||"")}">
            <span class="detail-date">${esc(r.date||"")}</span>
            <span>${esc(opponent)}${isGeneration?`<small class="generation-reset-note">${esc(r.event_note||"")}</small>`:""}</span>
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

  const detachableAliases=(rec.aliases||[])
    .filter(a=>String(a||"").trim() && String(a||"").trim()!==rec.canonical_name)
    .sort((a,b)=>String(a).localeCompare(String(b),"ja"));

  body.innerHTML=`
    <div class="school-detail-summary">
      <div><span>現在Rating</span><strong>${current==null?"-":fmtR(current)}</strong></div>
      <div><span>試合数</span><strong>${matches.length}</strong></div>
      <div><span>別名</span><strong>${(rec.aliases||[]).length}</strong></div>
      <button type="button" class="ghost" id="openSchoolEditorFromDetailBtn">この学校を編集</button>
    </div>
    ${detachableAliases.length?`
      <div class="restore-alias-panel">
        <strong>誤統合を戻す</strong>
        <span>別名として吸収された学校を、独立した学校IDへ戻します。</span>
        <select id="restoreAliasSelect">
          <option value="">別名を選択</option>
          ${detachableAliases.map(a=>`<option value="${esc(a)}">${esc(a)}</option>`).join("")}
        </select>
        <button type="button" class="ghost" id="restoreAliasAsSchoolBtn">選択した別名を独立校へ戻す</button>
      </div>`:""}
    <div class="school-detail-columns school-detail-columns-id-editor">
      ${matchHtml}
      ${ratingHtml}
    </div>`;

  document.getElementById("openSchoolEditorFromDetailBtn")?.addEventListener("click",()=>{
    modal.classList.add("hidden");
    showMasterEditor(name);
  });
  document.getElementById("restoreAliasAsSchoolBtn")?.addEventListener("click",async()=>{
    const alias=document.getElementById("restoreAliasSelect")?.value||"";
    if(!alias){alert("戻す別名を選択してください。");return;}
    await restoreMergedAliasAsSchool(name,alias);
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

function confirmDangerAction({title,message,details="",confirmText="削除する"}){
  return new Promise(resolve=>{
    let dialog=document.getElementById("dangerConfirmDialog");
    if(!dialog){
      dialog=document.createElement("dialog");
      dialog.id="dangerConfirmDialog";
      dialog.className="danger-confirm-dialog";
      dialog.innerHTML=`
        <div class="danger-confirm-icon">!</div>
        <h3 id="dangerConfirmTitle"></h3>
        <p id="dangerConfirmMessage"></p>
        <div id="dangerConfirmDetails" class="danger-confirm-details"></div>
        <div class="danger-confirm-actions">
          <button type="button" class="ghost" id="dangerConfirmCancel">キャンセル</button>
          <button type="button" class="danger-delete-btn" id="dangerConfirmOk">削除する</button>
        </div>`;
      document.body.appendChild(dialog);
    }
    dialog.querySelector("#dangerConfirmTitle").textContent=title;
    dialog.querySelector("#dangerConfirmMessage").textContent=message;
    dialog.querySelector("#dangerConfirmDetails").textContent=details;
    dialog.querySelector("#dangerConfirmOk").textContent=confirmText;

    const finish=(value)=>{
      dialog.querySelector("#dangerConfirmCancel").onclick=null;
      dialog.querySelector("#dangerConfirmOk").onclick=null;
      try{dialog.close();}catch(e){}
      resolve(value);
    };
    dialog.querySelector("#dangerConfirmCancel").onclick=()=>finish(false);
    dialog.querySelector("#dangerConfirmOk").onclick=()=>finish(true);
    dialog.oncancel=(e)=>{e.preventDefault();finish(false);};
    dialog.onclick=(e)=>{if(e.target===dialog) finish(false);};
    if(typeof dialog.showModal==="function") dialog.showModal();
    else resolve(window.confirm(`${title}\\n\\n${message}\\n\\n${details}`));
  });
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

      <div class="master-delete-row">
        <button type="button" class="danger-delete-btn" id="deleteMasterSchoolBtn">この学校マスタを削除</button>
        <button class="save-btn" id="saveMasterBtn" disabled>変更なし</button>
      </div>
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

  document.getElementById("deleteMasterSchoolBtn")?.addEventListener("click",async()=>{
    const current=schoolMaster.get(x.canonical_name)||x;
    const matches=schoolMatchRows(current.canonical_name);
    const ok=await confirmDangerAction({
      title:"学校マスタを削除しますか？",
      message:`${current.canonical_name}（${current.school_id||"IDなし"}）を学校マスタから削除します。`,
      details:`関連する対戦履歴 ${matches.length}試合は削除しません。試合別ID紐づけがこの学校を参照している場合は解除します。削除後は自動再生成を防ぐため削除記録を保持します。`,
      confirmText:"学校マスタを削除"
    });
    if(!ok) return;

    deletedSchoolTombstones=mergeListTombstones(deletedSchoolTombstones,[{
      school_id:current.school_id||"",
      canonical_name:current.canonical_name,
      aliases:[...(current.aliases||[])],
      deleted_at:new Date().toISOString()
    }]);

    schoolMaster.delete(current.canonical_name);
    schoolLineage=schoolLineage.filter(h=>h.school_id!==current.school_id);

    // Explicit per-match links to this deleted school become invalid, so release them.
    matchEditsState.team_links=(matchEditsState.team_links||[]).filter(l=>
      String(l.school_id||"")!==String(current.school_id||"") &&
      String(l.canonical_name||"")!==String(current.canonical_name||"")
    );

    saveMasterToStorage();
    saveLineage();
    markIdentityIndexesDirty();
    refillSelectPreserve("masterDistrictFilter",uniq([...schoolMaster.values()].map(v=>v.district)));
    refillSelectPreserve("masterPrefFilter",sortPrefectureNames([...schoolMaster.values()].map(v=>v.prefecture)));
    refillSelectPreserve("masterLocalFilter",uniq([...schoolMaster.values()].map(v=>v.local_district)));
    renderMasterTable();
    renderLedger();
    closeMasterEditorPopup();

    queueSharedMasterSave(`Delete school master: ${current.canonical_name}`);
    queueMatchEditsSave(`Release links for deleted school: ${current.canonical_name}`);
    showSaveToast(`学校マスタ削除：${current.canonical_name}`);
  });

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
    refillSelectPreserve("masterPrefFilter", sortPrefectureNames([...schoolMaster.values()].map(v=>v.prefecture)));
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
      prefecture:normalizePrefectureDisplayName(r.prefecture||"").trim(),
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




function schoolIdentityKeyForHistory(name){
  const direct=schoolMaster.get(String(name||"").trim());
  if(direct?.school_id) return `id:${direct.school_id}`;
  return `name:${direct?.canonical_name||resolveCanonicalName(name)}`;
}
function eventSchoolIdentityKey(e){
  const sid=String(e?.school_id||"").trim();
  return sid?`id:${sid}`:`name:${String(e?.school||e?.raw_team||"").trim()}`;
}
function currentSchoolRank(name,cutoff=""){
  const snapshot=cutoff||rankingSnapshotDateValue();
  const cacheKey=`${schoolIdentityKeyForHistory(name)}|${snapshot||"latest"}`;
  if(currentSchoolRankCache.has(cacheKey)) return currentSchoolRankCache.get(cacheKey);
  const direct=schoolMaster.get(String(name||"").trim())||schoolMaster.get(resolveCanonicalName(name));
  const source=snapshot?snapshotServerRatingRows(snapshot):serverRatings;
  let target=null;
  if(direct?.school_id) target=source.find(r=>String(r.school_id||"")===String(direct.school_id));
  else target=source.find(r=>String(r.school||"")===String(direct?.canonical_name||name));
  const tr=Number(target?.rating);if(!Number.isFinite(tr))return null;
  const vals=source.map(r=>Number(r.rating)).filter(Number.isFinite);
  const rank=1+vals.filter(v=>v>tr+1e-9).length;
  const out={rank,total:vals.length,rating:tr,games:Number(target?.games||0),wins:Number(target?.wins||0),losses:Number(target?.losses||0),draws:Number(target?.draws||0)};
  currentSchoolRankCache.set(cacheKey,out);return out;
}
function schoolRankHistory(name,cutoff=""){
  const targetKey=schoolIdentityKeyForHistory(name);
  const cacheKey=`${targetKey}|${cutoff||"all"}`;
  if(schoolRankHistoryCache.has(cacheKey)) return schoolRankHistoryCache.get(cacheKey);
  if(!ratingSchoolEvents.length){
    schoolRankHistoryCache.set(cacheKey,[]);
    return [];
  }

  const state=new Map();
  const out=[];
  let groupKey="";
  let group=[];

  const flush=()=>{
    if(!group.length) return;
    let touched=false;
    let targetEvent=null;
    for(const e of group){
      const k=eventSchoolIdentityKey(e);
      const v=Number(e.rating_after);
      if(k && Number.isFinite(v)) state.set(k,v);
      if(k===targetKey){ touched=true; targetEvent=e; }
    }
    if(touched && state.has(targetKey)){
      const tr=state.get(targetKey);
      let rank=1;
      for(const v of state.values()) if(v>tr+1e-9) rank++;
      const prevRank=out.length ? Number(out[out.length-1].rank) : null;
      out.push({
        date:targetEvent?.date||"",
        tournament:targetEvent?.tournament||"",
        round:targetEvent?.round||"",
        rank,
        previous_rank:prevRank,
        rank_delta:Number.isFinite(prevRank) ? prevRank-rank : null,
        total:state.size,
        rating:tr,
        rating_before:Number(targetEvent?.rating_before),
        rating_delta:Number(targetEvent?.rating_delta),
        opponent:targetEvent?.opponent||"",
        score_for:targetEvent?.score_for??"",
        score_against:targetEvent?.score_against??""
      });
    }
    group=[];
  };

  for(const e of ratingSchoolEvents){
    const g=String(e.match_key||`${e.date||""}|${e.tournament||""}|${e.round||""}`);
    if(group.length && g!==groupKey) flush();
    groupKey=g;
    group.push(e);
  }
  flush();

  schoolRankHistoryCache.set(cacheKey,out);
  return out;
}

function schoolRankHistorySvg(rows){
  if(!rows.length) return `<div class="empty-mini">ランキング履歴がまだありません。</div>`;
  const W=760,H=190,P=28;
  const maxRank=Math.max(10,...rows.map(x=>Number(x.rank)||1));
  const xp=i=>P+(rows.length<=1?0:(W-2*P)*(i/(rows.length-1)));
  const yp=r=>P+(H-2*P)*((Math.max(1,r)-1)/(Math.max(2,maxRank)-1));
  const pts=rows.map((x,i)=>[xp(i),yp(x.rank)]);
  const poly=pts.map(p=>p.join(",")).join(" ");
  const best=Math.min(...rows.map(x=>x.rank));
  const worst=Math.max(...rows.map(x=>x.rank));
  return `<svg class="rating-chart rank-history-chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="全国ランキング推移">
    <line x1="${P}" y1="${P}" x2="${P}" y2="${H-P}" class="chart-axis"/>
    <line x1="${P}" y1="${P}" x2="${W-P}" y2="${P}" class="chart-axis"/>
    <polyline points="${poly}" class="rank-chart-line"/>
    ${pts.map((p,i)=>`<circle cx="${p[0]}" cy="${p[1]}" r="${i===pts.length-1?5:3.2}" class="rank-chart-dot history-chart-point" data-history-kind="rank" data-history-index="${i}" tabindex="0" role="button" aria-label="${esc(rows[i].date)} ${rows[i].rank}位"><title>${esc(rows[i].date)} ${esc(rows[i].tournament)} ${esc(rows[i].round)} / ${rows[i].rank}位 / Rating ${Number(rows[i].rating).toFixed(1)}</title></circle>`).join("")}
    <text x="${P+4}" y="${P+14}" class="chart-label">1位</text>
    <text x="${W-P-150}" y="${H-6}" class="chart-label">最高 ${best}位 / 最低 ${worst}位</text>
  </svg>`;
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
    ${xy.map((p,i)=>`<circle cx="${p[0]}" cy="${p[1]}" r="${i===xy.length-1?5:3.2}" class="chart-dot history-chart-point" data-history-kind="rating" data-history-index="${i}" tabindex="0" role="button" aria-label="${esc(pts[i].date||"")} Rating ${Number(pts[i].rating_after).toFixed(1)}"><title>${esc(pts[i].date||"")} ${esc(pts[i].tournament||"")} ${esc(pts[i].round||"")} / Rating ${Number(pts[i].rating_after).toFixed(1)}</title></circle>`).join("")}
    <text x="${P}" y="16" class="chart-label">max ${max.toFixed(1)}</text>
    <text x="${W-P-90}" y="${H-6}" class="chart-label">min ${min.toFixed(1)}</text>
  </svg>`;
}

async function showRatingHistory(name){
  const modal = document.getElementById("ratingHistoryModal");
  const body = document.getElementById("ratingHistoryBody");
  if(modal) modal.classList.remove("hidden");
  if(body) body.innerHTML=`<div class="school-detail-empty">Rating・ランキング履歴を読込中…</div>`;
  const direct=schoolMaster.get(String(name||"").trim());
  const canonical = direct?.canonical_name || resolveCanonicalName(name);
  const cutoff=rankingSnapshotDateValue();
  const bundle=await loadSchoolHistoryBundle(canonical);
  const events=[...(bundle.events||[])].filter(e=>eventBeforeOrOn(e,cutoff)).sort(eventChronoCompare);
  document.getElementById("ratingHistoryTitle").textContent = `${canonical} / Rating・ランキング履歴`;
  const current = cutoff ? (schoolHistorySnapshot(events,cutoff)?.rating ?? serverRatingForSchool(canonical)) : serverRatingForSchool(canonical);
  const lineage = schoolMaster.get(canonical) ? lineageForSchool(schoolMaster.get(canonical).school_id) : [];
  const snap=schoolHistorySnapshot(events,cutoff);
  const rankNow=snap?.rank ? {rank:snap.rank,total:snap.total,rating:snap.rating,games:snap.games} : currentSchoolRank(canonical,"");
  const rankRows=schoolHistoryRankRows(events);

  body.innerHTML = `
    <div class="rating-summary">
      <div><span>現在Rating</span><strong>${current==null?"-":fmtR(current)}</strong></div>
      <div><span>現在順位</span><strong>${rankNow?`${rankNow.rank}位`:"-"}</strong><small>${rankNow?`${rankNow.total}校中`:""}</small></div>
      <div><span>Rating対象試合</span><strong>${events.filter(e=>e.event_type!=="generation_reset").length}</strong></div>
      <div><span>改名・統廃合履歴</span><strong>${lineage.length}</strong></div>
    </div>
    <h4 class="rating-subtitle">Rating推移</h4>
    ${ratingHistorySvg(events)}
    <div class="history-point-detail" data-history-detail="rating"><span>● 点をクリック／タップすると詳細を表示します。</span></div>
    <h4 class="rating-subtitle">全国ランキング推移</h4>
    ${schoolRankHistorySvg(rankRows)}
    <div class="history-point-detail" data-history-detail="rank"><span>● 点をクリック／タップすると詳細を表示します。</span></div>
    <div class="table-wrap rating-history-wrap">
      <table class="rating-history-table">
        <thead><tr><th>日付</th><th>大会</th><th>相手</th><th>結果</th><th>試合前</th><th>変動</th><th>試合後</th><th>分配</th></tr></thead>
        <tbody>
          ${[...events].reverse().map(e=>`
            <tr>
              <td>${esc(e.date||"")}</td>
              <td>${e.event_type==="generation_reset"?"世代交代補正（試合ではない）":esc(e.tournament||"")}<div class="school-meta">${e.event_type==="generation_reset"?"夏の敗退後／次世代へ65%持越し":esc(e.round||"")}</div></td>
              <td>${esc(e.opponent||"")}</td>
              <td>${e.event_type==="generation_reset"?"—":esc(e.score_for)+"-"+esc(e.score_against)}</td>
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
  wireHistoryChartPoints(body,rankRows,events);
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


const RATING_REBUILD_REQUEST_PATH="master/rating_rebuild_request.json";
let ratingRebuildPollTimer=null;

function setManualRatingRebuildStatus(text,state=""){
  const el=document.getElementById("manualRatingRebuildStatus");
  if(!el) return;
  el.textContent=text||"";
  el.className=`rating-rebuild-status ${state}`.trim();
}

async function getGithubContentSha(path){
  const cfg=loadGitHubSyncConfig();
  try{
    const data=await githubApi(`/contents/${path}?ref=${encodeURIComponent(cfg.branch||"main")}`);
    return data?.sha||"";
  }catch(err){
    if(String(err?.message||err).includes("GitHub 404")) return "";
    throw err;
  }
}

async function putGithubJsonFile(path,obj,message){
  const cfg=loadGitHubSyncConfig();
  let sha=await getGithubContentSha(path);
  const body={
    message,
    branch:cfg.branch||"main",
    content:utf8ToBase64(JSON.stringify(obj,null,2)+"\n")
  };
  if(sha) body.sha=sha;
  return githubApi(`/contents/${path}`,{
    method:"PUT",
    headers:{"Content-Type":"application/json"},
    body:JSON.stringify(body)
  });
}


const RATING_PUBLICATION_STATUS_PATH="docs/data/publication_status.json";
async function readRatingPublicationStatus(){
  const f=await fetchGithubJsonFile(RATING_PUBLICATION_STATUS_PATH);
  return f?.state||{};
}
function ratingTimeJP(iso){
  const t=Date.parse(iso||"");
  return Number.isFinite(t)?new Date(t).toLocaleString("ja-JP",{timeZone:"Asia/Tokyo",hour12:false}):"不明";
}
async function manualRatingRebuild(){
  const cfg=loadGitHubSyncConfig();
  if(!cfg.owner||!cfg.repo||!githubSessionToken){
    alert("先にGitHub同期設定を行ってください。");return;
  }
  const btn=document.getElementById("manualRatingRebuildBtn");
  if(btn)btn.disabled=true;
  setManualRatingRebuildStatus("台帳の保存状態を確認中…","working");
  try{
    if(matchSaveQueue.length||matchSaveInFlight||matchSaveDirty||matchSaveCommittedSequence<matchSaveSequence){
      await flushMatchEditsSave();
      if(matchSaveQueue.length||matchSaveInFlight||matchSaveDirty||matchSaveCommittedSequence<matchSaveSequence)
        throw new Error("台帳保存が完了していません。先に保存結果を確認してください。");
    }
    if(masterSaveInFlight||masterSaveDirty)throw new Error("学校マスタ保存が未完了です。");
    const oldStatus=await readRatingPublicationStatus().catch(()=>({}));
    const requestedAt=new Date().toISOString();
    const requestResult=await putGithubJsonFile(RATING_REBUILD_REQUEST_PATH,{
      requested_at:requestedAt,requested_from:"pages-ui",
      nonce:`${Date.now()}-${Math.random().toString(36).slice(2,8)}`
    },"Request manual Rating rebuild");
    const reqCommit=requestResult?.commit?.sha||"";
    // The file-change trigger is authoritative. Explicit dispatch is best-effort
    // and MUST NOT cause a second user-visible failure if permissions disallow it.
    const dispatched=await dispatchRatingRebuildBestEffort();
    setManualRatingRebuildStatus(
      `再計算を要求済み（${ratingTimeJP(requestedAt)}）。${dispatched?"Actions起動も依頼済み。":"GitHubの変更通知から起動待ち。"} 結果を確認しています…`,"working");
    startRatingRebuildPolling({requestedAt,previousTime:oldStatus.calculated_at||"",requestCommit:reqCommit});
  }catch(err){
    console.error(err);
    setManualRatingRebuildStatus(`再計算要求に失敗：${err.message||err}`,"error");
    if(btn)btn.disabled=false;
  }
}
function startRatingRebuildPolling({requestedAt,previousTime,requestCommit}){
  if(ratingRebuildPollTimer)clearTimeout(ratingRebuildPollTimer);
  const started=Date.now();
  let checks=0;
  async function tick(){
    checks++;
    try{
      // Use the authoritative calculated_at, not the rating CSV blob SHA.
      // The CSV can remain identical after a legitimate successful rebuild.
      const pub=await readRatingPublicationStatus();
      const published=pub.calculated_at||"";
      if(Date.parse(published)>Date.parse(requestedAt)){
        setManualRatingRebuildStatus(`再計算・公開完了：${ratingTimeJP(published)}。画面を更新します。`,"done");
        const btn=document.getElementById("manualRatingRebuildBtn");
        if(btn)btn.disabled=false;
        setTimeout(()=>location.reload(),1000);
        return;
      }
      const elapsed=Math.floor((Date.now()-started)/1000);
      setManualRatingRebuildStatus(
        `再計算要求済み：${ratingTimeJP(requestedAt)} / 最終公開：${ratingTimeJP(published||previousTime)} / 経過${elapsed}秒。計算・公開の完了を確認中。`,
        "working");
    }catch(err){
      setManualRatingRebuildStatus(`再計算要求済み：${ratingTimeJP(requestedAt)} / 公開状況を取得できません（${String(err.message||err).slice(0,90)}）。`,"waiting");
    }
    if(Date.now()-started>=10*60*1000){
      setManualRatingRebuildStatus(
        `再計算要求済み（${ratingTimeJP(requestedAt)}）。10分経過しても公開を確認できません。GitHub Actionsの失敗・待機を確認してください。再読込だけでは解消しません。`,"error");
      const btn=document.getElementById("manualRatingRebuildBtn");if(btn)btn.disabled=false;
      return;
    }
    ratingRebuildPollTimer=setTimeout(tick,8000);
  }
  tick();
}

function setupMasterUi(){
  document.getElementById("cleanupLegacyUnionSchoolsTopBtn")?.addEventListener("click",cleanupLegacyUnionSchools);
  if(masterUiSetupDone) return;
  masterUiSetupDone = true;
  document.getElementById("manualRatingRebuildBtn")?.addEventListener("click",manualRatingRebuild);
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
  document.getElementById("generationAuditBtn")?.addEventListener("click",openGenerationAudit);
  document.getElementById("qualifierBiasAuditBtn")?.addEventListener("click",openQualifierBiasAudit);
}




const IMPORT_REQUESTS_PATH="master/import_requests.json";
const IMPORT_QUEUE_DIR="master/import_queue";
const IMPORT_AUDIT_PATH="master/import_audit.json";
const IMPORT_AUDIT_LIVE_PATH="master/import_audit_live.json";
const IMPORT_AUDIT_URL="data/import_audit.json";
const IMPORT_AUDIT_LIVE_URL="data/import_audit_live.json";

const IMPORT_POLL_INTERVAL_MS=3000;
const IMPORT_POLL_MAX_MS=600000;
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

function startImportRatingFollowup(beforeSha,registeredDetail){
  const started=Date.now();
  const tick=async()=>{
    try{
      const nowSha=await getGithubContentSha("output/current_ratings.csv");
      if(beforeSha && nowSha && nowSha!==beforeSha){
        setImportProgress("done","Rating更新完了",`${registeredDetail} / 最新ランキングまで再計算されました。`);
        localStorage.setItem("hsbbl_last_import_state","completed");
        return;
      }
    }catch(err){ console.warn("import rating followup failed",err); }
    if(Date.now()-started>210000){
      setImportProgress("waiting","台帳登録は完了済み",`${registeredDetail} / Rating再計算の完了確認だけ取得できていません。登録自体は完了しています。`);
      return;
    }
    const sec=Math.round((Date.now()-started)/1000);
    setImportProgress("working","台帳登録完了 → Rating再計算中",`${registeredDetail} / Rating更新を確認中 ${sec}秒`);
    setTimeout(tick,5000);
  };
  tick();
}

function startImportPolling(requestId,{approval=false}={}){
  if(!requestId) return;
  stopImportPolling();
  importPollTargetRequestId=requestId;
  importPollStartedAt=Date.now();
  setImportProgress("working",approval?"登録処理中…":"解析処理中…","高速取込で処理しています。解析はRating再計算・Pages更新を待ちません。");

  const tick=async()=>{
    const elapsed=Date.now()-importPollStartedAt;
    if(elapsed>IMPORT_POLL_MAX_MS){
      setImportProgress("error","解析結果を取得できませんでした","10分以内に結果が返りませんでした。大会取込Actionsの実行状況を確認してください。");
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
          const batchId=localStorage.getItem("hsbbl_last_import_batch_id")||"";
          if(item.action==="batch_approve" && batchId){ renderImportBatchAudit(data,batchId); }
          else renderImportAudit(data);
          const added=Number(item.added_matches ?? item.matches?.length ?? 0);
          const removed=Number(item.removed_matches||0);
          const tournaments=Number(item.completed_targets||0);
          const failed=Number(item.failed_targets||0);
          const detail=item.action==="batch_approve"
            ? `${tournaments}大会 / 追加${added}試合${removed?` / 置換除外${removed}試合`:""}${failed?` / 未登録${failed}大会`:""}`
            : `${added}試合を本番CSVへ登録`;
          stopImportPolling();
          if(added>0){
            const beforeSha=localStorage.getItem("hsbbl_import_rating_sha_before")||"";
            startImportRatingFollowup(beforeSha,detail);
          }else{
            setImportProgress("done","登録確認完了",`${detail}。追加0試合のため既存データと一致している可能性があります。`);
            localStorage.setItem("hsbbl_last_import_state","completed");
          }
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
          const isBatch=String(requestId).startsWith("batch-") || String(requestId).startsWith("discover-") || item.status==="batch_review";
          if(isBatch){
            renderImportAudit(data);
          }else{
            renderImportAudit({...(data||{}),items:[item]});
          }
          if(item.status==="batch_review"){
            const reviewCount=Number(item.review_count||0);
            const errorCount=Number(item.error_count||0);
            const discovered=Number(item.discovered_count||0);
            setImportProgress("done","一括解析完了",`${discovered} URLを処理しました。登録待ち ${reviewCount}件 / エラー ${errorCount}件。下の一覧を確認してください。`);
            localStorage.setItem("hsbbl_last_import_state","review");
            stopImportPolling();
            return;
          }
          if(item.status==="review"){
            setImportProgress("done","解析完了",`${item.matches?.length||0}試合を認識しました。下の内容を確認してください。`);
            localStorage.setItem("hsbbl_last_import_state","review");
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
      const shortId=String(requestId).slice(-8);
      setImportProgress("working",approval?"登録処理中…":"解析処理中…",`${sec}秒経過。依頼ID ${shortId} の結果を確認中です。前回結果は現在の依頼結果ではありません。`);
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

  const rid=String(req?.request_id||"").trim();
  if(!rid) throw new Error("request_idがありません");

  // Each request gets its own file. This avoids all SHA contention on the old
  // master/import_requests.json shared queue.
  const safeId=rid.replace(/[^A-Za-z0-9._-]/g,"_");
  const path=`${IMPORT_QUEUE_DIR}/${safeId}.json`;
  const content=utf8ToBase64(JSON.stringify(req,null,2)+"\n");

  let lastErr=null;
  for(let attempt=1;attempt<=6;attempt++){
    try{
      // Normally this is a brand-new path and requires no sha.
      // If a retry sees the file already created, treat identical content as success.
      let existing=null;
      try{ existing=await fetchGithubJsonFile(path); }catch(e){}
      if(existing?.state){
        if(String(existing.state.request_id||"")===rid) return {already_exists:true,content:{sha:existing.sha||""}};
      }

      return await githubApi(`/contents/${path}`,{
        method:"PUT",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({
          message:`Tournament import request: ${req.action||"analyze"} ${rid}`,
          branch:cfg.branch||"main",
          content
        })
      });
    }catch(err){
      lastErr=err;
      const msg=String(err?.message||err);
      const transient=/GitHub (409|422|429|500|502|503|504)/.test(msg) || /secondary rate limit|timeout|network/i.test(msg);
      if(!transient || attempt===6) break;
      await new Promise(r=>setTimeout(r,[250,500,900,1400,2100,3000][attempt-1]));
    }
  }
  throw lastErr||new Error("大会取込依頼の保存に失敗しました");
}
async function dispatchImportWorkflowBestEffort(){
  const cfg=loadGitHubSyncConfig();
  if(!cfg.owner||!cfg.repo||!githubSessionToken){
    return {ok:false,error:"GitHub同期設定がありません"};
  }
  let lastErr=null;
  for(let attempt=1;attempt<=3;attempt++){
    try{
      await githubApi(`/actions/workflows/process_import_requests.yml/dispatches`,{
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({ref:cfg.branch||"main"})
      });
      return {ok:true};
    }catch(err){
      lastErr=err;
      if(attempt<3) await new Promise(r=>setTimeout(r,400*attempt));
    }
  }
  return {ok:false,error:String(lastErr?.message||lastErr||"workflow dispatch failed")};
}


function importRegionForPref(pref){
  return DISTRICT_TO_REGION[PREF_TO_DISTRICT[pref]||""]||"";
}

function setupImportUi(){
  const pref=document.getElementById("importPrefecture");
  if(pref && pref.options.length<=1){
    sortPrefectureNames(MASTER_PREFECTURES.filter(x=>!["不明","北北海道","南北海道","東東京","西東京"].includes(x)))
      .forEach(p=>{
        const o=document.createElement("option"); o.value=p; o.textContent=p; pref.appendChild(o);
      });
  }
  const syncImportGeo=()=>{
    const level=document.getElementById("importLevel")?.value||"prefecture";
    const upper=level==="regional"||level==="national";
    document.getElementById("importPrefectureLabel")?.classList.toggle("hidden",upper);
    document.getElementById("importRegionLabel")?.classList.toggle("hidden",!upper);
    if(level==="national"){const r=document.getElementById("importRegion");if(r)r.value="全国";}
  };
  document.getElementById("importLevel")?.addEventListener("change",syncImportGeo);syncImportGeo();
  document.getElementById("importAnalyzeBtn")?.addEventListener("click",submitImportAnalyze);
  document.getElementById("importBatchAnalyzeBtn")?.addEventListener("click",submitImportBatchAnalyze);
  document.getElementById("importBatchFastRegisterBtn")?.addEventListener("click",submitImportBatchFastRegister);
  document.getElementById("importDiscoverBtn")?.addEventListener("click",submitImportDiscover);
  document.getElementById("importDiscoverAll89Btn")?.addEventListener("click",()=>{
    const el=document.getElementById("importDiscoverUrl");
    if(el) el.value="https://koshien89.com/";
    const status=document.getElementById("importBatchStatus");
    if(status) status.textContent="89サイト全体を対象にしました。年範囲を指定して解析してください。";
  });
  document.getElementById("importAuditReloadBtn")?.addEventListener("click",loadImportAudit);
  setTimeout(resumeImportPollingIfNeeded,200);
}


function importBatchDefaults(){
  const year=String(document.getElementById("importYear")?.value||"").trim();
  const season=document.getElementById("importSeason")?.value||"";
  const prefecture=document.getElementById("importPrefecture")?.value||"";
  const level=document.getElementById("importLevel")?.value||"prefecture";
  const selectedRegion=document.getElementById("importRegion")?.value||"";
  const tournament=String(document.getElementById("importTournamentName")?.value||"").trim();
  const import_mode=document.getElementById("importMode")?.value||"replace";
  return {
    year:/^\d{4}$/.test(year)?Number(year):"",
    season,prefecture,level,
    region:level==="national"?"全国":(level==="regional"?selectedRegion:importRegionForPref(prefecture)),
    tournament,import_mode,
    batch_auto_metadata:document.getElementById("importBatchAutoMeta")?.checked!==false
  };
}
function cleanBatchUrls(text){
  const out=[];
  for(const line of String(text||"").split(/\r?\n/)){
    const u=line.trim();
    if(/^https?:\/\//i.test(u) && !out.includes(u)) out.push(u);
  }
  return out.slice(0,120);
}
async function submitImportBatchAnalyze(){
  const urls=cleanBatchUrls(document.getElementById("importBatchUrls")?.value||"");
  const status=document.getElementById("importBatchStatus");
  if(!urls.length){alert("URLを1行1件で入力してください");return;}
  const id=`batch-${Date.now()}-${Math.random().toString(36).slice(2,8)}`;
  const req={
    request_id:id,action:"batch_analyze",created_at:new Date().toISOString(),
    urls,...importBatchDefaults()
  };
  try{
    if(status) status.textContent=`${urls.length}件の一括解析依頼を送信中…`;
    await appendImportRequest(req);
    localStorage.setItem("hsbbl_last_import_batch_id",id);
    localStorage.setItem("hsbbl_last_import_request_id",id);
    localStorage.setItem("hsbbl_last_import_state","analyze");
    if(status) status.textContent=`${urls.length}件を送信しました。最大6件ずつ並列解析します。`;
    setImportProgress("working","一括解析中",`${urls.length} URLを最大6件ずつ並列処理しています。`);
    startImportPolling(id,{approval:false});
  }catch(err){
    if(status) status.textContent=`送信失敗：${err.message}`;
  }
}

async function submitImportBatchFastRegister(){
  const all=cleanBatchUrls(document.getElementById("importBatchUrls")?.value||"");
  const status=document.getElementById("importBatchStatus");
  if(!all.length){alert("koshien89の結果URLを1行1件で入力してください");return;}
  if(all.length>10){alert("高速登録は1回10URLまでです。10件ずつに分けてください。");return;}
  const bad=all.filter(u=>!/^https?:\/\/(?:www\.)?koshien89\.com\/blog-entry-\d+\.html(?:[?#].*)?$/i.test(u));
  if(bad.length){
    alert(`89高速登録は koshien89.com の大会結果ページ専用です。\n\n対象外: ${bad.slice(0,3).join("\n")}`);
    return;
  }
  if(!confirm(`${all.length} URLを解析し、年・季節・県・大会名を自動判定して、そのまま本番台帳へ登録します。よろしいですか？`)) return;

  const id=`batch-fast-${Date.now()}-${Math.random().toString(36).slice(2,8)}`;
  const req={
    request_id:id,action:"batch_register",created_at:new Date().toISOString(),
    urls:all,...importBatchDefaults(),batch_auto_metadata:true
  };
  try{
    const btn=document.getElementById("importBatchFastRegisterBtn");
    if(btn){btn.disabled=true;btn.textContent="高速登録依頼中…";}
    if(status) status.textContent=`${all.length}件を1回のActionsで解析→登録します…`;
    await appendImportRequest(req);
    localStorage.setItem("hsbbl_last_import_batch_id",id);
    localStorage.setItem("hsbbl_last_import_request_id",id);
    localStorage.setItem("hsbbl_last_import_state","analyze");
    setImportProgress("working","89高速登録中",`${all.length} URLを最大10件並列で解析し、そのまま本番CSVへ登録しています。`);
    startImportPolling(id,{approval:false});
  }catch(err){
    if(status) status.textContent=`高速登録の送信失敗：${err.message}`;
  }finally{
    const btn=document.getElementById("importBatchFastRegisterBtn");
    if(btn){btn.disabled=false;btn.textContent="89高速登録（最大10URL）";}
  }
}
async function submitImportDiscover(){
  const source_url=String(document.getElementById("importDiscoverUrl")?.value||"").trim();
  if(!/^https?:\/\//i.test(source_url)){alert("一覧ページURLを入力してください");return;}
  const id=`discover-${Date.now()}-${Math.random().toString(36).slice(2,8)}`;
  const year_from=String(document.getElementById("importDiscoverYearFrom")?.value||"").trim();
  const year_to=String(document.getElementById("importDiscoverYearTo")?.value||"").trim();
  const discover_seasons=[];
  if(document.getElementById("importDiscoverSpring")?.checked) discover_seasons.push("spring");
  if(document.getElementById("importDiscoverSummer")?.checked) discover_seasons.push("summer");
  if(document.getElementById("importDiscoverAutumn")?.checked) discover_seasons.push("autumn");
  const siteWide=/^https?:\/\/(?:www\.)?koshien89\.com\/?(?:index\.html)?(?:[?#].*)?$/i.test(source_url);
  const req={
    request_id:id,action:"discover",created_at:new Date().toISOString(),
    source_url,limit:siteWide?1200:120,year_from,year_to,discover_seasons,
    follow_pagination:document.getElementById("importDiscoverPagination")?.checked!==false,
    ...importBatchDefaults()
  };
  try{
    const status=document.getElementById("importBatchStatus");
    if(status) status.textContent="一覧ページの展開依頼を送信中…";
    await appendImportRequest(req);
    localStorage.setItem("hsbbl_last_import_batch_id",id);
    localStorage.setItem("hsbbl_last_import_request_id",id);
    localStorage.setItem("hsbbl_last_import_state","analyze");
    setImportProgress("working",siteWide?"89サイト全体を展開中":"カテゴリを展開中",`${year_from||"指定なし"}年〜${year_to||"最新"} / ${discover_seasons.map(seasonLabel).join("・")||"全季節"} を抽出し、最大6件ずつ解析します。`);
    startImportPolling(id,{approval:false});
  }catch(err){
    alert(`一覧ページ解析依頼に失敗しました\n${err.message}`);
  }
}
let importBatchDrilldown=false;

const IMPORT_LEVEL_OPTIONS=[
  ["prefecture","県大会"],
  ["regional","地区大会"],
  ["national","全国大会"],
  ["district_qualifier","地区予選"],
  ["branch","支部大会"],
  ["preliminary","予選"]
];
const IMPORT_SEASON_OPTIONS=[
  ["spring","春"],["summer","夏"],["autumn","秋"],
  ["senbatsu","選抜"],["koshien","選手権"],["jingu","神宮"]
];
function importBatchPrefOptions(selected){
  const prefs=sortPrefectureNames(MASTER_PREFECTURES.filter(x=>!["不明"].includes(x)));
  return `<option value="">未設定</option>${prefs.map(p=>`<option value="${esc(p)}" ${p===selected?"selected":""}>${esc(p)}</option>`).join("")}`;
}
function importBatchSeasonOptions(selected){
  return IMPORT_SEASON_OPTIONS.map(([v,l])=>`<option value="${v}" ${v===selected?"selected":""}>${l}</option>`).join("");
}
function importBatchLevelOptions(selected){
  return IMPORT_LEVEL_OPTIONS.map(([v,l])=>`<option value="${v}" ${v===selected?"selected":""}>${l}</option>`).join("");
}
function importStandardTournamentName(meta){
  const y=String(meta.year||"").trim();
  const season=String(meta.season||"");
  const level=String(meta.level||"prefecture");
  const pref=String(meta.prefecture||"").trim();
  const region=level==="national"?"全国":(String(meta.region||"").trim() || importRegionForPref(pref));
  if(!y) return "";
  if(level==="national"){
    if(season==="senbatsu") return `選抜${y}`;
    if(season==="koshien") return `選手権${y}`;
    if(season==="jingu") return `神宮${y}`;
    return `全国${y}`;
  }
  if(level==="regional"){
    if(season==="spring") return `春季${region}${y}`;
    if(season==="autumn") return `秋季${region}${y}`;
    return `${region}${y}`;
  }
  if(season==="spring") return `春季${region}${pref}${y}`;
  if(season==="summer") return `選手権${pref}${y}`;
  if(season==="autumn") return `秋季${region}${pref}${y}`;
  return `${pref}${y}`;
}
function readImportBatchMeta(card){
  const year=String(card.querySelector("[data-batch-year]")?.value||"").trim();
  const season=String(card.querySelector("[data-batch-season]")?.value||"");
  const prefecture=String(card.querySelector("[data-batch-pref]")?.value||"");
  const level=String(card.querySelector("[data-batch-level]")?.value||"prefecture");
  let region=level==="national"?"全国":importRegionForPref(prefecture);
  if(level==="regional"){
    region=String(card.querySelector("[data-batch-region]")?.value||region||"");
  }
  const tournament=String(card.querySelector("[data-batch-tournament]")?.value||"").trim();
  return {year,season,prefecture:level==="national"?"":prefecture,level,region,tournament};
}
function refreshImportBatchCard(card,{regenerateName=false}={}){
  const meta=readImportBatchMeta(card);
  const regionEl=card.querySelector("[data-batch-region]");
  if(regionEl && meta.level!=="regional"){
    regionEl.value=meta.region||"";
  }
  if(regenerateName){
    const t=card.querySelector("[data-batch-tournament]");
    if(t) t.value=importStandardTournamentName(meta);
  }
}
function collectImportBatchOverrides(area){
  const out={};
  area.querySelectorAll("[data-batch-card]").forEach(card=>{
    const id=card.dataset.batchCard;
    if(id) out[id]=readImportBatchMeta(card);
  });
  return out;
}

function collectImportBatchSelectedIds(area, review){
  const allowed=new Set((review||[]).map(x=>x.request_id));
  return [...area.querySelectorAll("[data-batch-card]")].filter(card=>{
    if(!allowed.has(card.dataset.batchCard)) return false;
    const cb=card.querySelector("[data-batch-include]");
    return cb ? cb.checked : true;
  }).map(card=>card.dataset.batchCard);
}

function updateImportBatchApproveButton(area, review){
  const btn=document.getElementById("importBatchApproveAllBtn");
  if(!btn) return;
  const selected=collectImportBatchSelectedIds(area,review);
  btn.disabled=!selected.length;
  btn.textContent=`選択した大会を一括登録 (${selected.length})`;
}

function renderImportBatchAudit(data,batchId){
  const area=document.getElementById("importAuditArea");
  const items=Array.isArray(data?.items)?data.items:[];
  const parent=items.find(x=>x.request_id===batchId);
  const children=items.filter(x=>x.batch_id===batchId && x.action==="analyze");
  if(!children.length){
    area.innerHTML=`<div class="empty-state"><h3>${parent?.status==="error"?"一括解析失敗":"一括解析中"}</h3>
      <p>${esc((parent?.warnings||[]).join(" / ")||"Actionsの完了を待っています。")}</p></div>`;
    return;
  }
  const review=children.filter(x=>x.status==="review");
  const completed=children.filter(x=>x.status==="completed");
  const errors=children.filter(x=>x.status==="error");

  area.innerHTML=`
    <div class="import-batch-summary">
      <div>
        <h3>一括解析結果</h3>
        <p>${children.length} URL / 登録待ち ${review.length} / 登録済み ${completed.length} / エラー ${errors.length}</p>
        <p class="school-meta">登録前に不要な大会を除外し、年・季節・県・階層・大会名を確認してください。「試合確認」では試合単位の除外・修正もできます。</p>
      </div>
      <button type="button" class="save-btn" id="importBatchApproveAllBtn" ${review.length?"":"disabled"}>選択した大会を一括登録 (${review.length})</button>
    </div>

    <div class="import-batch-tools">
      <button type="button" class="ghost" id="batchSelectAllBtn">登録待ちを全選択</button>
      <button type="button" class="ghost" id="batchSelectNoneBtn">全解除</button>
      <label>全件の年 <input id="batchSetYear" inputmode="numeric" maxlength="4" placeholder="例 2021"></label>
      <label>全件の季節 <select id="batchSetSeason"><option value="">変更しない</option>${importBatchSeasonOptions("")}</select></label>
      <label>全件の階層 <select id="batchSetLevel"><option value="">変更しない</option>${importBatchLevelOptions("")}</select></label>
      <button type="button" class="ghost" id="batchApplyCommonBtn">共通条件を反映</button>
      <button type="button" class="ghost" id="batchRegenerateNamesBtn">大会名を統一規則で再生成</button>
    </div>

    <div class="import-batch-results">
      ${children.map(x=>{
        const editable=x.status==="review";
        const region=x.region||importRegionForPref(x.prefecture||"")||"";
        return `<div class="import-batch-result ${esc(x.status||"")}" data-batch-card="${esc(x.request_id)}">
          <div class="import-batch-select-row">
            <label class="import-include-toggle"><input type="checkbox" data-batch-include ${editable?"checked":"disabled"}> <strong>${editable?"この大会を登録対象にする":"登録済み/対象外"}</strong></label>
          </div>
          <div class="import-batch-meta-grid">
            <label>年
              <input data-batch-year inputmode="numeric" maxlength="4" value="${esc(String(x.year||""))}" ${editable?"":"disabled"}>
            </label>
            <label>季節
              <select data-batch-season ${editable?"":"disabled"}>${importBatchSeasonOptions(x.season||"")}</select>
            </label>
            <label>都道府県
              <select data-batch-pref ${editable?"":"disabled"}>${importBatchPrefOptions(x.prefecture||"")}</select>
            </label>
            <label>階層
              <select data-batch-level ${editable?"":"disabled"}>${importBatchLevelOptions(x.level||"prefecture")}</select>
            </label>
            <label>地区
              <input data-batch-region value="${esc(region)}" ${editable?"":"disabled"}>
            </label>
            <label class="import-batch-tournament-label">大会名
              <input data-batch-tournament value="${esc(x.tournament||"")}" ${editable?"":"disabled"}>
            </label>
          </div>
          <div class="import-batch-source">${esc(x.detected_title||"")}<br><small>${esc(x.source_url||"")}</small></div>
          <div class="import-batch-result-stat">
            <b>${(x.matches||[]).length}試合</b>
            <span>${esc(x.status||"")}</span>
            <button type="button" class="ghost" data-open-import-child="${esc(x.request_id)}">試合確認</button>
          </div>
          ${(x.warnings||[]).length?`<div class="import-batch-warn">${x.warnings.map(w=>`⚠ ${esc(w)}`).join("<br>")}</div>`:""}
        </div>`;
      }).join("")}
    </div>`;

  area.querySelectorAll("[data-batch-card]").forEach(card=>{
    if(!review.some(x=>x.request_id===card.dataset.batchCard)) return;
    ["[data-batch-year]","[data-batch-season]","[data-batch-pref]","[data-batch-level]"].forEach(sel=>{
      card.querySelector(sel)?.addEventListener("change",()=>refreshImportBatchCard(card,{regenerateName:false}));
    });
  });

  area.querySelectorAll("[data-batch-include]").forEach(cb=>cb.addEventListener("change",()=>{
    cb.closest("[data-batch-card]")?.classList.toggle("is-excluded",!cb.checked);
    updateImportBatchApproveButton(area,review);
  }));
  document.getElementById("batchSelectAllBtn")?.addEventListener("click",()=>{
    area.querySelectorAll("[data-batch-card]").forEach(card=>{
      if(!review.some(x=>x.request_id===card.dataset.batchCard)) return;
      const cb=card.querySelector("[data-batch-include]"); if(cb){cb.checked=true;card.classList.remove("is-excluded");}
    });
    updateImportBatchApproveButton(area,review);
  });
  document.getElementById("batchSelectNoneBtn")?.addEventListener("click",()=>{
    area.querySelectorAll("[data-batch-card]").forEach(card=>{
      if(!review.some(x=>x.request_id===card.dataset.batchCard)) return;
      const cb=card.querySelector("[data-batch-include]"); if(cb){cb.checked=false;card.classList.add("is-excluded");}
    });
    updateImportBatchApproveButton(area,review);
  });

  document.getElementById("batchApplyCommonBtn")?.addEventListener("click",()=>{
    const year=String(document.getElementById("batchSetYear")?.value||"").trim();
    const season=String(document.getElementById("batchSetSeason")?.value||"");
    const level=String(document.getElementById("batchSetLevel")?.value||"");
    area.querySelectorAll("[data-batch-card]").forEach(card=>{
      if(!review.some(x=>x.request_id===card.dataset.batchCard)) return;
      if(year && /^\d{4}$/.test(year)){const el=card.querySelector("[data-batch-year]");if(el)el.value=year;}
      if(season){const el=card.querySelector("[data-batch-season]");if(el)el.value=season;}
      if(level){const el=card.querySelector("[data-batch-level]");if(el)el.value=level;}
      refreshImportBatchCard(card,{regenerateName:false});
    });
  });

  document.getElementById("batchRegenerateNamesBtn")?.addEventListener("click",()=>{
    area.querySelectorAll("[data-batch-card]").forEach(card=>{
      if(review.some(x=>x.request_id===card.dataset.batchCard)){
        refreshImportBatchCard(card,{regenerateName:true});
      }
    });
  });

  area.querySelectorAll("[data-open-import-child]").forEach(btn=>btn.addEventListener("click",()=>{
    const x=children.find(v=>v.request_id===btn.dataset.openImportChild);
    if(!x) return;
    // Save current batch metadata edits locally so returning does not lose them.
    localStorage.setItem(`hsbbl_batch_meta_${batchId}`,JSON.stringify(collectImportBatchOverrides(area)));
    localStorage.setItem(`hsbbl_batch_selection_${batchId}`,JSON.stringify(collectImportBatchSelectedIds(area,review)));
    importBatchDrilldown=true;
    localStorage.setItem("hsbbl_last_import_request_id",x.request_id);
    renderImportAudit(data);
    importBatchDrilldown=false;
  }));

  // Restore unsent edits after returning from a child preview.
  try{
    const saved=JSON.parse(localStorage.getItem(`hsbbl_batch_meta_${batchId}`)||"{}");
    for(const [id,meta] of Object.entries(saved)){
      const card=area.querySelector(`[data-batch-card="${CSS.escape(id)}"]`);
      if(!card) continue;
      const set=(sel,v)=>{const el=card.querySelector(sel);if(el && v!==undefined && v!==null) el.value=String(v);};
      set("[data-batch-year]",meta.year);
      set("[data-batch-season]",meta.season);
      set("[data-batch-pref]",meta.prefecture);
      set("[data-batch-level]",meta.level);
      set("[data-batch-region]",meta.region);
      set("[data-batch-tournament]",meta.tournament);
    }
  }catch{}
  try{
    const raw=localStorage.getItem(`hsbbl_batch_selection_${batchId}`);
    if(raw){
      const selected=new Set(JSON.parse(raw)||[]);
      area.querySelectorAll("[data-batch-card]").forEach(card=>{
        if(!review.some(x=>x.request_id===card.dataset.batchCard)) return;
        const cb=card.querySelector("[data-batch-include]");
        if(cb){cb.checked=selected.has(card.dataset.batchCard);card.classList.toggle("is-excluded",!cb.checked);}
      });
    }
  }catch{}
  updateImportBatchApproveButton(area,review);

  document.getElementById("importBatchApproveAllBtn")?.addEventListener("click",async()=>{
    if(!review.length) return;
    const selectedIds=collectImportBatchSelectedIds(area,review);
    const selectedReview=review.filter(x=>selectedIds.includes(x.request_id));
    if(!selectedReview.length){ alert("登録する大会を1件以上選択してください。"); return; }
    const metadata_overrides=collectImportBatchOverrides(area);
    const match_overrides={};
    for(const x of selectedReview){
      try{
        const saved=JSON.parse(localStorage.getItem(`hsbbl_import_match_edits_${x.request_id}`)||"null");
        if(Array.isArray(saved)) match_overrides[x.request_id]=saved;
      }catch{}
    }
    const invalid=[];
    for(const x of selectedReview){
      const m=metadata_overrides[x.request_id]||{};
      if(!/^\d{4}$/.test(String(m.year||""))) invalid.push(`${x.source_url}: 年`);
      if(!m.season) invalid.push(`${x.source_url}: 季節`);
      if(!m.tournament) invalid.push(`${x.source_url}: 大会名`);
      if(m.level==="prefecture" && !m.prefecture) invalid.push(`${x.source_url}: 都道府県`);
      if(m.level==="regional" && !m.region) invalid.push(`${x.source_url}: 地区`);
    }
    if(invalid.length){
      alert(`登録前に未設定項目を直してください。\n\n${invalid.slice(0,12).join("\n")}${invalid.length>12?`\nほか${invalid.length-12}件`:""}`);
      return;
    }
    if(!confirm(`${selectedReview.length}大会を一括登録します。チェックを外した大会・試合は登録しません。よろしいですか？`)) return;

    const btn=document.getElementById("importBatchApproveAllBtn");
    btn.disabled=true;btn.textContent="一括登録依頼中…";
    try{
      const approvalId=`batch-approve-${Date.now()}-${Math.random().toString(36).slice(2,7)}`;
      let ratingShaBefore="";
      try{ ratingShaBefore=await getGithubContentSha("output/current_ratings.csv"); }catch{}
      await appendImportRequest({
        request_id:approvalId,
        action:"batch_approve",created_at:new Date().toISOString(),
        target_request_ids:selectedReview.map(x=>x.request_id),
        metadata_overrides,
        match_overrides,
        import_mode:"replace"
      });
      localStorage.removeItem(`hsbbl_batch_meta_${batchId}`);
      localStorage.removeItem(`hsbbl_batch_selection_${batchId}`);
      localStorage.setItem("hsbbl_last_import_request_id",approvalId);
      localStorage.setItem("hsbbl_last_import_state","approve");
      localStorage.setItem("hsbbl_last_import_batch_id",batchId);
      localStorage.setItem("hsbbl_import_rating_sha_before",ratingShaBefore||"");
      setImportProgress("working","登録依頼済み",`${selectedReview.length}大会を本番CSVへ順番に登録しています。除外した大会・試合は登録しません。`);
      startImportPolling(approvalId,{approval:true});
    }catch(err){
      alert(`一括登録依頼に失敗しました\n${err.message}`);
      btn.disabled=false;updateImportBatchApproveButton(area,review);
    }
  });
}

async function submitImportAnalyze(){
  const year=String(document.getElementById("importYear")?.value||"").trim();
  const season=document.getElementById("importSeason")?.value||"";
  const prefecture=document.getElementById("importPrefecture")?.value||"";
  const level=document.getElementById("importLevel")?.value||"prefecture";
  const selectedRegion=document.getElementById("importRegion")?.value||"";
  const source_url=String(document.getElementById("importSourceUrl")?.value||"").trim();
  const tournament=String(document.getElementById("importTournamentName")?.value||"").trim();
  const import_mode=document.getElementById("importMode")?.value||"replace";
  const status=document.getElementById("importSubmitStatus");
  if(!/^\d{4}$/.test(year)){ alert("年を4桁で入力してください"); return; }
  const upperLevel=level==="regional"||level==="national";
  if(!upperLevel && !prefecture){ alert("都道府県を選択してください"); return; }
  if(level==="regional" && !selectedRegion){ alert("地区を選択してください"); return; }
  if(import_mode==="replace" && !tournament){ alert("置換モードでは大会名を入力してください"); return; }
  if(!/^https?:\/\//i.test(source_url)){ alert("結果ページURLを入力してください"); return; }

  const id=`${Date.now()}-${Math.random().toString(36).slice(2,8)}`;
  const req={
    request_id:id,
    action:"analyze",
    created_at:new Date().toISOString(),
    year:Number(year),season,prefecture:upperLevel?"":prefecture,level,
    region:level==="national"?"全国":(level==="regional"?selectedRegion:importRegionForPref(prefecture)),
    tournament,source_url,import_mode
  };
  try{
    if(status) status.textContent="GitHubへ解析依頼を送信中…";
    await appendImportRequest(req);
    if(status) status.textContent="解析依頼を保存しました。Actions起動を待っています…";
    localStorage.setItem("hsbbl_last_import_request_id",id);
    localStorage.setItem("hsbbl_last_import_state","analyze");
    const auditArea=document.getElementById("importAuditArea");
    if(auditArea) auditArea.innerHTML=`<div class="empty-state"><p>この依頼の解析結果を待っています…</p><small>${esc(id)}</small></div>`;
    startImportPolling(id,{approval:false});
  }catch(err){
    console.error(err);
    if(status) status.textContent=`送信失敗：${err.message}`;
  }
}


async function fetchImportAuditLatest(){
  // Poll a compact live audit first. The full audit is several MB and made the
  // import screen especially heavy on mobile.
  try{
    const cfg=loadGitHubSyncConfig();
    if(cfg?.owner && cfg?.repo && githubSessionToken){
      const live=await fetchGithubJsonFile(IMPORT_AUDIT_LIVE_PATH);
      if(live?.state) return live.state;
      const remote=await fetchGithubJsonFile(IMPORT_AUDIT_PATH);
      if(remote?.state) return remote.state;
    }
  }catch(err){
    console.warn("Direct GitHub live audit read failed; falling back to Pages",err);
  }

  try{
    const txt=await fetchTextWithTimeout(`${IMPORT_AUDIT_LIVE_URL}?fresh=${Date.now()}`,8000);
    return JSON.parse(txt);
  }catch(err){
    const txt=await fetchTextWithTimeout(`${IMPORT_AUDIT_URL}?fresh=${Date.now()}`,10000);
    return JSON.parse(txt);
  }
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
    if(item?.status==="batch_review"){
      localStorage.setItem("hsbbl_last_import_state","review");
      const reviewCount=Number(item.review_count||0);
      const errorCount=Number(item.error_count||0);
      setImportProgress("done","一括解析完了",`登録待ち ${reviewCount}件 / エラー ${errorCount}件。下の一覧を確認してください。`);
      stopImportPolling();
    }else if(item?.status==="review"){
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

function importEditableMatchFromRow(tr, original){
  const val=sel=>String(tr.querySelector(sel)?.value??"").trim();
  const inningsRaw=val("[data-import-innings]")||"9";
  const innings=Math.max(1,Math.min(30,Number(inningsRaw)||9));
  const finish=val("[data-import-finish]")||"normal";
  const round=val("[data-import-round]");
  const date=val("[data-import-date]")||String(original.date||"");
  const team1=val("[data-import-team1]")||String(original.team1||"");
  const team2=val("[data-import-team2]")||String(original.team2||"");
  const score1Raw=val("[data-import-score1]");
  const score2Raw=val("[data-import-score2]");
  const score1=score1Raw===""?original.score1:Number(score1Raw);
  const score2=score2Raw===""?original.score2:Number(score2Raw);
  return {...original,date,round,team1,score1,team2,score2,innings,finish_type:finish};
}

function collectImportEditedMatches(x){
  const rows=[...document.querySelectorAll("#importAuditArea tr[data-import-row]")];
  const originals=Array.isArray(x?.matches)?x.matches:[];
  if(!rows.length) return originals.map(m=>({...m}));
  return rows.filter(tr=>{
    const cb=tr.querySelector("[data-import-include]");
    return cb ? cb.checked : true;
  }).map(tr=>{
    const i=Number(tr.dataset.importRow)||0;
    return importEditableMatchFromRow(tr,originals[i]||{});
  });
}

function saveImportMatchDraft(x){
  if(!x?.request_id) return;
  try{ localStorage.setItem(`hsbbl_import_match_edits_${x.request_id}`,JSON.stringify(collectImportEditedMatches(x))); }catch{}
}

function normalizeImportFinishControls(tr){
  const inningsEl=tr.querySelector("[data-import-innings]");
  const finishEl=tr.querySelector("[data-import-finish]");
  if(!inningsEl||!finishEl) return;
  let n=Math.max(1,Math.min(30,Number(inningsEl.value)||9));
  let f=finishEl.value||"normal";
  if(f==="normal" && n>9) f="extra";
  if(f==="extra" && n<=9) n=10;
  if(f==="cold" && n>=9) n=7;
  if(f==="normal") n=9;
  inningsEl.value=String(n);
  finishEl.value=f;
}

function renderImportAudit(data){
  const area=document.getElementById("importAuditArea");
  if(!area) return;
  const items=Array.isArray(data?.items)?data.items:[];
  const batchId=localStorage.getItem("hsbbl_last_import_batch_id")||"";
  if(batchId && !importBatchDrilldown && items.some(x=>x.request_id===batchId || x.batch_id===batchId)){
    renderImportBatchAudit(data,batchId);
    return;
  }
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
  const editable=x.status!=="completed";
  area.innerHTML=`
    ${x.batch_id?`<div class="import-actions"><button type="button" class="ghost" id="importBackToBatchBtn">← 一括結果へ戻る</button></div>`:""}
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
    ${editable?`<div class="import-edit-help">
      登録する試合だけチェックを残してください。日付・回戦・学校名・得点・イニング・決着を登録前に直接修正できます。
      <button type="button" class="ghost" id="importSelectAllMatchesBtn">全試合を選択</button>
      <button type="button" class="ghost" id="importSelectNoMatchesBtn">全解除</button>
      <button type="button" class="ghost import-reset-nine" id="importSetAllNineBtn">全試合を9回通常</button>
      <strong id="importSelectedMatchCount"></strong>
    </div>`:""}
    <div class="import-preview-wrap">
      <table class="import-preview-table import-preview-editable">
        <thead><tr><th>登録</th><th>日付</th><th>回戦</th><th>学校1</th><th>得点</th><th>学校2</th><th>得点</th><th>回</th><th>決着</th></tr></thead>
        <tbody>${matches.map((m,i)=>`<tr data-import-row="${i}">
          <td>${editable?`<input type="checkbox" data-import-include checked aria-label="登録対象">`:"✓"}</td>
          <td>${editable?`<input class="import-date-input" data-import-date type="date" value="${esc(m.date||"")}" aria-label="日付">`:esc(m.date||"")}</td>
          <td>${editable
            ? `<input class="import-round-input" data-import-round value="${esc(m.round||"")}" aria-label="回戦">`
            : esc(m.round||"")}</td>
          <td>${editable?`<input class="import-team-input" data-import-team1 value="${esc(m.team1||"")}" aria-label="学校1">`:esc(m.team1||"")}</td>
          <td>${editable?`<input class="import-score-input" data-import-score1 type="number" min="0" max="99" value="${esc(String(m.score1??""))}" aria-label="得点1">`:esc(String(m.score1??""))}</td>
          <td>${editable?`<input class="import-team-input" data-import-team2 value="${esc(m.team2||"")}" aria-label="学校2">`:esc(m.team2||"")}</td>
          <td>${editable?`<input class="import-score-input" data-import-score2 type="number" min="0" max="99" value="${esc(String(m.score2??""))}" aria-label="得点2">`:esc(String(m.score2??""))}</td>
          <td>${editable
            ? `<input class="import-innings-input" data-import-innings type="number" min="1" max="30" step="1" value="${esc(String(m.innings||9))}" aria-label="イニング">`
            : esc(String(m.innings||9))}</td>
          <td>${editable
            ? `<select class="import-finish-select" data-import-finish aria-label="決着">
                <option value="normal" ${m.finish_type==="normal"||!m.finish_type?"selected":""}>通常</option>
                <option value="cold" ${m.finish_type==="cold"?"selected":""}>コールド</option>
                <option value="extra" ${m.finish_type==="extra"?"selected":""}>延長</option>
              </select>`
            : (m.finish_type==="cold"?"コールド":m.finish_type==="extra"?"延長":"通常")}</td>
        </tr>`).join("")}</tbody>
      </table>
    </div>
    <div class="import-actions">
      <button type="button" class="save-btn" id="importApproveBtn" ${!matches.length||x.status==="completed"?"disabled":""}>
        ${x.status==="completed"?"登録済み":"修正内容で登録"}
      </button>
      <span class="school-meta">${editable?"ここで直した値をそのまま本番台帳へ登録します。":"登録済みの解析結果です。"}</span>
    </div>`;

  if(editable){
    const updateSelectedCount=()=>{
      const rows=[...area.querySelectorAll("tr[data-import-row]")];
      const n=rows.filter(tr=>tr.querySelector("[data-import-include]")?.checked!==false).length;
      const el=document.getElementById("importSelectedMatchCount"); if(el) el.textContent=`登録対象 ${n}/${rows.length}試合`;
      const btn=document.getElementById("importApproveBtn"); if(btn) btn.disabled=n===0;
    };
    area.querySelectorAll("tr[data-import-row]").forEach(tr=>{
      tr.querySelector("[data-import-innings]")?.addEventListener("change",()=>normalizeImportFinishControls(tr));
      tr.querySelector("[data-import-finish]")?.addEventListener("change",()=>normalizeImportFinishControls(tr));
      tr.querySelector("[data-import-include]")?.addEventListener("change",()=>{
        tr.classList.toggle("is-excluded",!tr.querySelector("[data-import-include]")?.checked); updateSelectedCount(); saveImportMatchDraft(x);
      });
      tr.querySelectorAll("input,select").forEach(el=>{ if(!el.hasAttribute("data-import-include")) el.addEventListener("change",()=>saveImportMatchDraft(x)); });
    });
    try{
      const saved=JSON.parse(localStorage.getItem(`hsbbl_import_match_edits_${x.request_id}`)||"null");
      if(Array.isArray(saved)){
        const key=m=>`${m.date||""}|${m.team1||""}|${m.team2||""}|${m.score1??""}|${m.score2??""}`;
        const keep=new Map(saved.map(m=>[key(m),m]));
        area.querySelectorAll("tr[data-import-row]").forEach((tr,i)=>{
          const orig=matches[i]||{}; const k=key(orig); const m=keep.get(k);
          const cb=tr.querySelector("[data-import-include]"); if(cb){cb.checked=keep.has(k);tr.classList.toggle("is-excluded",!cb.checked);}
          if(m){
            const set=(sel,v)=>{const el=tr.querySelector(sel);if(el&&v!==undefined&&v!==null) el.value=String(v);};
            set("[data-import-date]",m.date);set("[data-import-round]",m.round);set("[data-import-team1]",m.team1);set("[data-import-score1]",m.score1);set("[data-import-team2]",m.team2);set("[data-import-score2]",m.score2);set("[data-import-innings]",m.innings);set("[data-import-finish]",m.finish_type);
          }
        });
      }
    }catch{}
    document.getElementById("importSelectAllMatchesBtn")?.addEventListener("click",()=>{area.querySelectorAll("[data-import-include]").forEach(cb=>{cb.checked=true;cb.closest("tr")?.classList.remove("is-excluded");});updateSelectedCount();saveImportMatchDraft(x);});
    document.getElementById("importSelectNoMatchesBtn")?.addEventListener("click",()=>{area.querySelectorAll("[data-import-include]").forEach(cb=>{cb.checked=false;cb.closest("tr")?.classList.add("is-excluded");});updateSelectedCount();saveImportMatchDraft(x);});
    updateSelectedCount();
    document.getElementById("importSetAllNineBtn")?.addEventListener("click",()=>{
      area.querySelectorAll("tr[data-import-row]").forEach(tr=>{
        const inn=tr.querySelector("[data-import-innings]");
        const fin=tr.querySelector("[data-import-finish]");
        if(inn) inn.value="9";
        if(fin) fin.value="normal";
      });
      saveImportMatchDraft(x);
    });
  }
  document.getElementById("importApproveBtn")?.addEventListener("click",()=>approveImportAudit(x));
  document.getElementById("importBackToBatchBtn")?.addEventListener("click",()=>{
    const bid=x.batch_id||localStorage.getItem("hsbbl_last_import_batch_id")||"";
    if(bid){ localStorage.setItem("hsbbl_last_import_batch_id",bid); renderImportBatchAudit(data,bid); }
  });
}

async function approveImportAudit(x){
  if(!x?.request_id) return;
  const editedMatches=collectImportEditedMatches(x);
  if(!editedMatches.length){ alert("登録対象の試合を1試合以上選択してください。"); return; }
  if(!confirm(`${editedMatches.length||0}試合を${(x.import_mode||"replace")==="replace"?"、同じ大会の既存自動取込分と置換":"、追加"}します。よろしいですか？`)) return;
  const btn=document.getElementById("importApproveBtn");
  if(btn){btn.disabled=true;btn.textContent="登録依頼中…";}
  try{
    let ratingShaBefore="";
    try{ ratingShaBefore=await getGithubContentSha("output/current_ratings.csv"); }catch{}
    await appendImportRequest({
      request_id:`approve-${Date.now()}-${Math.random().toString(36).slice(2,7)}`,
      action:"approve",
      target_request_id:x.request_id,
      created_at:new Date().toISOString(),
      import_mode:x.import_mode||"replace",
      edited_matches:editedMatches
    });
    localStorage.removeItem(`hsbbl_import_match_edits_${x.request_id}`);
    showSaveToast("登録依頼済み。台帳登録とRating更新を追跡します");
    localStorage.setItem("hsbbl_last_import_request_id",x.request_id);
    localStorage.setItem("hsbbl_last_import_state","approve");
    localStorage.setItem("hsbbl_import_rating_sha_before",ratingShaBefore||"");
    setImportProgress("working","登録依頼済み",`${editedMatches.length}試合を本番CSVへ反映中。完了後はRating更新まで追跡します。`);
    startImportPolling(x.request_id,{approval:true});
  }catch(err){
    alert(`登録依頼に失敗しました\n${err.message}`);
    if(btn){btn.disabled=false;btn.textContent="修正内容で登録";}
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


async function loadPrefRatingData({force=false}={}){
  if(prefRatingLoading) return;
  if(prefRatingDataLoaded && !force) return;
  prefRatingLoading=true;
  try{
    const jobs=await Promise.allSettled([
      fetchTextWithTimeout(PREF_STRENGTH_URL,10000),
      fetchTextWithTimeout(PREF_MATCHUPS_URL,10000),
      fetchTextWithTimeout(PREF_CURRENT_RATINGS_URL,10000),
      fetchTextWithTimeout(PREF_RATING_EVENTS_URL,10000)
    ]);
    if(jobs[0].status==="fulfilled") prefectureStrengthRows=csvParse(jobs[0].value);
    if(jobs[1].status==="fulfilled") prefectureMatchupRows=csvParse(jobs[1].value);
    if(jobs[2].status==="fulfilled") prefectureCurrentRatings=csvParse(jobs[2].value);
    if(jobs[3].status==="fulfilled") prefectureRatingEvents=csvParse(jobs[3].value);
    if(!prefectureCurrentRatings.length || !prefectureRatingEvents.length) throw new Error("県レーティング生成データが未取得です。公開CSVとActionsを確認してください。");
    prefInterstateCache=null;
    prefRatingDataLoaded=true;
  }finally{
    prefRatingLoading=false;
  }
}


async function ensureCoreMatchData(){
  if(coreMatchDataLoaded) return true;
  if(coreMatchDataLoadingPromise) return coreMatchDataLoadingPromise;
  coreMatchDataLoadingPromise=(async()=>{
    const loadedMatches=await loadCurrentAllMatchesText();
    allMatches=normalizeRows(csvParse(loadedMatches.text));
    console.info(`all_matches lazy source: ${loadedMatches.source} / ${allMatches.length} rows`);

    await loadMatchEditsShared();
    restorePendingMatchEdits();
    mergeManualBackupIntoState();
    persistManualMatchesBackup();
    allMatches=normalizeRows(applyMatchEditsToRows(allMatches,{includeManual:true}));
    detectedSchoolGeo=buildSchoolMeta(allMatches);
    initSchoolMaster();
    if(sharedMasterState){
      if(Array.isArray(sharedMasterState.lineage)) schoolLineage=sharedMasterState.lineage;
      if(Array.isArray(sharedMasterState.local_areas)) localAreas=sharedMasterState.local_areas;
      if(Array.isArray(sharedMasterState.representative_areas)) repAreas=sharedMasterState.representative_areas;
    }
    fillSelect("yearFilter",uniq(allMatches.map(x=>x.year)));
    fillSelect("regionFilter",uniq(allMatches.map(x=>x.region)));
    fillSelect("prefFilter",sortPrefectureNames(allMatches.map(x=>x.prefecture)));
    buildFastIndexes();
    const recoveredUnions=reconcileSavedUnionAssignments(allMatches,{persist:true});
    if(recoveredUnions) buildFastIndexes();
    clearResolvedRatingPending();
    if(pendingRatingMatchKeys.size) scheduleRatingRefresh();
    coreMatchDataLoaded=true;
    return true;
  })().finally(()=>{coreMatchDataLoadingPromise=null;});
  return coreMatchDataLoadingPromise;
}
async function loadCurrentAllMatchesText(){
  // V65.4: large public CSV is read as plain text from raw GitHub first.
  // GitHub contents API would base64-wrap ~18MB and is much slower on mobile.
  const cfg=loadGitHubSyncConfig();
  if(cfg?.owner && cfg?.repo){
    try{
      const branch=cfg.branch||"main";
      const rawUrl=`https://raw.githubusercontent.com/${encodeURIComponent(cfg.owner)}/${encodeURIComponent(cfg.repo)}/${encodeURIComponent(branch)}/output/all_matches.csv`;
      const text=await fetchTextWithTimeout(rawUrl,25000);
      if(text && text.includes("year,season")){
        return {text,source:"GitHub raw main / output/all_matches.csv"};
      }
    }catch(err){
      console.warn("raw all_matches read failed; falling back to Pages",err);
    }
  }

  try{
    const text=await fetchTextWithTimeout(DATA_URL,25000);
    return {text,source:"GitHub Pages / docs/data/all_matches.csv"};
  }catch(err){
    console.warn("Pages all_matches read failed; falling back to API",err);
  }

  if(cfg?.owner && cfg?.repo && githubSessionToken){
    const direct=await fetchGithubTextFile("output/all_matches.csv",cfg.branch||"main");
    if(direct?.text && direct.text.includes("year,season")){
      return {text:direct.text,source:"GitHub API / output/all_matches.csv"};
    }
  }
  throw new Error("all_matches.csv を取得できませんでした");
}

async function boot(){
  const statusEl = document.getElementById("status");
  const setStatus = msg => {
    if(statusEl) statusEl.innerHTML = `${msg} <small class="build-tag">UI-FAST-IMPORT-V67.2</small>`;
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

    // 2) 初期表示では17MB超の全試合CSVを読まない。
    // Rating計算はGitHub Actions側で全履歴を再生済み。ブラウザはcurrent_ratingsと学校マスタだけで起動する。
    setStatus("学校マスタ読込中…");
    await loadSharedMasterFromGitHub();
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
    // Ranking geography selectors must not depend on lazy 40MB match ledger.
    // Derive them from the authoritative current_ratings snapshot and school master.
    const geoRows=serverRatings.map(r=>{
      const m=masterRecordForRatingRow(r);
      return {region:normalizeRegionName(m?.district||r.region||""),
        pref:normalizePrefectureName(m?.prefecture||r.prefecture||"")};
    });
    fillSelect("regionFilter",uniq(geoRows.map(x=>x.region).filter(Boolean)));
    fillSelect("prefFilter",sortPrefectureNames(geoRows.map(x=>x.pref).filter(Boolean)));
    // 初期ランキングは serverRatings のみで描画。
    buildFastIndexes();
    setupTabs();
    setupImportUi();
    document.getElementById("prefRatingPref")?.addEventListener("change",()=>{
      const v=document.getElementById("prefRatingPref")?.value||"";
      const a=document.getElementById("prefCompareA"); if(a) a.value=v;
      refreshPrefTournamentOptions(); savePrefRatingLastSelection(); renderPrefRating();
    });
    ["prefRatingYear","prefRatingSeason","prefRatingTournament"].forEach(id=>
      document.getElementById(id)?.addEventListener("change",()=>{savePrefRatingLastSelection();renderPrefRating();})
    );
    ["prefCompareA","prefCompareB"].forEach(id=>
      document.getElementById(id)?.addEventListener("change",()=>{savePrefRatingLastSelection();renderPrefCompare();})
    );
    document.getElementById("prefRatingReloadBtn")?.addEventListener("click",async()=>{
      await loadPrefRatingData({force:true});
      prefInterstateCache=null;
      setupPrefRatingUi();
    });

    ["yearFilter","seasonFilter","regionFilter","prefFilter","levelFilter"]
      .forEach(id=>document.getElementById(id)?.addEventListener("change",async()=>{
        rankingPage=1;
        if(["yearFilter","seasonFilter","levelFilter"].includes(id) && selected(id)!=="all"){
          try{ await ensureCoreMatchData(); }catch(err){ console.error(err); }
        }
        render();
      }));

    document.getElementById("schoolSearch")?.addEventListener("input",debounce(()=>{rankingPage=1;render();},180));

    document.getElementById("rankingPrev")?.addEventListener("click",()=>{if(rankingPage>1){rankingPage--;render();}});
    document.getElementById("rankingNext")?.addEventListener("click",()=>{rankingPage++;render();});
    document.getElementById("rankingPageSize")?.addEventListener("change",()=>{rankingPage=1;render();});
    document.getElementById("rankingSortBy")?.addEventListener("change",()=>{rankingPage=1;render();});

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

    setStatus(`ランキング即時表示（全試合台帳は必要時に読込）`);
    await new Promise(resolve=>requestAnimationFrame(resolve));
    render();

    // Metadata is noncritical: never block the first visible ranking for it.
    void (async()=>{
      try{
      const auditText=await fetchTextWithTimeout(RATING_AUDIT_URL,6000);
      ratingAuditSummary=JSON.parse(auditText);
      latestMatchDateCache=String(ratingAuditSummary?.last_date||"");
      const stamp=document.getElementById("ratingGeneratedAt");
      if(stamp){
        const raw=String(ratingAuditSummary?.generated_at||"");
        const d=raw?new Date(raw):null;
        stamp.textContent=d && !Number.isNaN(d.getTime())
          ? `Rating計算: ${d.toLocaleString("ja-JP")}`
          : "Rating計算時刻: 不明";
      }
      }catch(err){ console.warn("rating audit summary unavailable",err); }

    })();

    // 3) 学校マスタはUIだけ先に使えるようにする。
    try{
      fillSelect("masterDistrictFilter", uniq([...schoolMaster.values()].map(x=>x.district)));
      fillSelect("masterPrefFilter", sortPrefectureNames([...schoolMaster.values()].map(x=>x.prefecture)));
      fillSelect("masterLocalFilter", uniq([...schoolMaster.values()].map(x=>x.local_district)));
      setupMasterUi();
    }catch(err){
      console.error("master setup failed",err);
    }

    // 4) V56: 重い補助CSVは初期表示では読まない。
    // 対戦台帳・学校詳細・学校相性を初めて開いた時だけ遅延読込する。
    // これによりスマホ起動時のCSVダウンロード/parse/index/renderを大幅に削減。

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
  const n=normalizeSchoolSearchText(name);

  let score=0;
  if(!q){
    if(recentSet.has(name)) score+=1000-recentSet.get(name);
    else score-=100;
    return score;
  }

  // Candidate free-text search is display-name only.
  // Do not match prefecture, district, school_id, furigana or aliases.
  if(n===q) score+=10000;
  else if(n.startsWith(q)) score+=8000;
  else if(n.includes(q)) score+=6000;
  else return 0;

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

  renderHistoryIdEditor();renderLedger();renderMasterTable();persistPendingMatchEdits();
  const verifyLinks=selected.map(s=>teamLinkVerification(s.key,s.side,target));
  try{await saveMatchEditsImmediately(`Move ${selected.length} histories to ${target.canonical_name}`,[],[],verifyLinks);showSaveToast(`${selected.length}試合を ${target.canonical_name} へ移動・保存済み`);}
  catch(err){alert(`試合履歴の紐づけは画面に反映しましたがGitHub保存に失敗しました。\n${err.message||err}`);}
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

document.addEventListener("change",async e=>{
  if(e.target?.id==="rankingSnapshotMode"){
    const dateMode=e.target.value==="date";
    document.getElementById("rankingSnapshotDateWrap")?.classList.toggle("hidden",!dateMode);
    if(dateMode) await ensureRatingAuxData();
    rankingPage=1; render();
  }else if(e.target?.id==="rankingSnapshotDate"){
    await ensureRatingAuxData();
    rankingPage=1; render();
  }
});

async function loadPrefHistoryCoverageAudit(){
  try{
    const txt=await fetchTextWithTimeout(PREF_HISTORY_COVERAGE_URL,8000);
    const rows=csvParse(txt);
    window.__prefHistoryCoverage=rows;
    const legacy=rows.filter(r=>Number(r.year)>=2000&&Number(r.year)<=2016);
    console.info("Pref history coverage 2000-2016", legacy);
    return rows;
  }catch(err){
    console.warn("Pref history coverage unavailable",err);
    return [];
  }
}
// Prefecture history coverage is loaded only when its audit is requested.
