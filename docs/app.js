
const DATA_URL = "data/all_matches.csv";
let allMatches = [];
let currentStats = new Map();

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
    const a = ensure(m.team1), b = ensure(m.team2);
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
    return `<tr>
      <td class="rank">${i+1}</td>
      <td><button class="school-link" data-team="${esc(s.team)}">${esc(s.team)}</button></td>
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
}

function showDetail(team){
  const s = currentStats.get(team);
  if(!s) return;

  const panel = document.getElementById("detailPanel");
  const diff=s.pf-s.pa;
  const recent=[...s.history].slice(-8).reverse();

  panel.innerHTML = `
    <div class="school-title">
      <div>
        <h3>${esc(s.team)}</h3>
        <div class="school-meta">現在のフィルタ条件内で計算</div>
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

async function boot(){
  try{
    const res = await fetch(DATA_URL,{cache:"no-store"});
    if(!res.ok) throw new Error(`HTTP ${res.status}`);
    const text = await res.text();
    allMatches = normalizeRows(csvParse(text));

    fillSelect("yearFilter", uniq(allMatches.map(x=>x.year)));
    fillSelect("regionFilter", uniq(allMatches.map(x=>x.region)));
    fillSelect("prefFilter", uniq(allMatches.map(x=>x.prefecture)));

    document.getElementById("status").textContent =
      `${allMatches.length.toLocaleString()}試合 読込済み`;

    ["yearFilter","seasonFilter","regionFilter","prefFilter","levelFilter"]
      .forEach(id=>document.getElementById(id).addEventListener("change",render));

    document.getElementById("schoolSearch").addEventListener("input",render);

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
