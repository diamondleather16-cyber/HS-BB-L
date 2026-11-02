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
 const observer=new MutationObserver(()=>{patchSchoolDetail();markHistoryTable()});
 const start=()=>{observer.observe(document.body,{subtree:true,childList:true});
   patchSchoolDetail();markHistoryTable()};
 if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",start,{once:true});
 else start();
})();
