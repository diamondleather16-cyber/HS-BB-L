// Count head-to-head using the same rated interstate event ledger, not lazy match data.
(function(){
  if(typeof renderPrefCompare!=="function")return;
  const previous=renderPrefCompare;
  renderPrefCompare=function(){
    previous();
    const a=document.getElementById("prefCompareA")?.value||"";
    const b=document.getElementById("prefCompareB")?.value||"";
    const target=document.querySelector("#prefCompareBody .pref-compare-metrics");
    if(!a||!b||!target?.children?.[1])return;
    const matches=(prefectureRatingEvents||[]).filter(e=>
      Number(e.year)>=2008 &&
      ((e.pref_a===a&&e.pref_b===b)||(e.pref_a===b&&e.pref_b===a))
    );
    const wins=matches.filter(e=>{const x=Number(e.score_a),y=Number(e.score_b);return e.pref_a===a?x>y:y>x;}).length;
    const losses=matches.filter(e=>{const x=Number(e.score_a),y=Number(e.score_b);return e.pref_a===a?x<y:y<x;}).length;
    const draws=matches.length-wins-losses;
    const card=target.children[1];
    const title=card.querySelector("span");
    const count=card.querySelector("strong");
    const detail=card.querySelector("small");
    if(title)title.textContent="直接対戦（2008年以降）";
    if(count)count.textContent=prefRatingDataLoaded?String(matches.length):"読込中";
    if(detail)detail.textContent=prefRatingDataLoaded?
      (wins+"勝 "+losses+"敗 "+draws+"分 / 県Rating採用試合"):
      "県レーティング履歴を読込中";
  };
})();
