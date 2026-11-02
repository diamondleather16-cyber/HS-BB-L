/* v70: Shared school-ID history access and narrow-screen layout. */
(()=>{
 "use strict";
 const el=id=>document.getElementById(id);
 function patchSchoolDetail(){
   const modal=el("schoolMasterDetailModal"),body=el("schoolMasterDetailBody");
   if(!modal||modal.classList.contains("hidden")||!body)return;
   const heading=body.querySelector(".school-detail-section-head h4");
   if(!heading||heading.textContent.trim()!=="Rating履歴")return;
   const section=heading.closest(".school-detail-section");
   if(!section||section.dataset.historyV70==="done")return;
   section.dataset.historyV70="done";
   const title=el("schoolMasterDetailTitle")?.textContent.trim();
   if(!title)return;
   const btn=document.createElement("button");
   btn.type="button";btn.className="ghost school-history-open-v70";
   btn.textContent="全Rating・ランキング履歴を表示";
   btn.addEventListener("click",()=>{try{showRatingHistory(title)}catch(e){console.error(e)}});
   section.querySelector(".school-detail-section-head")?.appendChild(btn);
   // The full, authoritative historical data are loaded by the very same
   // shard loader used in the ranking modal, not the unloaded bulk event map.
   const box=section.querySelector(".school-detail-empty");
   if(box)box.textContent="学校別履歴を確認するには上のボタンを押してください。";
   if(typeof loadSchoolHistoryBundle!=="function")return;
   const sid=String(typeof schoolMaster!=="undefined"?schoolMaster.get(title)?.school_id||"":"");
   if(!sid)return;
   loadSchoolHistoryBundle(title).then(bundle=>{
     if(!section.isConnected||section.dataset.historyV70!=="done")return;
     const events=bundle.events||[];
     const list=section.querySelector(".school-detail-rating-list");
     const empty=section.querySelector(".school-detail-empty");
     const count=section.querySelector(".school-detail-section-head span");
     if(count)count.textContent=events.length+"件";
     if(empty)empty.textContent=events.length
       ?"学校IDのRating履歴を読み込みました。全件は上のボタンで確認できます。"
       :"この学校IDの計算済みRating履歴はありません。";
     if(!list&&events.length){
       const hint=document.createElement("div");hint.className="school-history-preview-v70";
       hint.textContent="最新： "+(events.at(-1).date||"日付未確定")+" / "+Number(events.at(-1).rating_after).toFixed(1);
       section.appendChild(hint);
     }
   }).catch(e=>{const empty=section.querySelector(".school-detail-empty");
     if(empty)empty.textContent="履歴取得失敗："+String(e.message||e);
   });
 }

 async function editHistoryDate(row,event,schoolName){
   if(!event||event.event_type==="generation_reset")return;
   const existing=String(event.date||"");
   const entered=prompt("確定した試合日を入力してください（YYYY-MM-DD）。保存後、Rating再計算が必要です。",/^\d{4}-\d{2}-\d{2}$/.test(existing)?existing:"");
   if(entered===null)return;
   const value=entered.trim();
   if(!/^\d{4}-\d{2}-\d{2}$/.test(value)||Number.isNaN(Date.parse(value+"T00:00:00Z"))||new Date(value+"T00:00:00Z").toISOString().slice(0,10)!==value){
      alert("実在する日付を YYYY-MM-DD で入力してください。");return;
   }
   const button=row.querySelector(".history-edit-date-v71");
   button.disabled=true;button.textContent="照合中";
   try{
     if(typeof ensureLedgerEditState==="function")await ensureLedgerEditState();
     // Do not trust the partially loaded fast ledger: an absent row there
     // does not mean that a fixture exists only in the historical archive.
     const year=String(event.year||"");
     if(!/^20\d{2}$/.test(year))throw Error("履歴の年度が不正です");
     const text=await fetchTextWithTimeout(`data/ledger_shards/${year}.csv`,20000);
     const matches=csvParse(text);
     const canon=v=>String(v||"").replace(/[\s　・･■●○]+/g,"").trim();
     const score=v=>{const n=Number(v);return Number.isFinite(n)?String(n):String(v||"").trim()};
     const school=canon(schoolName),opponent=canon(event.opponent);
     const candidate=matches.filter(r=>{
       if(String(r.year||"")!==String(event.year||"")||String(r.season||"")!==String(event.season||""))return false;
       if(canon(r.tournament)!==canon(event.tournament))return false;
       if(canon(r.round)!==canon(event.round))return false;
       const normal=canon(r.team1)===school&&canon(r.team2)===opponent&&score(r.score1)===score(event.score_for)&&score(r.score2)===score(event.score_against);
       const reverse=canon(r.team2)===school&&canon(r.team1)===opponent&&score(r.score2)===score(event.score_for)&&score(r.score1)===score(event.score_against);
       return normal||reverse;
     });
     // Never guess between repeated games. Original date may disambiguate.
     const dated=candidate.filter(r=>String(r.date||"")===existing);
     const resolved=dated.length===1?dated:candidate;
     if(resolved.length===0){
       // Historical-only rating input: preserve a dated correction in the
       // same authoritative GitHub edit journal without inventing a ledger row.
       const parts=String(event.match_key||"").split("|");
       if(parts.length!==9)throw Error("履歴イベントから元試合を一意に識別できません。");
       const original={year:parts[0],season:parts[1],date:parts[2],
         tournament:parts[3],round:parts[4],team1:parts[5],score1:parts[6],
         team2:parts[7],score2:parts[8],match_id:"HDATE-"+stableMatchIdHash(event.match_key)};
       if(!original.team1||!original.team2||!original.tournament)throw Error("履歴の試合識別情報が不十分です");
       appendMatchAuthorityOp("UPDATE",original,{date:value});
       persistPendingMatchEdits();
       button.textContent="GitHub保存中";
       await saveMatchEditsImmediately("Fix historical rating event date: "+event.tournament);
       button.textContent="保存済・再計算待ち";
       const msg=document.createElement("small");
       msg.textContent="過去資料の試合日補正をGitHub保存済み。再計算結果の公開後に履歴が更新されます。";
       row.appendChild(msg);
       return;
     }
     if(resolved.length!==1)throw Error("同じ条件の試合が複数あります。対戦台帳から直接編集してください。");
     const match=resolved[0],key=matchEditKey(match);
     const oldSnapshot={...match};
     if(typeof upsertMatchOverride!=="function"||typeof saveMatchEditsImmediately!=="function")throw Error("台帳保存機能が読み込まれていません");
     upsertMatchOverride(key,{date:value});
     if(typeof appendMatchAuthorityOp==="function")appendMatchAuthorityOp("UPDATE",oldSnapshot,{date:value});
     persistPendingMatchEdits();
     button.textContent="GitHub保存中";
     await saveMatchEditsImmediately("Fix rating history match date: "+event.tournament,[{edit_key:key,changes:{date:value}}]);
     // Update only the ledger view; the Rating graph is calculated data and
     // must not be relabelled until the server has replayed the full sequence.
     match.date=value;
     if(typeof markRatingPendingForRow==="function")markRatingPendingForRow(match);
     button.textContent="保存済・再計算待ち";
     const info=document.createElement("small");
     info.textContent="日付 "+value+" をGitHub保存済み。Rating再計算の公開後に履歴へ反映されます。";
     row.appendChild(info);
   }catch(e){button.disabled=false;button.textContent="日付を編集";alert("保存または台帳照合に失敗しました。"+String(e.message||e))}
 }
 let lastHistoryToken="";
 async function attachHistoryEditors(){
   const body=el("ratingHistoryBody"),modal=el("ratingHistoryModal");
   const table=body?.querySelector(".rating-history-table");
   if(!table||!modal||modal.classList.contains("hidden")||table.dataset.editorsV71==="ready")return;
   table.dataset.editorsV71="ready";
   const title=el("ratingHistoryTitle")?.textContent||"";
   const name=title.split(" / Rating")[0].trim();
   try{
     const bundle=await loadSchoolHistoryBundle(name);
     const cutoff=typeof rankingSnapshotDateValue==="function"?rankingSnapshotDateValue():"";
     const events=[...(bundle.events||[])].filter(e=>!cutoff||eventBeforeOrOn(e,cutoff)).sort(eventChronoCompare).reverse();
     if(!table.isConnected)return;
     [...table.querySelectorAll("tbody tr")].forEach((tr,i)=>{
       const event=events[i];
       if(!event||event.event_type==="generation_reset"||tr.children.length<8)return;
       const dateCell=tr.children[0];
       const button=document.createElement("button");
       button.type="button";button.className="ghost history-edit-date-v71";
       button.textContent="日付を編集";
       button.addEventListener("click",()=>editHistoryDate(tr,event,name));
       dateCell.appendChild(document.createElement("br"));dateCell.appendChild(button);
     });
   }catch(e){console.warn("History editing unavailable",e)}
 }

 function markHistoryTable(){
   const body=el("ratingHistoryBody");
   if(!body)return;
   const table=body.querySelector(".rating-history-table");
   if(!table||table.dataset.mobileCardsV70)return;
   table.dataset.mobileCardsV70="yes";
   const labels=["日付","大会","相手","結果","試合前","変動","試合後","分配"];
   table.querySelectorAll("tbody tr").forEach(tr=>{
     if(tr.children.length!==8)return;
     [...tr.children].forEach((td,i)=>{
       td.dataset.label=labels[i];
       if(i===0 && !td.textContent.trim()){
         td.textContent="日付未確定";
         td.classList.add("history-unconfirmed-date-v70");
       }
     });
   });
 }
 const observer=new MutationObserver(()=>{patchSchoolDetail();markHistoryTable();attachHistoryEditors()});
 const start=()=>{observer.observe(document.body,{subtree:true,childList:true});
   patchSchoolDetail();markHistoryTable()};
 if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",start,{once:true});
 else start();
})();
