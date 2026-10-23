(function(){
"use strict";
const css=document.createElement("style");css.textContent=`
#prefDirectHistoryModal{position:fixed;inset:0;z-index:99999;background:#0009;display:none;align-items:center;justify-content:center;padding:12px}
#prefDirectHistoryModal.open{display:flex}
#prefDirectHistoryModal .ph-card{background:var(--card-bg,#fff);color:var(--text,#20252b);width:min(900px,100%);max-height:88vh;display:flex;flex-direction:column;border-radius:14px;overflow:hidden}
#prefDirectHistoryModal .ph-header{padding:14px 17px;display:flex;justify-content:space-between;align-items:center;gap:12px;border-bottom:1px solid #ddd}
#prefDirectHistoryModal .ph-list{overflow:auto;padding:10px 15px}
#prefDirectHistoryModal table{border-collapse:collapse;width:100%;font-size:13px}
#prefDirectHistoryModal th,#prefDirectHistoryModal td{border-bottom:1px solid #ddd;padding:9px 6px;text-align:left}
#prefDirectHistoryModal button{cursor:pointer;padding:8px 13px;border:1px solid #aaa;border-radius:8px;background:transparent;color:inherit}
#prefCompareBody .pref-compare-metrics>div:nth-child(2){cursor:pointer;outline-offset:3px}
`;document.head.append(css);
const modal=document.createElement("div");modal.id="prefDirectHistoryModal";modal.setAttribute("role","dialog");modal.setAttribute("aria-modal","true");modal.setAttribute("aria-label","県同士の直接対戦履歴");
modal.innerHTML='<div class="ph-card"><div class="ph-header"><strong id="phTitle">直接対戦履歴</strong><button id="phClose" type="button">閉じる ×</button></div><div id="phCount" style="padding:10px 16px"></div><div class="ph-list" id="phList"></div></div>';document.body.append(modal);
const close=()=>{modal.classList.remove("open");};modal.querySelector("#phClose").addEventListener("click",close);
modal.addEventListener("click",e=>{if(e.target===modal)close();});document.addEventListener("keydown",e=>{if(e.key==="Escape")close();});
const clean=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
function showHistory(){
 const a=document.getElementById("prefCompareA")?.value||"",b=document.getElementById("prefCompareB")?.value||"";
 if(!a||!b)return;
 const all=(typeof prefectureRatingEvents!=="undefined"?prefectureRatingEvents:[])||[];
 const rows=all.filter(r=>Number(r.year)>=2008&&((r.pref_a===a&&r.pref_b===b)||(r.pref_a===b&&r.pref_b===a)))
 .sort((x,y)=>Number(y.event_order||0)-Number(x.event_order||0));
 const wins=rows.filter(r=>r.pref_a===a?Number(r.score_a)>Number(r.score_b):Number(r.score_b)>Number(r.score_a)).length;
 const losses=rows.filter(r=>r.pref_a===a?Number(r.score_a)<Number(r.score_b):Number(r.score_b)<Number(r.score_a)).length;
 const draws=rows.length-wins-losses;
 modal.querySelector("#phTitle").textContent=a+" 対 "+b+"｜直接対戦履歴";
 modal.querySelector("#phCount").textContent=rows.length+"試合（"+a+"から "+wins+"勝 "+losses+"敗 "+draws+"分）／2008年以降・県Rating採用試合";
 const table='<table><thead><tr><th>日付</th><th>大会・回戦</th><th>'+clean(a)+'側</th><th>結果</th><th>'+clean(b)+'側</th></tr></thead><tbody>'+rows.map(r=>{
 const flip=r.pref_a!==a;
 const t1=flip?r.team_b:r.team_a,t2=flip?r.team_a:r.team_b;
 const s1=Number(flip?r.score_b:r.score_a),s2=Number(flip?r.score_a:r.score_b);
 const link=r.source_url&&/^https?:\/\//.test(r.source_url)?'<br><a href="'+clean(r.source_url)+'" target="_blank" rel="noopener">出典</a>':"";
 return '<tr><td>'+clean(r.date||"")+'</td><td>'+clean(r.tournament||"")+'<br>'+clean(r.round||"")+link+'</td><td>'+clean(t1||"学校名未収録")+'</td><td><b>'+clean(s1)+" - "+clean(s2)+'</b></td><td>'+clean(t2||"学校名未収録")+'</td></tr>';
 }).join("")+'</tbody></table>';
 modal.querySelector("#phList").innerHTML=rows.length?table:'<p>この2県の計算採用済み直接対戦記録はありません。元台帳未収録の可能性もあります。</p>';
 modal.classList.add("open");modal.querySelector("#phClose").focus();
}
document.addEventListener("click",e=>{
 const box=e.target.closest?.("#prefCompareBody .pref-compare-metrics>div:nth-child(2)");
 if(box)showHistory();
});
document.addEventListener("keydown",e=>{
 if((e.key==="Enter"||e.key===" ")&&e.target.matches?.("#prefCompareBody .pref-compare-metrics>div:nth-child(2)")){e.preventDefault();showHistory();}
});
const observer=new MutationObserver(()=>{
 const target=document.querySelector("#prefCompareBody .pref-compare-metrics>div:nth-child(2)");
 if(target&&!target.hasAttribute("tabindex")){target.tabIndex=0;target.setAttribute("role","button");target.setAttribute("aria-label","直接対戦の履歴一覧を表示");target.title="クリックして対戦履歴を表示";}
});
const body=document.getElementById("prefCompareBody");if(body)observer.observe(body,{childList:true,subtree:true});
})();
