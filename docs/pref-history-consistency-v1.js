// Prefecture-history reconciliation: read actual generated prefecture event ledger.
(function(){
  if(typeof filteredPrefHistory!=="function" || typeof renderPrefRating!=="function")return;
  filteredPrefHistory=function(pref){
    const year=document.getElementById("prefRatingYear")?.value||"all";
    const season=document.getElementById("prefRatingSeason")?.value||"all";
    const tournament=document.getElementById("prefRatingTournament")?.value||"all";
    return (prefectureRatingEvents||[]).filter(e=>{
      if(e.pref_a!==pref&&e.pref_b!==pref)return false;
      if(year!=="all"&&String(e.year||"")!==year)return false;
      if(season!=="all"&&String(e.season||"")!==season)return false;
      if(tournament!=="all"&&String(e.tournament||"")!==tournament)return false;
      return true;
    }).map(e=>{
      const isA=e.pref_a===pref;
      const sf=Number(isA?e.score_a:e.score_b),sa=Number(isA?e.score_b:e.score_a);
      return {row:e,opponent:isA?e.pref_b:e.pref_a,
        opponentPref:isA?e.pref_b:e.pref_a,
        team:isA?e.team_a||"":e.team_b||"",
        opponentTeam:isA?e.team_b||"":e.team_a||"",
        sf,sa,result:sf>sa?"W":sf<sa?"L":"D",
        rating_after:Number(isA?e.rating_a_after:e.rating_b_after)};
    }).sort((a,b)=>Number(b.row.event_order||0)-Number(a.row.event_order||0));
  };
  let prefHistoryDisplayLimit=100;
  const originalRender=renderPrefRating;
  renderPrefRating=function(){
    originalRender();
    const list=document.getElementById("prefHistoryList");
    if(list){
      // The original renderer reverses an already descending event list.
      // Recreate only this display segment, preserving the calculation source.
      const pref=document.getElementById("prefRatingPref")?.value||"";
      const full=filteredPrefHistory(pref).filter(x=>Number(x.row.year)>=2008);
      const rows=full.slice(0,prefHistoryDisplayLimit);
      list.innerHTML=rows.map(x=>'<div class="pref-history-row">'+
        '<span>'+esc(x.row.date||"")+'</span>'+
        '<span>'+esc(seasonLabel(x.row.season||""))+'</span>'+
        '<span>'+esc(x.row.tournament||"")+'</span>'+
        '<span class="'+(x.result==="W"?"win":x.result==="L"?"loss":"")+'">'+x.result+'</span>'+
        '<span>'+esc(x.team||"学校名未収録")+' '+x.sf+'-'+x.sa+' '+esc(x.opponentTeam||"学校名未収録")+'</span>'+
        '<span>'+esc(x.opponent||"")+'</span></div>').join("")||'<div class="school-detail-empty">該当試合なし</div>';
    }
    if(list){
      let controls=document.getElementById("prefHistoryPagination");
      if(!controls){controls=document.createElement("div");controls.id="prefHistoryPagination";controls.style.cssText="padding:12px;display:flex;gap:8px;align-items:center;flex-wrap:wrap";list.after(controls);}
      const pref=document.getElementById("prefRatingPref")?.value||"";
      const all=filteredPrefHistory(pref).filter(x=>Number(x.row.year)>=2008);
      controls.replaceChildren();
      const label=document.createElement("span");label.textContent="表示 "+Math.min(prefHistoryDisplayLimit,all.length)+" / "+all.length+" 試合（2008年以降・レーティング計算採用分）";controls.append(label);
      if(prefHistoryDisplayLimit<all.length){const more=document.createElement("button");more.type="button";more.textContent="次の100試合を表示";more.addEventListener("click",()=>{prefHistoryDisplayLimit+=100;renderPrefRating();});controls.append(more);}
      if(prefHistoryDisplayLimit>100){const reset=document.createElement("button");reset.type="button";reset.textContent="最新100試合に戻す";reset.addEventListener("click",()=>{prefHistoryDisplayLimit=100;renderPrefRating();});controls.append(reset);}
    }
    // Use precisely the same confirmed event universe for head-to-head.
    const a=document.getElementById("prefCompareA")?.value||"";
    const b=document.getElementById("prefCompareB")?.value||"";
    const head=filteredPrefHistory(a).filter(x=>x.opponent===b);
    const direct=document.querySelector(".pref-compare-metrics");
    if(direct?.children?.[1]){
      const w=head.filter(x=>x.result==="W").length,l=head.filter(x=>x.result==="L").length,d=head.filter(x=>x.result==="D").length;
      direct.children[1].querySelector("strong").textContent=String(head.length);
      direct.children[1].querySelector("small").textContent=w+"勝 "+l+"敗 "+d+"分";
    }
  };
})();
