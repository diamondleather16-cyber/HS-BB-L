(function(){
  "use strict";
  const state=document.getElementById("publicationSyncState");
  const details=document.getElementById("publicationSyncDetails");
  const button=document.getElementById("publicationSyncRefresh");
  if(!state||!details)return;
  const fmt=t=>{if(!t)return "未記録";const d=new Date(t);return isNaN(d.getTime())?String(t):d.toLocaleString("ja-JP",{timeZone:"Asia/Tokyo",year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",second:"2-digit"});};
  async function readJson(file){
    const r=await fetch(file+"?sync="+Date.now(),{cache:"no-store"});
    if(!r.ok)throw new Error("HTTP "+r.status);
    return await r.json();
  }
  async function refresh(){
    state.textContent="照合中…";button.disabled=true;
    try{
      const [published,request]=await Promise.all([
        readJson("data/publication_status.json"),
        readJson("data/rebuild_request_status.json").catch(()=>null)
      ]);
      const runningRevision=published.input_revision||"";
      const requestedRevision=request?.request_revision||"";
      const waiting=Boolean(requestedRevision&&requestedRevision!==runningRevision&&request?.requested_at&&published.calculated_at&&Date.parse(request.requested_at)>Date.parse(published.calculated_at));
      state.textContent=waiting?"再計算要求あり（公開反映待ち）":"計算結果を公開済み";
      details.textContent="最終計算："+fmt(published.calculated_at)+" ／ 計算に使った入力："+runningRevision.slice(0,12)+" ／ 公開状況："+(waiting?"要求後の再計算が未確認":"公開済みスナップショット")+"。ブラウザからの個別保存成功までは証明しません。";
    }catch(e){
      state.textContent="公開世代を取得できません";
      details.textContent="同期情報の公開がまだ済んでいないか、通信エラーです。保存成功・再計算成功を推測しないでください。";
    }finally{button.disabled=false;}
  }
  button?.addEventListener("click",refresh);
  refresh();
})();
