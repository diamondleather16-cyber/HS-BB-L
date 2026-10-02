
const DATA_URL = "data/all_matches.csv";
let allMatches = [];
let currentStats = new Map();
let schoolMaster = new Map();

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

function normalizeRows(rows){
  return rows.map((r,idx)=>({
    ...r,
    _id:idx,
    year:String(r.year||"").trim(),
    season:String(r.season||"").trim(),
    region:String(r.region||"").trim(),
    prefecture:String(r.prefecture||"").trim(),
    date:String(r.date||"").trim(),
    team1:String(r.team1||"").trim(),
    team2:String(r.team2||"").trim(),
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
    return new Map(arr.map(x=>[x.canonical_name,x]));
  }catch(e){
    return new Map();
  }
}

function saveMasterToStorage(){
  localStorage.setItem(MASTER_STORAGE_KEY, JSON.stringify([...schoolMaster.values()]));
}

function initSchoolMaster(){
  const detected = buildSchoolMeta(allMatches);
  const saved = loadMasterFromStorage();
  const names = uniq(allMatches.flatMap(r=>[r.team1,r.team2]));

  schoolMaster = new Map();

  names.forEach(name=>{
    const m = detected.get(name) || {};
    const district = m.district || "不明";
    const pref = m.prefecture || "不明";
    const prior = saved.get(name);

    schoolMaster.set(name, prior || {
      school_id: provisionalSchoolId(name,district,pref,"00"),
      canonical_name:name,
      district,
      prefecture:pref,
      local_district:"",
      representative_area:pref,
      aliases:[name]
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

function render(){
  const matches = filteredMatches();
  const schoolMeta = buildSchoolMeta(allMatches);
  currentStats = calcRatings(matches);
  const q = document.getElementById("schoolSearch").value.trim().toLowerCase();

  let list = [...currentStats.values()]
    .filter(s=>!q || s.team.toLowerCase().includes(q))
    .sort((a,b)=>b.rating-a.rating || b.games-a.games || a.team.localeCompare(b.team,"ja"));

  document.getElementById("matchCount").textContent = matches.length.toLocaleString();
  document.getElementById("schoolCount").textContent = currentStats.size.toLocaleString();
  document.getElementById("latestDate").textContent =
    matches.map(x=>x.date).filter(Boolean).sort().at(-1) || "-";

  const tbody = document.querySelector("#rankingTable tbody");
  tbody.innerHTML = list.map((s,i)=>{
    const pct = s.games ? (s.wins/s.games*100).toFixed(1)+"%" : "-";
    const diff=s.pf-s.pa;
    const rec = schoolRecord(s.team);
    const district = rec?.district || districtForSchool(s.team, schoolMeta);
    const pref = rec?.prefecture || prefForSchool(s.team, schoolMeta);
    const sid = rec?.school_id || provisionalSchoolId(s.team,district,pref,"00");
    const color = DISTRICT_COLORS[district] || DISTRICT_COLORS["不明"];
    return `<tr>
      <td class="rank">${i+1}</td>
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

  renderLedger(matches);
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
        <div class="school-meta"><span class="id-badge">${esc(sid)}</span>　現在のフィルタ条件内で計算</div>
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

function renderLedger(matches){
  const tbody = document.querySelector("#ledgerTable tbody");
  const rows = [...matches].sort((a,b)=>(b.date||"").localeCompare(a.date||"") || b._id-a._id);
  document.getElementById("ledgerCount").textContent = `${rows.length.toLocaleString()}試合`;

  tbody.innerHTML = rows.map(r=>{
    const district = REGION_LABEL[r.region] || r.region || "";
    const pref = specialPrefecture(r) || "";
    const url = String(r.source_url||"").trim();
    const source = url ? `<a class="source-link" href="${esc(url)}" target="_blank" rel="noopener">元ページ</a>` : "";
    return `<tr>
      <td>${esc(r.date)}</td>
      <td>${esc(r.year)}</td>
      <td>${esc(seasonLabel(r.season))}</td>
      <td>${esc(levelLabel(r.level))}</td>
      <td>${esc(district)}</td>
      <td>${esc(pref)}</td>
      <td>${esc(r.tournament||"")}</td>
      <td>${esc(r.round||"")}</td>
      <td>${esc(r.team1)}</td>
      <td>${r.score1}</td>
      <td>${esc(r.team2)}</td>
      <td>${r.score2}</td>
      <td>${source}</td>
    </tr>`;
  }).join("");
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
      if(view==="master") renderMasterTable();
    });
  });
}


function renderMasterTable(){
  const q = (document.getElementById("masterSearch")?.value || "").trim().toLowerCase();
  const rows = [...schoolMaster.values()]
    .filter(x=>{
      const hay = [
        x.school_id,x.canonical_name,x.district,x.prefecture,x.local_district,
        ...(x.aliases||[])
      ].join(" ").toLowerCase();
      return !q || hay.includes(q);
    })
    .sort((a,b)=>a.canonical_name.localeCompare(b.canonical_name,"ja"));

  const tbody = document.querySelector("#masterTable tbody");
  if(!tbody) return;
  tbody.innerHTML = rows.map(x=>`
    <tr data-name="${esc(x.canonical_name)}">
      <td><span class="id-badge">${esc(x.school_id)}</span></td>
      <td><strong>${esc(x.canonical_name)}</strong></td>
      <td>${esc(x.district||"")}</td>
      <td>${esc(x.prefecture||"")}</td>
      <td>${esc(x.local_district||"")}</td>
      <td>${(x.aliases||[]).length}</td>
    </tr>
  `).join("");

  tbody.querySelectorAll("tr").forEach(tr=>{
    tr.addEventListener("click",()=>showMasterEditor(tr.dataset.name));
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
        <label>所属地区（9地区）</label>
        <input id="editDistrict" value="${esc(x.district||"")}">
      </div>
      <div class="field">
        <label>都道府県 / 南北・東西</label>
        <input id="editPref" value="${esc(x.prefecture||"")}">
      </div>
      <div class="field">
        <label>県内地区</label>
        <input id="editLocalDistrict" placeholder="例：名古屋" value="${esc(x.local_district||"")}">
      </div>
      <div class="field">
        <label>大会代表区分</label>
        <input id="editRepArea" placeholder="例：西愛知" value="${esc(x.representative_area||"")}">
      </div>
      <div class="wide">
        <label>別名 / 表記揺れ（1行1名称）</label>
        <textarea id="editAliases">${esc((x.aliases||[]).join("\n"))}</textarea>
      </div>
      <div class="note">
        IDは現状「地区コード + 都道府県コード + 県内地区コード + 4桁仮コード」の試作です。
        県内地区マスタが整った段階で正式採番へ切り替えます。
      </div>
      <button class="save-btn" id="saveMasterBtn">この内容で保存</button>
    </div>
  `;

  document.getElementById("saveMasterBtn").addEventListener("click",()=>{
    const oldName = x.canonical_name;
    const newName = document.getElementById("editCanonicalName").value.trim() || oldName;
    const updated = {
      ...x,
      school_id: document.getElementById("editSchoolId").value.trim() || x.school_id,
      canonical_name: newName,
      district: document.getElementById("editDistrict").value.trim(),
      prefecture: document.getElementById("editPref").value.trim(),
      local_district: document.getElementById("editLocalDistrict").value.trim(),
      representative_area: document.getElementById("editRepArea").value.trim(),
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
    saveMasterToStorage();
    renderMasterTable();
    render();
    showMasterEditor(newName);
  });
}

function exportMasterCsv(){
  const header = [
    "school_id","canonical_name","district","prefecture",
    "local_district","representative_area","aliases"
  ];
  const lines = [header.join(",")];

  for(const x of [...schoolMaster.values()].sort((a,b)=>a.canonical_name.localeCompare(b.canonical_name,"ja"))){
    const row = [
      x.school_id,x.canonical_name,x.district,x.prefecture,
      x.local_district,x.representative_area,(x.aliases||[]).join("|")
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
      district:String(r.district||"").trim(),
      prefecture:String(r.prefecture||"").trim(),
      local_district:String(r.local_district||"").trim(),
      representative_area:String(r.representative_area||"").trim(),
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

function setupMasterUi(){
  const search = document.getElementById("masterSearch");
  if(search) search.addEventListener("input",renderMasterTable);

  const exp = document.getElementById("exportAliasBtn");
  if(exp) exp.addEventListener("click",exportMasterCsv);

  const imp = document.getElementById("importAliasInput");
  if(imp) imp.addEventListener("change",async()=>{
    if(imp.files?.[0]) await importMasterCsv(imp.files[0]);
    imp.value="";
  });
}


async function boot(){
  try{
    const res = await fetch(DATA_URL,{cache:"no-store"});
    if(!res.ok) throw new Error(`HTTP ${res.status}`);
    const text = await res.text();
    allMatches = normalizeRows(csvParse(text));
    initSchoolMaster();

    fillSelect("yearFilter", uniq(allMatches.map(x=>x.year)));
    fillSelect("regionFilter", uniq(allMatches.map(x=>x.region)));
    fillSelect("prefFilter", uniq(allMatches.map(x=>x.prefecture)));

    document.getElementById("status").textContent =
      `${allMatches.length.toLocaleString()}試合 読込済み`;

    ["yearFilter","seasonFilter","regionFilter","prefFilter","levelFilter"]
      .forEach(id=>document.getElementById(id).addEventListener("change",render));

    document.getElementById("schoolSearch").addEventListener("input",render);

    setupTabs();
    setupMasterUi();

    document.getElementById("resetBtn").addEventListener("click",()=>{
      ["yearFilter","seasonFilter","regionFilter","prefFilter","levelFilter"]
        .forEach(id=>document.getElementById(id).value="all");
      document.getElementById("schoolSearch").value="";
      document.getElementById("detailPanel").innerHTML = `
        <div class="empty-state">
          <div class="ball">●</div>
          <h3>学校を選択</h3>
          <p>ランキングの学校名をクリックすると、戦績とRating推移を表示します。</p>
        </div>`;
      render();
    });

    render();
  }catch(e){
    console.error(e);
    document.getElementById("status").textContent = "CSV読込失敗";
    document.querySelector(".wrap").insertAdjacentHTML(
      "afterbegin",
      `<div class="panel" style="padding:16px;margin-bottom:16px">
        <strong>data/all_matches.csv を読み込めませんでした。</strong>
        <p style="margin:6px 0 0;color:#6d737c;font-size:13px">
          GitHub Actions の Deploy HS-BB-L UI を実行してください。
        </p>
      </div>`
    );
  }
}

boot();
