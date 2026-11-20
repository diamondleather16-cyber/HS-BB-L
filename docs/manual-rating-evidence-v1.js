/* Manual ledger -> rating -> both schools' histories: show evidence, never infer success from rebuild completion. */
(function(){
  "use strict";
  const labels={
    reflected:"計算・両校履歴へ反映済み",
    reflected_variant:"同一試合として計算・両校履歴へ反映済み（大会表記等に違いあり）",
    missing_ledger:"台帳の計算入力に未反映",
    missing_rating:"台帳には存在／レーティング未計算",
    unlinked_school:"学校IDが未確定",
    missing_school_history:"計算済み／学校別履歴に欠落"
  };
  const host=document.getElementById("ledgerReflectionStatus");
  if(!host)return;
  const panel=document.createElement("div");
  panel.id="manualRatingEvidence";
  panel.style.cssText="margin:10px 0;padding:12px;border:1px solid var(--border,#7775);border-radius:10px;line-height:1.6;font-size:13px";
  panel.innerHTML='<strong>手入力試合のレーティング計算根拠</strong><div id="manualRatingEvidenceText">照合情報を読み込み中…</div>';
  host.insertAdjacentElement("afterend",panel);
  const body=panel.querySelector("#manualRatingEvidenceText");
  const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  let running=false,lastStamp="",lastUpdate=0;
  async function refresh(){
    if(running)return;
    running=true;
    try{
      const response=await fetch("data/manual_rating_reflection.json?at="+Date.now(),{cache:"no-store"});
      if(!response.ok)throw Error("HTTP "+response.status);
      const data=await response.json();
      const recent=(typeof matchEditsState!=="undefined" && Array.isArray(matchEditsState?.manual_matches))
        ? matchEditsState.manual_matches.slice(-5).reverse():[];
      const byId=new Map((data.matches||[]).map(m=>[String(m.manual_id),m]));
      const selected=recent.length?recent.map(m=>byId.get(String(m.manual_id))||{
        ...m,status:"waiting",score1:m.score1,score2:m.score2
      }):(data.matches||[]).slice(0,5);
      const published=new Date(data.generated_at);
      const at=isNaN(published.getTime())?"時刻不明":published.toLocaleString("ja-JP",{timeZone:"Asia/Tokyo"});
      const summary=data.counts||{};
      let html='<div>最終検証 '+esc(at)+' ／ 手入力 '+Number(data.total||0)+'試合のうち両校履歴反映 '+(Number(summary.reflected||0)+Number(summary.reflected_variant||0))+'試合</div>';
      if(selected.length){
        html+='<div style="margin-top:6px">'+selected.map(m=>{
          const label=labels[m.status]||"保存後の再計算・検証待ち";
          return '<div style="padding:6px 0;border-top:1px solid #8883">'
            +esc(m.date||"")+"　"+esc(m.team1)+" "+esc(m.score1)+"－"+esc(m.score2)+" "+esc(m.team2)
            +'<div><strong>'+esc(label)+'</strong>'
            +((m.status==="reflected"||m.status==="reflected_variant")?' ／ 両校のランキング履歴で試合前・変動・試合後を確認できます。':"")
            +'</div></div>';
        }).join("")+'</div>';
      }else html+='<div>手入力試合はまだありません。</div>';
      body.innerHTML=html;
      lastStamp=data.generated_at;lastUpdate=Date.now();
    }catch(err){
      body.textContent="照合データの公開待ちです。再計算完了だけでは反映済みと判定しません。（"+String(err.message||err)+"）";
    }finally{running=false;}
  }
  // After save the manual UI updates its local state. Refresh evidence during the build.
  setInterval(()=>{if(!document.hidden)refresh();},12000);
  document.addEventListener("visibilitychange",()=>{if(!document.hidden)refresh();});
  refresh();
})();
